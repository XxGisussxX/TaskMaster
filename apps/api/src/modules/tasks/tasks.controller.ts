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
  TaskStatus,
  bulkDeleteSchema,
  bulkUpdatePrioritySchema,
  bulkUpdateStatusSchema,
  createSubtaskSchema,
  createTaskSchema,
  setTaskStatusSchema,
  taskFiltersSchema,
  taskIdParamsSchema,
  updateTaskSchema,
  workspaceIdParamsSchema,
  type BulkDeleteInput,
  type BulkUpdatePriorityInput,
  type BulkUpdateStatusInput,
  type CreateSubtaskInput,
  type CreateTaskInput,
  type TaskFilters,
  type UpdateTaskInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { TasksService } from "./tasks.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const taskIdPipe = new ParseIdPipe(taskIdParamsSchema);

@Controller("workspaces/:workspaceId/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Query(new ZodPipe(taskFiltersSchema)) filters: TaskFilters,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.list(workspaceId, user.sub, filters);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTaskSchema)) dto: CreateTaskInput,
  ) {
    return this.tasksService.create(workspaceId, user.sub, dto);
  }

  @Post("bulk/status")
  bulkUpdateStatus(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(bulkUpdateStatusSchema)) dto: BulkUpdateStatusInput,
  ) {
    return this.tasksService.bulkUpdateStatus(
      workspaceId,
      user.sub,
      dto.ids,
      dto.status,
    );
  }

  @Post("bulk/priority")
  bulkUpdatePriority(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(bulkUpdatePrioritySchema)) dto: BulkUpdatePriorityInput,
  ) {
    return this.tasksService.bulkUpdatePriority(
      workspaceId,
      user.sub,
      dto.ids,
      dto.priority,
    );
  }

  @Post("bulk/delete")
  bulkDelete(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(bulkDeleteSchema)) dto: BulkDeleteInput,
  ) {
    return this.tasksService.bulkDelete(workspaceId, user.sub, dto.ids);
  }

  @Get(":id")
  get(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", taskIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.get(workspaceId, id, user.sub);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", taskIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateTaskSchema)) dto: UpdateTaskInput,
  ) {
    return this.tasksService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", taskIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasksService.remove(workspaceId, id, user.sub);
  }

  @Post(":id/status")
  setStatus(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", taskIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(setTaskStatusSchema)) dto: { status: TaskStatus },
  ) {
    return this.tasksService.setStatus(workspaceId, id, user.sub, dto.status);
  }

  @Post(":id/subtasks")
  addSubtask(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", taskIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createSubtaskSchema)) dto: CreateSubtaskInput,
  ) {
    return this.tasksService.addSubtask(workspaceId, id, user.sub, dto);
  }
}
