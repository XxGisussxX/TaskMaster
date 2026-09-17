import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  CreateReminderInput,
  Reminder,
  ReminderFilters,
  ReminderRepeat,
  UpdateReminderInput,
} from "@taskmaster/contracts";
import {
  PrismaService,
  UnscopedPrismaService,
} from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly unscoped: UnscopedPrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron("*/30 * * * * *")
  async handlePendingReminders(): Promise<void> {
    const now = new Date();

    const pending = await this.unscoped.reminder.findMany({
      where: {
        triggerAt: { lte: now },
        sentAt: null,
      },
    });

    if (pending.length === 0) return;

    this.logger.log(`Processing ${pending.length} pending reminder(s)`);

    for (const reminder of pending) {
      try {
        await this.unscoped.$transaction(async (tx) => {
          await tx.reminder.update({
            where: { id: reminder.id },
            data: { sentAt: now },
          });

          await this.notifications.create({
            userId: reminder.userId,
            workspaceId: reminder.workspaceId,
            type: "REMINDER",
            title: reminder.title,
            body: "Recordatorio programado",
            data: {
              reminderId: reminder.id,
              taskId: reminder.taskId,
              noteId: reminder.noteId,
            },
          });
        });

        if (reminder.repeat && reminder.repeat !== "NONE") {
          await this.createNextOccurrence(reminder);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process reminder ${reminder.id}: ${error}`,
        );
      }
    }
  }

  async list(
    workspaceId: string,
    userId: string,
    filters: ReminderFilters,
  ): Promise<Reminder[]> {
    await this.access.assertMembership(workspaceId, userId);

    const where: Record<string, unknown> = {
      workspaceId,
      userId,
    };
    if (filters.from || filters.to) {
      where.triggerAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const items = await this.prisma.reminder.findMany({
      where,
      orderBy: { triggerAt: "asc" },
    });

    return items.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      userId: r.userId,
      taskId: r.taskId,
      noteId: r.noteId,
      title: r.title,
      triggerAt: r.triggerAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
      repeat: r.repeat,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateReminderInput,
  ): Promise<Reminder> {
    await this.access.assertWriteRole(workspaceId, userId);

    await this.assertTargetsInWorkspace(workspaceId, {
      taskId: dto.taskId,
      noteId: dto.noteId,
    });

    const reminder = await this.prisma.reminder.create({
      data: {
        workspaceId,
        userId,
        title: dto.title,
        triggerAt: dto.triggerAt,
        repeat: dto.repeat,
        taskId: dto.taskId ?? null,
        noteId: dto.noteId ?? null,
      },
    });

    return {
      id: reminder.id,
      workspaceId: reminder.workspaceId,
      userId: reminder.userId,
      taskId: reminder.taskId,
      noteId: reminder.noteId,
      title: reminder.title,
      triggerAt: reminder.triggerAt.toISOString(),
      sentAt: reminder.sentAt?.toISOString() ?? null,
      repeat: reminder.repeat,
      createdAt: reminder.createdAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    reminderId: string,
    userId: string,
    dto: UpdateReminderInput,
  ): Promise<Reminder> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Recordatorio no encontrado");
    }
    if (existing.userId !== userId) {
      throw new NotFoundException("Recordatorio no encontrado");
    }

    if (dto.taskId !== undefined || dto.noteId !== undefined) {
      await this.assertTargetsInWorkspace(workspaceId, {
        taskId: dto.taskId,
        noteId: dto.noteId,
      });
    }

    const reminder = await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.triggerAt !== undefined && { triggerAt: dto.triggerAt }),
        ...(dto.repeat !== undefined && { repeat: dto.repeat }),
        ...(dto.taskId !== undefined && { taskId: dto.taskId }),
        ...(dto.noteId !== undefined && { noteId: dto.noteId }),
      },
    });

    return {
      id: reminder.id,
      workspaceId: reminder.workspaceId,
      userId: reminder.userId,
      taskId: reminder.taskId,
      noteId: reminder.noteId,
      title: reminder.title,
      triggerAt: reminder.triggerAt.toISOString(),
      sentAt: reminder.sentAt?.toISOString() ?? null,
      repeat: reminder.repeat,
      createdAt: reminder.createdAt.toISOString(),
    };
  }

  async remove(
    workspaceId: string,
    reminderId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.reminder.findUnique({
      where: { id: reminderId },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Recordatorio no encontrado");
    }
    if (existing.userId !== userId) {
      throw new NotFoundException("Recordatorio no encontrado");
    }

    await this.prisma.reminder.delete({ where: { id: reminderId } });
    return { id: reminderId };
  }

  private async assertTargetsInWorkspace(
    workspaceId: string,
    targets: { taskId?: string | null; noteId?: string | null },
  ): Promise<void> {
    if (targets.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: targets.taskId, workspaceId },
        select: { id: true },
      });
      if (!task) throw new NotFoundException("Tarea no encontrada");
    }
    if (targets.noteId) {
      const note = await this.prisma.note.findFirst({
        where: { id: targets.noteId, workspaceId },
        select: { id: true },
      });
      if (!note) throw new NotFoundException("Nota no encontrada");
    }
  }

  private async createNextOccurrence(
    reminder: {
      id: string;
      workspaceId: string;
      userId: string;
      title: string;
      triggerAt: Date;
      repeat: ReminderRepeat;
      taskId: string | null;
      noteId: string | null;
    },
    endDate?: Date | null,
  ): Promise<void> {
    const nextDate = this.computeNextTriggerAt(
      reminder.triggerAt,
      reminder.repeat,
    );
    if (!nextDate) return;

    if (endDate && nextDate > endDate) return;

    await this.unscoped.reminder.create({
      data: {
        workspaceId: reminder.workspaceId,
        userId: reminder.userId,
        title: reminder.title,
        triggerAt: nextDate,
        repeat: reminder.repeat,
        taskId: reminder.taskId,
        noteId: reminder.noteId,
      },
    });

    this.logger.log(
      `Created next reminder occurrence for ${reminder.id}, trigger ${nextDate.toISOString()}`,
    );
  }

  private computeNextTriggerAt(
    base: Date,
    repeat: ReminderRepeat,
  ): Date | null {
    const next = new Date(base);

    switch (repeat) {
      case "DAILY":
        next.setDate(next.getDate() + 1);
        break;
      case "WEEKLY":
        next.setDate(next.getDate() + 7);
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        return null;
    }

    return next;
  }
}
