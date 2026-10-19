import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { WebSocketModule } from "../websocket/websocket.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
  imports: [WorkspacesModule, ActivityModule, WebSocketModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
