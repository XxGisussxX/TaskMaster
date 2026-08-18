import { Injectable, NotFoundException } from "@nestjs/common";
import type { Notification, NotificationFilters } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsService } from "../websocket/events.service";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
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

    return result;
  }
}
