import { ForbiddenException, Logger, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  WebSocketGateway as WsGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { OnEvent } from "@nestjs/event-emitter";
import type { Server, Socket } from "socket.io";
import { UnscopedPrismaService } from "../../prisma/prisma.service";
import { resolveCorsOptions } from "../../config/cors";

interface NotificationPayload {
  userId: string;
  notification: unknown;
}

interface CommentPayload {
  workspaceId: string;
  taskId: string;
  comment: unknown;
}

interface CommentDeletedPayload {
  workspaceId: string;
  taskId: string;
  commentId: string;
}

interface TaskPayload {
  workspaceId: string;
  task: unknown;
}

interface TaskDeletedPayload {
  workspaceId: string;
  taskId: string;
}

interface TaskStatusPayload {
  workspaceId: string;
  taskId: string;
  oldStatus: string;
  newStatus: string;
}

@WsGateway({
  cors: resolveCorsOptions(process.env.API_ORIGINS, process.env.NODE_ENV),
  transports: ["websocket", "polling"],
})
export class AppWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);
  private userSockets = new Map<string, Set<string>>();
  private socketUser = new Map<string, string>();

  private jwtService!: JwtService;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: UnscopedPrismaService,
  ) {}

  onModuleInit() {
    this.jwtService = this.jwt;
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ??
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn("Conexión sin token — rechazada");
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      const userId = payload.sub;

      if (!userId) {
        this.logger.warn("Token sin sub — rechazada");
        client.disconnect(true);
        return;
      }

      this.socketUser.set(client.id, userId);

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      client.join(`user:${userId}`);
      this.logger.log(`Cliente conectado: ${client.id} (user: ${userId})`);
    } catch {
      this.logger.warn(`Autenticación fallida: ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.socketUser.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
    this.socketUser.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage("workspace:join")
  async handleJoinWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: data.workspaceId, userId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException("No eres miembro de este workspace");
    }

    client.join(`workspace:${data.workspaceId}`);
  }

  @SubscribeMessage("workspace:leave")
  handleLeaveWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ): void {
    client.leave(`workspace:${data.workspaceId}`);
  }

  // ── Event Listeners ──────────────────────────────────────────────────

  @OnEvent("notification.new")
  handleNotification(payload: NotificationPayload): void {
    this.server
      .to(`user:${payload.userId}`)
      .emit("notification:new", payload.notification);
  }

  @OnEvent("comment.created")
  handleCommentCreated(payload: CommentPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("comment:created", payload);
  }

  @OnEvent("comment.updated")
  handleCommentUpdated(payload: CommentPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("comment:updated", payload);
  }

  @OnEvent("comment.deleted")
  handleCommentDeleted(payload: CommentDeletedPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("comment:deleted", payload);
  }

  @OnEvent("task.created")
  handleTaskCreated(payload: TaskPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("task:created", payload);
  }

  @OnEvent("task.updated")
  handleTaskUpdated(payload: TaskPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("task:updated", payload);
  }

  @OnEvent("task.deleted")
  handleTaskDeleted(payload: TaskDeletedPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("task:deleted", payload);
  }

  @OnEvent("task.status-changed")
  handleTaskStatusChanged(payload: TaskStatusPayload): void {
    this.server
      .to(`workspace:${payload.workspaceId}`)
      .emit("task:status-changed", payload);
  }
}
