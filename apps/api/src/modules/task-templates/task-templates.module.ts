import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { TaskTemplatesController } from "./task-templates.controller";
import { TaskTemplatesService } from "./task-templates.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [TaskTemplatesController],
  providers: [TaskTemplatesService],
  exports: [TaskTemplatesService],
})
export class TaskTemplatesModule {}
