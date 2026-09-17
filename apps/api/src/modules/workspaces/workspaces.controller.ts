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
  acceptInviteSchema,
  createWorkspaceSchema,
  inviteIdParamsSchema,
  inviteMemberSchema,
  taskIdParamsSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
  workspaceIdParamsSchema,
  type AcceptInviteInput,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type UpdateWorkspaceInput,
} from "@taskmaster/contracts";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { WorkspacesService } from "./workspaces.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const memberIdPipe = new ParseIdPipe(taskIdParamsSchema);
const inviteIdPipe = new ParseIdPipe(inviteIdParamsSchema);

@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspacesService.listForUser(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createWorkspaceSchema)) dto: CreateWorkspaceInput,
  ) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get(":id")
  get(@Param("id", workspaceIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.workspacesService.get(id, user.sub);
  }

  @Patch(":id")
  update(
    @Param("id", workspaceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateWorkspaceSchema)) dto: UpdateWorkspaceInput,
  ) {
    return this.workspacesService.update(id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("id", workspaceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.remove(id, user.sub);
  }

  @Get(":id/members")
  members(
    @Param("id", workspaceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.members(id, user.sub);
  }

  @Post(":id/invites")
  invite(
    @Param("id", workspaceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(inviteMemberSchema)) dto: InviteMemberInput,
  ) {
    return this.workspacesService.invite(id, user.sub, dto);
  }

  @Get(":id/invites")
  pendingInvites(
    @Param("id", workspaceIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.pendingInvites(id, user.sub);
  }

  @Post(":id/invites/:inviteId/resend")
  resendInvite(
    @Param("id", workspaceIdPipe) id: string,
    @Param("inviteId", inviteIdPipe) inviteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.resendInvite(id, inviteId, user.sub);
  }

  @Delete(":id/invites/:inviteId")
  revokeInvite(
    @Param("id", workspaceIdPipe) id: string,
    @Param("inviteId", inviteIdPipe) inviteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.revokeInvite(id, inviteId, user.sub);
  }

  @Public()
  @Get("invites/:token")
  invitePreview(@Param("token") token: string) {
    return this.workspacesService.invitePreview(token);
  }

  @Patch(":id/members/:memberId")
  updateMemberRole(
    @Param("id", workspaceIdPipe) id: string,
    @Param("memberId", memberIdPipe) memberId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateMemberRoleSchema)) dto: UpdateMemberRoleInput,
  ) {
    return this.workspacesService.updateMemberRole(id, memberId, user.sub, dto);
  }

  @Delete(":id/members/:memberId")
  removeMember(
    @Param("id", workspaceIdPipe) id: string,
    @Param("memberId", memberIdPipe) memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workspacesService.removeMember(id, memberId, user.sub);
  }

  @Post("invites/accept")
  acceptInvite(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(acceptInviteSchema)) dto: AcceptInviteInput,
  ) {
    return this.workspacesService.acceptInvite(user.sub, dto);
  }
}
