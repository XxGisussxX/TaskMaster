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
  createReminderSchema,
  reminderFiltersSchema,
  taskIdParamsSchema,
  updateReminderSchema,
  type CreateReminderInput,
  type ReminderFilters,
  type UpdateReminderInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { RemindersService } from "./reminders.service";

const workspaceIdPipe = new ParseIdPipe(taskIdParamsSchema);
const reminderIdPipe = new ParseIdPipe(taskIdParamsSchema);

@Controller("workspaces/:workspaceId/reminders")
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(reminderFiltersSchema)) filters: ReminderFilters,
  ) {
    return this.remindersService.list(workspaceId, user.sub, filters);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createReminderSchema)) dto: CreateReminderInput,
  ) {
    return this.remindersService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", reminderIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateReminderSchema)) dto: UpdateReminderInput,
  ) {
    return this.remindersService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", reminderIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.remindersService.remove(workspaceId, id, user.sub);
  }
}
