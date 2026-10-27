import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  NotificationType,
  type Notification,
  type NotificationFilters,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsService } from "../websocket/events.service";
import { MailService } from "../mail/mail.service";

/**
 * Tipos de notificación que también salen por email y la preferencia que los
 * habilita. Todo lo que no esté acá queda solo in-app: comentarios y menciones
 * son ruidosos por email y se resuelven dentro de la app.
 */
const EMAIL_PREF_BY_TYPE: Record<string, string> = {
  [NotificationType.REMINDER]: "reminders",
  [NotificationType.DUE_SOON]: "dueSoon",
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async list(
    userId: string,
    filters: NotificationFilters,
  ): Promise<{ items: Notification[]; total: number }> {
    const where = {
      userId,
      ...(filters.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        userId: n.userId,
        workspaceId: n.workspaceId,
        type: n.type as Notification["type"],
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      total,
    };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<{ id: string }> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notificación no encontrada");
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
    return { id: notificationId };
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }

  async create(input: {
    userId: string;
    workspaceId?: string;
    type: string;
    title: string;
    body?: string;
    data?: unknown;
  }): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? undefined,
      },
    });

    const result: Notification = {
      id: notification.id,
      userId: notification.userId,
      workspaceId: notification.workspaceId,
      type: notification.type as Notification["type"],
      title: notification.title,
      body: notification.body,
      data: notification.data,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };

    this.events.emit("notification.new", {
      userId: input.userId,
      notification: result,
    });

    // El email no puede bloquear la creación de la notificación ni tirar el
    // request que la originó: si Resend falla, el usuario igual ve la campanita.
    if (EMAIL_PREF_BY_TYPE[input.type]) {
      void this.sendEmailNotification(input, result);
    }

    return result;
  }

  private async sendEmailNotification(
    input: {
      userId: string;
      type: string;
      title: string;
      body?: string;
    },
    notification: Notification,
  ): Promise<void> {
    try {
      const prefKey = EMAIL_PREF_BY_TYPE[input.type];
      if (!prefKey) return;

      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: {
          email: true,
          settings: { select: { emailPrefs: true } },
        },
      });
      if (!user) return;

      const prefs = (user.settings?.emailPrefs ?? {}) as Record<
        string,
        unknown
      >;
      // Sin preferencia guardada se manda: el default es recibir recordatorios
      // y vencimientos, que es lo que el usuario espera al crearlos.
      if (prefs[prefKey] === false) return;

      const webUrl =
        this.config.get<string>("WEB_URL") ?? "http://localhost:5173";
      await this.mail.sendNotification({
        to: user.email,
        title: notification.title,
        body: notification.body ?? input.body,
        actionUrl: new URL("/tasks", webUrl).toString(),
      });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el email de la notificación ${input.type} a user=${input.userId}: ${String(error)}`,
      );
    }
  }
}
