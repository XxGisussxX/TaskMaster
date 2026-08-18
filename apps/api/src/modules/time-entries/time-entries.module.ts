import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
