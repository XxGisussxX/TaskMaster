import { Injectable } from "@nestjs/common";
import {
  TaskStatus,
  type DashboardStats,
  type Task,
} from "@taskmaster/contracts";
import {
  buildActivitySeries,
  computeKpis,
  priorityDistribution,
} from "@taskmaster/domain";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { ActivityService } from "../activity/activity.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly activity: ActivityService,
  ) {}

  async stats(workspaceId: string, userId: string): Promise<DashboardStats> {
    await this.access.assertMembership(workspaceId, userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        workspaceId,
        status: { not: TaskStatus.ARCHIVED },
      },
      select: {
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });

    const domainTasks: Task[] = tasks.map((t) => ({
      id: "",
      workspaceId,
      creatorId: "",
      title: "",
      description: "",
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      startDate: null,
      order: 0,
      parentId: null,
      categoryId: null,
      tags: [],
      assignees: [],
      subtasks: [],
      isRecurring: false,
      recurrence: null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }));

    const now = new Date();
    const kpis = computeKpis(domainTasks, now);

    const from = new Date(now);
    from.setDate(from.getDate() - 29);

    const statusDistribution: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      ARCHIVED: 0,
    };
    for (const t of domainTasks) statusDistribution[t.status]++;

    const activity = await this.activity.list(workspaceId, 30);

    return {
      kpis,
      createdCompletedSeries: buildActivitySeries(domainTasks, from, now),
      priorityDistribution: priorityDistribution(domainTasks),
      statusDistribution,
      activity,
    };
  }
}
