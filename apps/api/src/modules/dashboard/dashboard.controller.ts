import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  dashboardQuerySchema,
  workspaceIdParamsSchema,
  type DashboardQuery,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { DashboardService } from "./dashboard.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

@Controller("workspaces/:workspaceId/dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  stats(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(dashboardQuerySchema)) query: DashboardQuery,
  ) {
    return this.dashboardService.stats(workspaceId, user.sub, query);
  }
}
