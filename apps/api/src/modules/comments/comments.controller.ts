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
  commentIdParamsSchema,
  createCommentSchema,
  taskIdParamsSchema,
  updateCommentSchema,
  workspaceIdParamsSchema,
  type CreateCommentInput,
  type UpdateCommentInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { CommentsService } from "./comments.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const taskIdPipe = new ParseIdPipe(taskIdParamsSchema);
const commentIdPipe = new ParseIdPipe(commentIdParamsSchema);

@Controller("workspaces/:workspaceId/tasks/:taskId/comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("taskId", taskIdPipe) taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.listByTask(workspaceId, taskId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("taskId", taskIdPipe) taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createCommentSchema)) dto: CreateCommentInput,
  ) {
    return this.commentsService.create(workspaceId, taskId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", commentIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateCommentSchema)) dto: UpdateCommentInput,
  ) {
    return this.commentsService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", commentIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.remove(workspaceId, id, user.sub);
  }
}
