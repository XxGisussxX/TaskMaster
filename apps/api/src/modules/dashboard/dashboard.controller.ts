import { Controller, Get, Param } from "@nestjs/common";
import { taskIdParamsSchema } from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import type { AuthUser } from "../auth/types";
import { DashboardService } from "./dashboard.service";

const workspaceIdPipe = new ParseIdPipe(taskIdParamsSchema);

@Controller("workspaces/:workspaceId/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  stats(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dashboardService.stats(workspaceId, user.sub);
  }
}
