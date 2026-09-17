import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateTimeEntryInput,
  TimeEntry,
  UpdateTimeEntryInput,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

@Injectable()
export class TimeEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async create(
    workspaceId: string,
    userId: string,
    input: CreateTimeEntryInput,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: input.taskId, workspaceId },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    const startedAt = new Date(input.startedAt);
    const stoppedAt = input.stoppedAt ? new Date(input.stoppedAt) : null;

    const duration = stoppedAt
      ? Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000)
      : null;

    const entry = await this.prisma.timeEntry.create({
      data: {
        workspaceId,
        taskId: input.taskId,
        userId,
        description: input.description ?? "",
        startedAt,
        stoppedAt,
        duration,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      taskId: entry.taskId,
      userId: entry.userId,
      description: entry.description,
      startedAt: entry.startedAt.toISOString(),
      stoppedAt: entry.stoppedAt?.toISOString() ?? null,
      duration: entry.duration,
      user: entry.user,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async list(
    workspaceId: string,
    userId: string,
    filters: {
      taskId?: string;
      userId?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<TimeEntry[]> {
    await this.access.assertMembership(workspaceId, userId);

    const where: Record<string, unknown> = { workspaceId };

    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.from || filters.to) {
      where.startedAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    return entries.map((e) => ({
      id: e.id,
      workspaceId: e.workspaceId,
      taskId: e.taskId,
      userId: e.userId,
      description: e.description,
      startedAt: e.startedAt.toISOString(),
      stoppedAt: e.stoppedAt?.toISOString() ?? null,
      duration: e.duration,
      user: e.user,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async stop(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }

    const stoppedAt = new Date();
    const duration = Math.floor(
      (stoppedAt.getTime() - existing.startedAt.getTime()) / 1000,
    );

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data: { stoppedAt, duration },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      taskId: entry.taskId,
      userId: entry.userId,
      description: entry.description,
      startedAt: entry.startedAt.toISOString(),
      stoppedAt: entry.stoppedAt?.toISOString() ?? null,
      duration: entry.duration,
      user: entry.user,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async update(
    workspaceId: string,
    userId: string,
    id: string,
    input: UpdateTimeEntryInput,
  ): Promise<TimeEntry> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }

    const data: Record<string, unknown> = {};
    if (input.description !== undefined) data.description = input.description;
    if (input.startedAt !== undefined)
      data.startedAt = new Date(input.startedAt);
    if (input.stoppedAt !== undefined) {
      data.stoppedAt = input.stoppedAt ? new Date(input.stoppedAt) : null;
    }

    const startedAt =
      data.startedAt instanceof Date ? data.startedAt : existing.startedAt;
    const stoppedAt =
      data.stoppedAt instanceof Date
        ? data.stoppedAt
        : data.stoppedAt === null
          ? null
          : existing.stoppedAt;

    if (stoppedAt) {
      data.duration = Math.floor(
        (stoppedAt.getTime() - startedAt.getTime()) / 1000,
      );
    } else {
      data.duration = null;
    }

    const entry = await this.prisma.timeEntry.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      taskId: entry.taskId,
      userId: entry.userId,
      description: entry.description,
      startedAt: entry.startedAt.toISOString(),
      stoppedAt: entry.stoppedAt?.toISOString() ?? null,
      duration: entry.duration,
      user: entry.user,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async remove(
    workspaceId: string,
    userId: string,
    id: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.timeEntry.findUnique({
      where: { id },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
      throw new NotFoundException("Entrada de tiempo no encontrada");
    }

    await this.prisma.timeEntry.delete({ where: { id } });
    return { id };
  }
}
