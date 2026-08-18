import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  createTimeEntrySchema,
  timeEntryFiltersSchema,
  timeEntryIdParamsSchema,
  updateTimeEntrySchema,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
  type TimeEntryFilters,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { TimeEntriesService } from "./time-entries.service";

const workspaceIdPipe = new ParseIdPipe(timeEntryIdParamsSchema);
const entryIdPipe = new ParseIdPipe(timeEntryIdParamsSchema);

@Controller("workspaces/:workspaceId/time-entries")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(timeEntryFiltersSchema)) filters: TimeEntryFilters,
  ) {
    return this.timeEntriesService.list(workspaceId, user.sub, filters);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTimeEntrySchema)) dto: CreateTimeEntryInput,
  ) {
    return this.timeEntriesService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id/stop")
  stop(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", entryIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timeEntriesService.stop(workspaceId, user.sub, id);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", entryIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateTimeEntrySchema)) dto: UpdateTimeEntryInput,
  ) {
    return this.timeEntriesService.update(workspaceId, user.sub, id, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", entryIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.timeEntriesService.remove(workspaceId, user.sub, id);
  }
}
