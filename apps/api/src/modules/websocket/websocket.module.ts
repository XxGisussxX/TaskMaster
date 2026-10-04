import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AuthModule } from "../auth/auth.module";
import { EventsService } from "./events.service";
import { PresenceService } from "./presence.service";
import { AppWebSocketGateway } from "./websocket.gateway";

@Module({
  imports: [EventEmitterModule.forRoot(), AuthModule],
  providers: [EventsService, PresenceService, AppWebSocketGateway],
  exports: [EventsService, PresenceService],
})
export class WebSocketModule {}
