import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import {
  createTeamSchema,
  updateTeamSchema,
  teamIdParamsSchema,
  assignTeamMembersSchema,
  workspaceIdParamsSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
  type AssignTeamMembersInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import type { AuthUser } from "../auth/types";
import { TeamsService } from "./teams.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

@Controller("workspaces/:workspaceId/teams")
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  getTeams(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.getTeams(workspaceId, user.sub);
  }

  @Get(":teamId")
  getTeam(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(teamIdParamsSchema)) params: { teamId: string },
  ) {
    return this.teamsService.getTeam(workspaceId, user.sub, params.teamId);
  }

  @Post()
  createTeam(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createTeamSchema)) input: CreateTeamInput,
  ) {
    return this.teamsService.createTeam(workspaceId, user.sub, input);
  }

  @Patch(":teamId")
  updateTeam(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(teamIdParamsSchema)) params: { teamId: string },
    @Body(new ZodPipe(updateTeamSchema)) input: UpdateTeamInput,
  ) {
    return this.teamsService.updateTeam(
      workspaceId,
      user.sub,
      params.teamId,
      input,
    );
  }

  @Delete(":teamId")
  deleteTeam(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(teamIdParamsSchema)) params: { teamId: string },
  ) {
    return this.teamsService.deleteTeam(workspaceId, user.sub, params.teamId);
  }

  @Post(":teamId/members")
  assignMembers(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Param(new ZodPipe(teamIdParamsSchema)) params: { teamId: string },
    @Body(new ZodPipe(assignTeamMembersSchema)) input: AssignTeamMembersInput,
  ) {
    return this.teamsService.assignMembers(
      workspaceId,
      user.sub,
      params.teamId,
      input.memberIds,
    );
  }
}
