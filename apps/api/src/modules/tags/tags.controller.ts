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
  createTagSchema,
  tagIdParamsSchema,
  updateTagSchema,
  type CreateTagInput,
  type UpdateTagInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { TagsService } from "./tags.service";

const workspaceIdPipe = new ParseIdPipe(tagIdParamsSchema);
const tagIdPipe = new ParseIdPipe(tagIdParamsSchema);

@Controller("workspaces/:workspaceId/tags")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tagsService.list(workspaceId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTagSchema)) dto: CreateTagInput,
  ) {
    return this.tagsService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", tagIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateTagSchema)) dto: UpdateTagInput,
  ) {
    return this.tagsService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", tagIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tagsService.remove(workspaceId, id, user.sub);
  }
}
