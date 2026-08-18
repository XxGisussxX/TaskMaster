import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { TaskDependenciesController } from "./task-dependencies.controller";
import { TaskDependenciesService } from "./task-dependencies.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [TaskDependenciesController],
  providers: [TaskDependenciesService],
  exports: [TaskDependenciesService],
})
export class TaskDependenciesModule {}
