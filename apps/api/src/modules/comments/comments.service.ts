import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Comment,
  CreateCommentInput,
  UpdateCommentInput,
} from "@taskmaster/contracts";
import { NotificationType } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { EventsService } from "../websocket/events.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  async listByTask(
    workspaceId: string,
    taskId: string,
    userId: string,
  ): Promise<Comment[]> {
    await this.access.assertMembership(workspaceId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });

    return comments.map((c) => this.toCommentDto(c));
  }

  async create(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentInput,
  ): Promise<Comment> {
    await this.access.assertWriteRole(workspaceId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    const resolvedMentionIds = dto.mentionedUserIds?.length
      ? await this.resolveMentionIds(workspaceId, dto.mentionedUserIds)
      : [];

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        userId,
        body: dto.body,
        mentionedUserIds: JSON.stringify(resolvedMentionIds),
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const result = this.toCommentDto(comment);

    this.events.emit("comment.created", {
      workspaceId,
      taskId,
      comment: result,
    });

    if (resolvedMentionIds.length > 0) {
      await this.notifyMentionedUsers(
        workspaceId,
        taskId,
        userId,
        resolvedMentionIds,
        dto.body,
      );
    }

    return result;
  }

  async update(
    workspaceId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentInput,
  ): Promise<Comment> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: { select: { workspaceId: true } } },
    });
    if (!existing || existing.task.workspaceId !== workspaceId) {
      throw new NotFoundException("Comentario no encontrado");
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Solo puedes editar tu propio comentario");
    }

    const oldMentionedIds: string[] = JSON.parse(
      existing.mentionedUserIds ?? "[]",
    );

    const resolvedMentionIds = dto.mentionedUserIds?.length
      ? await this.resolveMentionIds(workspaceId, dto.mentionedUserIds)
      : [];

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        body: dto.body,
        mentionedUserIds: JSON.stringify(resolvedMentionIds),
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const result = this.toCommentDto(comment);

    this.events.emit("comment.updated", {
      workspaceId,
      taskId: comment.taskId,
      comment: result,
    });

    const newMentionIds = resolvedMentionIds.filter(
      (id) => !oldMentionedIds.includes(id),
    );
    if (newMentionIds.length > 0) {
      await this.notifyMentionedUsers(
        workspaceId,
        comment.taskId,
        userId,
        newMentionIds,
        dto.body,
      );
    }

    return result;
  }

  async remove(
    workspaceId: string,
    commentId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: { select: { workspaceId: true } } },
    });
    if (!existing || existing.task.workspaceId !== workspaceId) {
      throw new NotFoundException("Comentario no encontrado");
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Solo puedes eliminar tu propio comentario");
    }

    await this.prisma.comment.delete({ where: { id: commentId } });

    this.events.emit("comment.deleted", {
      workspaceId,
      taskId: existing.taskId,
      commentId,
    });

    return { id: commentId };
  }

  // â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async resolveMentionIds(
    workspaceId: string,
    userIds: string[],
  ): Promise<string[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: userIds } },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async notifyMentionedUsers(
    workspaceId: string,
    taskId: string,
    senderId: string,
    mentionedUserIds: string[],
    body: string,
  ): Promise<void> {
    const recipients = mentionedUserIds.filter((id) => id !== senderId);
    if (recipients.length === 0) return;

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    for (const recipientId of recipients) {
      await this.notifications.create({
        userId: recipientId,
        workspaceId,
        type: NotificationType.MENTION,
        title: `${sender?.name ?? "Alguien"} te mencionÃ³ en un comentario`,
        body: body.length > 100 ? `${body.slice(0, 100)}...` : body,
        data: { taskId, commentTaskTitle: task?.title ?? "" },
      });
    }
  }

  private toCommentDto(comment: {
    id: string;
    taskId: string;
    userId: string;
    body: string;
    mentionedUserIds: string | null;
    user?: { id: string; name: string; avatarUrl: string | null } | null;
    createdAt: Date;
  }): Comment {
    return {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      body: comment.body,
      mentionedUserIds: JSON.parse(comment.mentionedUserIds ?? "[]"),
      user: comment.user
        ? {
            id: comment.user.id,
            name: comment.user.name,
            avatarUrl: comment.user.avatarUrl,
          }
        : undefined,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
