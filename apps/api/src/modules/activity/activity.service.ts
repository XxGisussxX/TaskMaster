import { Injectable } from "@nestjs/common";
import type { Action, ActivityEntry, EntityType } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";

interface Change {
  field: string;
  old: unknown;
  new: unknown;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    workspaceId: string,
    userId: string,
    entityType: EntityType,
    entityId: string,
    action: Action,
    changes?: Change[],
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        workspaceId,
        userId,
        entityType,
        entityId,
        action,
        changes: changes ? (changes as unknown as object) : undefined,
      },
    });
  }

  async list(workspaceId: string, limit = 30): Promise<ActivityEntry[]> {
    const rows = await this.prisma.activityLog.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      entityType: row.entityType as EntityType,
      entityId: row.entityId,
      action: row.action as Action,
      changes: row.changes as Change[] | null,
      user: row.user
        ? {
            id: row.user.id,
            name: row.user.name,
            email: row.user.email,
            avatarUrl: row.user.avatarUrl,
          }
        : undefined,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
