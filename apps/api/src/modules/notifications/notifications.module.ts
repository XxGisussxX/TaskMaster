import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { DueSoonService } from "./due-soon.service";
import { WeeklyDigestService } from "./weekly-digest.service";
import { WebSocketModule } from "../websocket/websocket.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [WebSocketModule, MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, DueSoonService, WeeklyDigestService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
