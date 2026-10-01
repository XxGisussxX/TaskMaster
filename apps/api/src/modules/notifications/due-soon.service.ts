import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { TaskStatus } from "@taskmaster/contracts";
import { UnscopedPrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

/**
 * Cron periódico que detecta tareas cuyo vencimiento cae dentro de una
 * ventana (configurable) y crea una notificación DUE_SOON a los asignados
 * (o al creador si no hay asignados). El campo `Task.dueSoNotifiedAt`
 * garantiza que cada tarea se notifique una sola vez por vencimiento;
 * se rearma cuando cambia su fecha o se reabre.
 */
@Injectable()
export class DueSoonService {
  private readonly logger = new Logger(DueSoonService.name);

  constructor(
    private readonly unscoped: UnscopedPrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  @Cron("0 * * * * *")
  async handleDueSoon(): Promise<void> {
    const now = new Date();
    const windowHours = this.config.get<number>("DUE_SOON_WINDOW_HOURS") ?? 24;
    const horizon = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

    const tasks = await this.unscoped.task.findMany({
      where: {
        dueDate: { gte: now, lte: horizon },
        status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
        dueSoNotifiedAt: null,
      },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        dueDate: true,
        creatorId: true,
        assignees: { select: { userId: true } },
      },
    });

    if (tasks.length === 0) return;

    this.logger.log(`Processing ${tasks.length} task(s) due soon`);

    for (const task of tasks) {
      try {
        const recipients = [
          ...new Set(
            (task.assignees.length > 0
              ? task.assignees.map((a) => a.userId)
              : [task.creatorId]
            ).filter(Boolean),
          ),
        ];

        await this.unscoped.$transaction(async (tx) => {
          for (const userId of recipients) {
            await this.notifications.create({
              userId,
              workspaceId: task.workspaceId,
              type: "DUE_SOON",
              title: `La tarea "${task.title}" vence pronto`,
              body: `Vence ${this.humanDue(task.dueDate!)}.`,
              data: {
                taskId: task.id,
                dueDate: task.dueDate!.toISOString(),
              },
            });
          }

          await tx.task.update({
            where: { id: task.id },
            data: { dueSoNotifiedAt: now },
          });
        });
      } catch (error) {
        this.logger.error(
          `Failed to process due-soon for task ${task.id}: ${error}`,
        );
      }
    }
  }

  private humanDue(dueDate: Date): string {
    const diffMs = dueDate.getTime() - Date.now();
    const hours = Math.round(diffMs / 3_600_000);

    if (hours <= 1) return "dentro de menos de una hora";
    if (hours < 24) return `dentro de ${hours} h`;
    const days = Math.round(hours / 24);
    return `en ${days} día${days === 1 ? "" : "s"}`;
  }
}
