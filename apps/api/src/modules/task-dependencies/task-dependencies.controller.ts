import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import {
  createTaskDependencySchema,
  taskDependencyIdParamsSchema,
  type CreateTaskDependencyInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { TaskDependenciesService } from "./task-dependencies.service";

const workspaceIdPipe = new ParseIdPipe(taskDependencyIdParamsSchema);
const dependencyIdPipe = new ParseIdPipe(taskDependencyIdParamsSchema);

@Controller("workspaces/:workspaceId/dependencies")
export class TaskDependenciesController {
  constructor(private readonly depsService: TaskDependenciesService) {}

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTaskDependencySchema))
    dto: CreateTaskDependencyInput,
  ) {
    return this.depsService.create(workspaceId, user.sub, dto);
  }

  @Get()
  listByTask(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query("taskId") taskId: string,
  ) {
    return this.depsService.listByTask(workspaceId, user.sub, taskId);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", dependencyIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.depsService.remove(workspaceId, user.sub, id);
  }
}
