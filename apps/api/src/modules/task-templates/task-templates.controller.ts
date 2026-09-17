import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createTaskTemplateSchema,
  taskTemplateIdParamsSchema,
  updateTaskTemplateSchema,
  workspaceIdParamsSchema,
  type CreateTaskTemplateInput,
  type UpdateTaskTemplateInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { TaskTemplatesService } from "./task-templates.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const templateIdPipe = new ParseIdPipe(taskTemplateIdParamsSchema);

@Controller("workspaces/:workspaceId/templates")
export class TaskTemplatesController {
  constructor(private readonly taskTemplatesService: TaskTemplatesService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskTemplatesService.list(workspaceId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTaskTemplateSchema)) dto: CreateTaskTemplateInput,
  ) {
    return this.taskTemplatesService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", templateIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateTaskTemplateSchema)) dto: UpdateTaskTemplateInput,
  ) {
    return this.taskTemplatesService.update(workspaceId, user.sub, id, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", templateIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskTemplatesService.remove(workspaceId, user.sub, id);
  }

  @Post(":id/use")
  useTemplate(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", templateIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskTemplatesService.useTemplate(workspaceId, user.sub, id);
  }
}
