import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [WorkspacesModule, ActivityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
