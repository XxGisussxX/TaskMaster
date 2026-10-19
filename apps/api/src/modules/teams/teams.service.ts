import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import type {
  CreateTeamInput,
  TeamMemberSummary,
  TeamWithMembers,
  UpdateTeamInput,
} from "@taskmaster/contracts";

const MEMBERS_INCLUDE = {
  teamMembers: {
    include: {
      workspaceMember: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async getTeams(workspaceId: string, userId: string) {
    await this.access.assertMembership(workspaceId, userId);
    const teams = await this.prisma.team.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: MEMBERS_INCLUDE,
    });
    return teams.map((team) => this.toDto(team));
  }

  async getTeam(workspaceId: string, userId: string, teamId: string) {
    await this.access.assertMembership(workspaceId, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
      include: MEMBERS_INCLUDE,
    });
    if (!team) throw new NotFoundException("Equipo no encontrado");
    return this.toDto(team);
  }

  async createTeam(
    workspaceId: string,
    userId: string,
    input: CreateTeamInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    const team = await this.prisma.team.create({
      data: { workspaceId, ...input },
      include: MEMBERS_INCLUDE,
    });
    return this.toDto(team);
  }

  async updateTeam(
    workspaceId: string,
    userId: string,
    teamId: string,
    input: UpdateTeamInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureTeamExists(workspaceId, teamId);
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: input,
      include: MEMBERS_INCLUDE,
    });
    return this.toDto(team);
  }

  async deleteTeam(workspaceId: string, userId: string, teamId: string) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureTeamExists(workspaceId, teamId);
    await this.prisma.team.delete({ where: { id: teamId } });
    return { success: true };
  }

  async assignMembers(
    workspaceId: string,
    userId: string,
    teamId: string,
    memberIds: string[],
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureTeamExists(workspaceId, teamId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: memberIds } },
      select: { id: true, userId: true },
    });
    if (members.length !== memberIds.length) {
      throw new NotFoundException(
        "Alguno de los miembros no existe en este workspace",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({ where: { teamId } });
      await tx.teamMember.createMany({
        data: members.map((m) => ({
          teamId,
          workspaceMemberId: m.id,
        })),
        skipDuplicates: true,
      });
    });

    return this.getTeam(workspaceId, userId, teamId);
  }

  private toDto(team: {
    id: string;
    workspaceId: string;
    name: string;
    description: string;
    color: string;
    avatar: string | null;
    teamMembers: {
      workspaceMemberId: string;
      workspaceMember: {
        userId: string;
        user: {
          id: string;
          name: string;
          email: string;
          avatarUrl: string | null;
        };
      };
    }[];
  }): TeamWithMembers {
    return {
      id: team.id,
      workspaceId: team.workspaceId,
      name: team.name,
      description: team.description,
      color: team.color,
      avatar: team.avatar,
      members: team.teamMembers.map((m): TeamMemberSummary => ({
        memberId: m.workspaceMemberId,
        userId: m.workspaceMember.userId,
        name: m.workspaceMember.user.name,
        email: m.workspaceMember.user.email,
        avatarUrl: m.workspaceMember.user.avatarUrl,
      })),
    };
  }

  private async ensureTeamExists(workspaceId: string, teamId: string) {
    const exists = await this.prisma.team.count({
      where: { id: teamId, workspaceId },
    });
    if (exists === 0) throw new NotFoundException("Equipo no encontrado");
  }
}
