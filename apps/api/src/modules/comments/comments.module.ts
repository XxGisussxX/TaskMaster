import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [WorkspacesModule, NotificationsModule, WebSocketModule],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
