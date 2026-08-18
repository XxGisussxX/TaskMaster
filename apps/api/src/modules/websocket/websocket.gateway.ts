import { Logger, OnModuleInit } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  WebSocketGateway as WsGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { OnEvent } from "@nestjs/event-emitter";
import type { Server, Socket } from "socket.io";

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
  cors: {
    origin: process.env.API_ORIGINS?.split(",").map((s) => s.trim()) ?? "*",
    credentials: true,
  },
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

  constructor(private readonly jwt: JwtService) {}

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

  handleJoinWorkspace(client: Socket, data: { workspaceId: string }): void {
    const userId = this.socketUser.get(client.id);
    if (!userId) return;
    client.join(`workspace:${data.workspaceId}`);
  }

  handleLeaveWorkspace(client: Socket, data: { workspaceId: string }): void {
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
