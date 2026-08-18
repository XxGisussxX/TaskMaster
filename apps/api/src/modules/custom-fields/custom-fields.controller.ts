import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  createCustomFieldDefinitionSchema,
  customFieldDefinitionIdParamsSchema,
  customFieldValueFiltersSchema,
  setCustomFieldValueSchema,
  updateCustomFieldDefinitionSchema,
  type CreateCustomFieldDefinitionInput,
  type SetCustomFieldValueInput,
  type UpdateCustomFieldDefinitionInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { CustomFieldsService } from "./custom-fields.service";

const workspaceIdPipe = new ParseIdPipe(customFieldDefinitionIdParamsSchema);
const definitionIdPipe = new ParseIdPipe(customFieldDefinitionIdParamsSchema);

@Controller("workspaces/:workspaceId/custom-fields")
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  listDefinitions(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customFieldsService.listDefinitions(workspaceId, user.sub);
  }

  @Post()
  createDefinition(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createCustomFieldDefinitionSchema))
    dto: CreateCustomFieldDefinitionInput,
  ) {
    return this.customFieldsService.createDefinition(
      workspaceId,
      user.sub,
      dto,
    );
  }

  @Patch(":id")
  updateDefinition(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", definitionIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateCustomFieldDefinitionSchema))
    dto: UpdateCustomFieldDefinitionInput,
  ) {
    return this.customFieldsService.updateDefinition(
      workspaceId,
      user.sub,
      id,
      dto,
    );
  }

  @Delete(":id")
  removeDefinition(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", definitionIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customFieldsService.removeDefinition(workspaceId, user.sub, id);
  }

  @Put("values")
  setValue(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(setCustomFieldValueSchema))
    dto: SetCustomFieldValueInput,
  ) {
    return this.customFieldsService.setValue(workspaceId, user.sub, dto);
  }

  @Get("values")
  getValues(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(customFieldValueFiltersSchema))
    query: { entityType: string; entityId: string },
  ) {
    return this.customFieldsService.getValues(
      workspaceId,
      user.sub,
      query.entityType,
      query.entityId,
    );
  }
}
