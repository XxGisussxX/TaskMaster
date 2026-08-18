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
  categoryIdParamsSchema,
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { CategoriesService } from "./categories.service";

const workspaceIdPipe = new ParseIdPipe(categoryIdParamsSchema);
const categoryIdPipe = new ParseIdPipe(categoryIdParamsSchema);

@Controller("workspaces/:workspaceId/categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categoriesService.list(workspaceId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createCategorySchema)) dto: CreateCategoryInput,
  ) {
    return this.categoriesService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", categoryIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateCategorySchema)) dto: UpdateCategoryInput,
  ) {
    return this.categoriesService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", categoryIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.categoriesService.remove(workspaceId, id, user.sub);
  }
}
