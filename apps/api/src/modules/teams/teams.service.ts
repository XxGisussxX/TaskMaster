import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import type { CreateTeamInput, UpdateTeamInput } from "@taskmaster/contracts";

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async getTeams(workspaceId: string, userId: string) {
    await this.access.assertMembership(workspaceId, userId);
    return this.prisma.team.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
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
      },
    });
  }

  async getTeam(workspaceId: string, userId: string, teamId: string) {
    await this.access.assertMembership(workspaceId, userId);
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, workspaceId },
      include: {
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
      },
    });
    if (!team) throw new NotFoundException("Equipo no encontrado");
    return team;
  }

  async createTeam(
    workspaceId: string,
    userId: string,
    input: CreateTeamInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    return this.prisma.team.create({
      data: { workspaceId, ...input },
    });
  }

  async updateTeam(
    workspaceId: string,
    userId: string,
    teamId: string,
    input: UpdateTeamInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureTeamExists(workspaceId, teamId);
    return this.prisma.team.update({
      where: { id: teamId },
      data: input,
    });
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

  private async ensureTeamExists(workspaceId: string, teamId: string) {
    const exists = await this.prisma.team.count({
      where: { id: teamId, workspaceId },
    });
    if (exists === 0) throw new NotFoundException("Equipo no encontrado");
  }
}
