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
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { EventsService } from "../websocket/events.service";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly events: EventsService,
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

    return comments.map((c) => ({
      id: c.id,
      taskId: c.taskId,
      userId: c.userId,
      body: c.body,
      user: c.user,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async create(
    workspaceId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentInput,
  ): Promise<Comment> {
    await this.access.assertMembership(workspaceId, userId);

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) throw new NotFoundException("Tarea no encontrada");

    const comment = await this.prisma.comment.create({
      data: {
        taskId,
        userId,
        body: dto.body,
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const result: Comment = {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      body: comment.body,
      user: comment.user,
      createdAt: comment.createdAt.toISOString(),
    };

    this.events.emit("comment.created", {
      workspaceId,
      taskId,
      comment: result,
    });

    return result;
  }

  async update(
    workspaceId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentInput,
  ): Promise<Comment> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) throw new NotFoundException("Comentario no encontrado");
    if (existing.userId !== userId) {
      throw new ForbiddenException("Solo puedes editar tu propio comentario");
    }

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const result: Comment = {
      id: comment.id,
      taskId: comment.taskId,
      userId: comment.userId,
      body: comment.body,
      user: comment.user,
      createdAt: comment.createdAt.toISOString(),
    };

    this.events.emit("comment.updated", {
      workspaceId,
      taskId: comment.taskId,
      comment: result,
    });

    return result;
  }

  async remove(
    workspaceId: string,
    commentId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertMembership(workspaceId, userId);

    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!existing) throw new NotFoundException("Comentario no encontrado");
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
}
