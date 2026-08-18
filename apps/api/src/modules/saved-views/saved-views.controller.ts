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
  createSavedViewSchema,
  savedViewIdParamsSchema,
  updateSavedViewSchema,
  type CreateSavedViewInput,
  type UpdateSavedViewInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { SavedViewsService } from "./saved-views.service";

const workspaceIdPipe = new ParseIdPipe(savedViewIdParamsSchema);
const viewIdPipe = new ParseIdPipe(savedViewIdParamsSchema);

@Controller("workspaces/:workspaceId/saved-views")
export class SavedViewsController {
  constructor(private readonly savedViewsService: SavedViewsService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.savedViewsService.list(workspaceId, user.sub);
  }

  @Get(":id")
  get(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", viewIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.savedViewsService.get(workspaceId, id, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createSavedViewSchema)) dto: CreateSavedViewInput,
  ) {
    return this.savedViewsService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", viewIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateSavedViewSchema)) dto: UpdateSavedViewInput,
  ) {
    return this.savedViewsService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", viewIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.savedViewsService.remove(workspaceId, id, user.sub);
  }
}
