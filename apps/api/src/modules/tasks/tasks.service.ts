import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Action,
  EntityType,
  Priority,
  TaskStatus,
  type CreateSubtaskInput,
  type CreateTaskInput,
  type Task,
  type TaskFilters,
  type UpdateTaskInput,
} from "@taskmaster/contracts";
import type { Prisma } from "@prisma/client";
import type { Task as PrismaTask } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ActivityService } from "../activity/activity.service";

const TASK_INCLUDE = {
  tags: { include: { tag: true } },
  assignees: { include: { user: true } },
  category: true,
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly activity: ActivityService,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
    filters: TaskFilters,
  ): Promise<{
    items: Task[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    await this.access.assertMembership(workspaceId, userId);

    const where = this.buildWhere(workspaceId, userId, filters);

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items: items.map((t) => this.toTaskDto(t)),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  }

  async get(workspaceId: string, id: string, userId: string): Promise<Task> {
    await this.access.assertMembership(workspaceId, userId);
    const task = await this.prisma.task.findFirst({
      where: { id, workspaceId },
      include: {
        ...TASK_INCLUDE,
        subtasks: { include: TASK_INCLUDE, orderBy: [{ order: "asc" }] },
      },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");
    const { subtasks, ...rest } = task;
    return {
      ...this.toTaskDto(rest),
      subtasks: subtasks.map((s) => this.toTaskDto(s)),
    };
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateTaskInput,
  ): Promise<Task> {
    await this.access.assertMembership(workspaceId, userId);
    await this.validateRelations(workspaceId, dto);

    const order = await this.nextOrder(workspaceId, dto.parentId);

    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        creatorId: userId,
        title: dto.title,
        description: dto.description ?? "",
        status: dto.status,
        priority: dto.priority,
        dueDate: dto.dueDate ?? null,
        startDate: dto.startDate ?? null,
        order,
        parentId: dto.parentId ?? null,
        categoryId: dto.categoryId ?? null,
        isRecurring: dto.isRecurring,
        recurrence: dto.isRecurring
          ? (dto.recurrence as Prisma.InputJsonValue | undefined)
          : undefined,
        tags: { create: (dto.tagIds ?? []).map((tagId) => ({ tagId })) },
        assignees: {
          create: (dto.assigneeIds ?? []).map((aId) => ({ userId: aId })),
        },
      },
      include: TASK_INCLUDE,
    });

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.TASK,
      task.id,
      Action.CREATED,
      [{ field: "title", old: null, new: task.title }],
    );

    return this.toTaskDto(task);
  }

  async addSubtask(
    workspaceId: string,
    parentId: string,
    userId: string,
    dto: CreateSubtaskInput,
  ): Promise<Task> {
    await this.access.assertMembership(workspaceId, userId);

    const parent = await this.prisma.task.findFirst({
      where: { id: parentId, workspaceId },
    });
    if (!parent) throw new NotFoundException("Tarea padre no encontrada");

    const order = await this.nextOrder(workspaceId, parentId);

    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        creatorId: userId,
        title: dto.title,
        description: "",
        status: TaskStatus.TODO,
        priority: Priority.MEDIUM,
        parentId,
        order,
      },
      include: TASK_INCLUDE,
    });

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.TASK,
      task.id,
      Action.CREATED,
      [{ field: "title", old: null, new: task.title }],
    );

    return this.toTaskDto(task);
  }

  async update(
    workspaceId: string,
    id: string,
    userId: string,
    dto: UpdateTaskInput,
  ): Promise<Task> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.task.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Tarea no encontrada");

    await this.validateRelations(workspaceId, dto, id);

    const nextStatus = dto.status;
    const completedAt =
      nextStatus === undefined
        ? undefined
        : nextStatus === TaskStatus.DONE
          ? new Date()
          : null;

    const data: Prisma.TaskUncheckedUpdateInput = {
      title: dto.title,
      description: dto.description,
      status: dto.status,
      priority: dto.priority,
      dueDate: dto.dueDate,
      startDate: dto.startDate,
      parentId: dto.parentId,
      categoryId: dto.categoryId,
      isRecurring: dto.isRecurring,
      recurrence: dto.recurrence
        ? (dto.recurrence as Prisma.InputJsonValue)
        : undefined,
      completedAt,
    };

    const task = await this.prisma.task.update({
      where: { id },
      data,
      include: TASK_INCLUDE,
    });

    if (nextStatus === TaskStatus.DONE) {
      await this.markSubtreeDone(workspaceId, existing);
    }

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.TASK,
      id,
      Action.UPDATED,
      this.diffTask(existing, task),
    );

    return this.toTaskDto(task);
  }

  async setStatus(
    workspaceId: string,
    id: string,
    userId: string,
    status: TaskStatus,
  ): Promise<Task> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.task.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Tarea no encontrada");

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === TaskStatus.DONE ? new Date() : null,
      },
      include: TASK_INCLUDE,
    });

    if (status === TaskStatus.DONE) {
      await this.markSubtreeDone(workspaceId, existing);
    }

    await this.activity.log(
      workspaceId,
      userId,
      EntityType.TASK,
      id,
      Action.STATUS_CHANGED,
      [{ field: "status", old: existing.status, new: status }],
    );

    return this.toTaskDto(task);
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertMembership(workspaceId, userId);
    const existing = await this.prisma.task.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) throw new NotFoundException("Tarea no encontrada");

    const subtaskIds = await this.findDescendantIds(id);

    await this.prisma.task.delete({ where: { id } });
    await this.activity.log(
      workspaceId,
      userId,
      EntityType.TASK,
      id,
      Action.DELETED,
    );
    for (const subtaskId of subtaskIds) {
      await this.activity.log(
        workspaceId,
        userId,
        EntityType.TASK,
        subtaskId,
        Action.DELETED,
      );
    }
    return { id };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private buildWhere(
    workspaceId: string,
    userId: string,
    filters: TaskFilters,
  ): Prisma.TaskWhereInput {
    const where: Prisma.TaskWhereInput = { workspaceId };
    const or: Prisma.TaskWhereInput[] = [];

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;

    if (filters.search) {
      or.push({
        title: { contains: filters.search, mode: "insensitive" },
      });
      or.push({
        description: { contains: filters.search, mode: "insensitive" },
      });
    }

    const dueRange: Prisma.DateTimeNullableFilter = {};
    if (filters.dueDateFrom) dueRange.gte = filters.dueDateFrom;
    if (filters.dueDateTo) dueRange.lte = filters.dueDateTo;
    if (Object.keys(dueRange).length > 0) where.dueDate = dueRange;

    const and: Prisma.TaskWhereInput[] = [];
    if (filters.onlyOverdue) {
      and.push({
        dueDate: { lt: new Date() },
        status: { not: TaskStatus.DONE },
      });
    }
    if (filters.onlyMine) {
      and.push({ assignees: { some: { userId } } });
    }
    if (and.length > 0) where.AND = and;

    if (or.length > 0) where.OR = or;

    if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };
    if (filters.assigneeId)
      where.assignees = { some: { userId: filters.assigneeId } };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.parentId) where.parentId = filters.parentId;

    return where;
  }

  private async validateRelations(
    workspaceId: string,
    dto: CreateTaskInput | UpdateTaskInput,
    taskId?: string,
  ): Promise<void> {
    const tagIds = "tagIds" in dto ? dto.tagIds : undefined;
    const assigneeIds = "assigneeIds" in dto ? dto.assigneeIds : undefined;

    const checks: Promise<number>[] = [];

    if (dto.parentId && dto.parentId !== taskId) {
      checks.push(
        this.prisma.task.count({
          where: { id: dto.parentId, workspaceId },
        }),
      );
    }
    if (dto.categoryId) {
      checks.push(
        this.prisma.category.count({
          where: { id: dto.categoryId, workspaceId },
        }),
      );
    }
    if (tagIds && tagIds.length > 0) {
      checks.push(
        this.prisma.tag.count({
          where: { id: { in: tagIds }, workspaceId },
        }),
      );
    }
    if (assigneeIds && assigneeIds.length > 0) {
      checks.push(
        this.prisma.workspaceMember.count({
          where: {
            workspaceId,
            userId: { in: assigneeIds },
          },
        }),
      );
    }

    const results = await Promise.all(checks);
    const expected = [
      dto.parentId && dto.parentId !== taskId ? 1 : 0,
      dto.categoryId ? 1 : 0,
      tagIds?.length ?? 0,
      assigneeIds?.length ?? 0,
    ].filter((n) => n > 0);

    const mismatch = results.some((count, i) => count !== expected[i]);
    if (mismatch) {
      throw new BadRequestException(
        "Alguna relación (padre, categoría, etiqueta o asignado) no existe en este workspace",
      );
    }
  }

  private async nextOrder(
    workspaceId: string,
    parentId?: string | null,
  ): Promise<number> {
    const agg = await this.prisma.task.aggregate({
      where: { workspaceId, parentId: parentId ?? null },
      _max: { order: true },
    });
    return (agg._max.order ?? 0) + 1;
  }

  private async markSubtreeDone(
    workspaceId: string,
    parent: { id: string },
  ): Promise<void> {
    const children = await this.prisma.task.findMany({
      where: {
        parentId: parent.id,
        workspaceId,
        status: { not: TaskStatus.DONE },
      },
      select: { id: true },
    });
    for (const child of children) {
      await this.prisma.task.update({
        where: { id: child.id },
        data: { status: TaskStatus.DONE, completedAt: new Date() },
      });
      await this.markSubtreeDone(workspaceId, child);
    }
  }

  private async findDescendantIds(taskId: string): Promise<string[]> {
    const ids: string[] = [];
    let queue = [taskId];
    while (queue.length > 0) {
      const children = await this.prisma.task.findMany({
        where: { parentId: { in: queue } },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      ids.push(...childIds);
      queue = childIds;
    }
    return ids;
  }

  private diffTask(before: PrismaTask, after: TaskWithRelations) {
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    const fields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "startDate",
    ] as const;
    for (const field of fields) {
      const oldVal = before[field];
      const newVal = after[field];
      const normalizedOld =
        oldVal instanceof Date ? oldVal.toISOString() : oldVal;
      const normalizedNew =
        newVal instanceof Date ? newVal.toISOString() : newVal;
      if (normalizedOld !== normalizedNew) {
        changes.push({ field, old: normalizedOld, new: normalizedNew });
      }
    }
    return changes;
  }

  private toTaskDto(task: TaskWithRelations): Task {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      creatorId: task.creatorId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      startDate: task.startDate ? task.startDate.toISOString() : null,
      order: task.order,
      parentId: task.parentId,
      categoryId: task.categoryId,
      category: task.category
        ? {
            id: task.category.id,
            name: task.category.name,
            color: task.category.color,
          }
        : null,
      tags: task.tags.map((tt) => ({
        id: tt.tag.id,
        name: tt.tag.name,
        color: tt.tag.color,
      })),
      assignees: task.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
      })),
      subtasks: [],
      isRecurring: task.isRecurring,
      recurrence: task.recurrence as Task["recurrence"],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    };
  }
}
