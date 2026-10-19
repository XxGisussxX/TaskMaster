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
  assignPermissionGroupMembersSchema,
  createPermissionGroupSchema,
  permissionGroupIdParamsSchema,
  updatePermissionGroupSchema,
  workspaceIdParamsSchema,
  type AssignPermissionGroupMembersInput,
  type CreatePermissionGroupInput,
  type UpdatePermissionGroupInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { PermissionGroupsService } from "./permission-groups.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

@Controller("workspaces/:workspaceId/permission-groups")
export class PermissionGroupsController {
  constructor(private readonly permissionGroups: PermissionGroupsService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionGroups.list(workspaceId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createPermissionGroupSchema))
    input: CreatePermissionGroupInput,
  ) {
    return this.permissionGroups.create(workspaceId, user.sub, input);
  }

  @Patch(":groupId")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(permissionGroupIdParamsSchema))
    params: {
      groupId: string;
    },
    @Body(new ZodPipe(updatePermissionGroupSchema))
    input: UpdatePermissionGroupInput,
  ) {
    return this.permissionGroups.update(
      workspaceId,
      user.sub,
      params.groupId,
      input,
    );
  }

  @Delete(":groupId")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(permissionGroupIdParamsSchema))
    params: {
      groupId: string;
    },
  ) {
    return this.permissionGroups.remove(workspaceId, user.sub, params.groupId);
  }

  @Post(":groupId/members")
  assignMembers(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(permissionGroupIdParamsSchema))
    params: {
      groupId: string;
    },
    @Body(new ZodPipe(assignPermissionGroupMembersSchema))
    input: AssignPermissionGroupMembersInput,
  ) {
    return this.permissionGroups.assignMembers(
      workspaceId,
      user.sub,
      params.groupId,
      input.memberIds,
    );
  }
}
