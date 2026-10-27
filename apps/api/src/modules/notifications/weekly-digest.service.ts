import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import { TaskStatus } from "@taskmaster/contracts";
import { UnscopedPrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { MailService } from "../mail/mail.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const DIGEST_HOUR = 8;
const DIGEST_WEEKDAY = "Mon";
const MAX_TASKS_IN_EMAIL = 5;

/**
 * Envía el resumen semanal los lunes a las 8:00 de la zona horaria del usuario.
 *
 * El cron corre cada hora y decide en memoria si a ese usuario le toca: así una
 * sola expresión cubre todas las zonas sin programar un job por offset. La
 * ventana es de una hora completa, pero el tick es a los 5 minutos, así que hay
 * margen para un arranque lento sin perder el envío del día.
 */
@Injectable()
export class WeeklyDigestService {
  private readonly logger = new Logger(WeeklyDigestService.name);

  constructor(
    private readonly unscoped: UnscopedPrismaService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Cron("0 5 * * * *")
  async handleWeeklyDigest(now = new Date()): Promise<void> {
    const users = await this.unscoped.userSettings.findMany({
      where: { weeklyDigest: true },
      select: {
        userId: true,
        timezone: true,
        user: { select: { email: true, name: true } },
      },
    });

    for (const settings of users) {
      if (!isDigestWindow(now, settings.timezone, DIGEST_HOUR)) continue;
      try {
        await this.sendForUser({
          userId: settings.userId,
          email: settings.user.email,
          name: settings.user.name,
          timeZone: settings.timezone,
          now,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo enviar el resumen semanal a user=${settings.userId}: ${String(error)}`,
        );
      }
    }
  }

  private async sendForUser(input: {
    userId: string;
    email: string;
    name: string;
    timeZone: string;
    now: Date;
  }): Promise<void> {
    const weekAgo = new Date(input.now.getTime() - 7 * DAY_MS);
    const inSevenDays = new Date(input.now.getTime() + 7 * DAY_MS);

    // Segundo cinturón además del lock: si un envío anterior ya dejó su
    // notificación en la campanita, este usuario ya recibió el resumen.
    const alreadySent = await this.unscoped.notification.findFirst({
      where: {
        userId: input.userId,
        type: "WEEKLY_DIGEST",
        createdAt: { gte: new Date(input.now.getTime() - 6 * DAY_MS) },
      },
      select: { id: true },
    });
    if (alreadySent) return;

    const open = await this.unscoped.task.findMany({
      where: {
        assignees: { some: { userId: input.userId } },
        status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
      },
      select: { id: true, title: true, dueDate: true },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 300,
    });

    const completed = await this.unscoped.task.count({
      where: {
        assignees: { some: { userId: input.userId } },
        status: TaskStatus.DONE,
        completedAt: { gte: weekAgo },
      },
    });

    if (open.length === 0 && completed === 0) {
      this.logger.log(
        `Resumen semanal omitido para user=${input.userId}: sin actividad`,
      );
      return;
    }

    const overdue = open.filter(
      (task) => task.dueDate !== null && task.dueDate < input.now,
    );
    const upcoming = open.filter(
      (task) =>
        task.dueDate !== null &&
        task.dueDate >= input.now &&
        task.dueDate <= inSevenDays,
    );

    const lockKey = `${this.redis.keyPrefix}:weekly-digest:${input.userId}:${localDateKey(
      input.now,
      input.timeZone,
    )}`;
    const acquired = await this.redis.withFallback(
      async () =>
        (await this.redis.client.set(
          lockKey,
          "1",
          "EX",
          8 * 24 * 3600,
          "NX",
        )) === "OK",
      // Sin Redis preferimos arriesgar un duplicado (la notificación de arriba
      // igual lo frena en el caso secuencial) antes que dejar de mandar el mail.
      () => true,
      "weekly-digest",
    );
    if (!acquired) return;

    const webUrl =
      this.config.get<string>("WEB_URL") ?? "http://localhost:5173";
    const priority = [...overdue, ...upcoming];
    const tasks = (priority.length > 0 ? priority : open).slice(
      0,
      MAX_TASKS_IN_EMAIL,
    );

    const result = await this.mail.sendWeeklyDigest({
      to: input.email,
      name: input.name,
      timeZone: input.timeZone,
      openCount: open.length,
      overdueCount: overdue.length,
      upcomingCount: upcoming.length,
      completedCount: completed,
      tasks: tasks.map((task) => ({
        title: task.title,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
      actionUrl: new URL("/dashboard", webUrl).toString(),
    });

    if (!result.sent) {
      // Sin provider configurado no marcamos el envío: cuando se configure,
      // el próximo lunes (o el próximo tick si sigue en ventana) sale igual.
      await this.releaseLock(lockKey);
      this.logger.warn(
        `Resumen semanal de user=${input.userId} no enviado: email sin configurar`,
      );
      return;
    }

    await this.unscoped.notification.create({
      data: {
        userId: input.userId,
        type: "WEEKLY_DIGEST",
        title: "Tu resumen semanal está listo",
        body: `${open.length} pendientes · ${overdue.length} vencidas · ${completed} completadas`,
        data: {
          openCount: open.length,
          overdueCount: overdue.length,
          upcomingCount: upcoming.length,
          completedCount: completed,
        },
      },
    });

    this.logger.log(`Resumen semanal enviado a user=${input.userId}`);
  }

  private async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.client.del(key);
    } catch {
      // El lock expira solo; no vale la pena tapar el error original.
    }
  }
}

/**
 * `true` si en la zona horaria indicada es el día y la hora del resumen.
 *
 * Una zona inválida (dato viejo o typo en la DB) cae a UTC en vez de romper el
 * cron para el resto de los usuarios. La usa el servicio y los tests.
 */
export function isDigestWindow(
  now: Date,
  timeZone: string,
  hour = DIGEST_HOUR,
): boolean {
  const parts = dateParts(now, timeZone, {
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  });
  return parts.weekday === DIGEST_WEEKDAY && Number(parts.hour) === hour;
}

function localDateKey(now: Date, timeZone: string): string {
  const parts = dateParts(now, timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateParts(
  now: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: "UTC",
    });
  }
  return Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}
