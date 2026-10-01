import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { DueSoonService } from "./due-soon.service";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [WebSocketModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DueSoonService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
