import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { WebSocketModule } from "../websocket/websocket.module";

@Module({
  imports: [WorkspacesModule, ActivityModule, WebSocketModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
