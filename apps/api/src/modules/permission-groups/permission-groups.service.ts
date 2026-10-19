import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import type {
  CreatePermissionGroupInput,
  UpdatePermissionGroupInput,
} from "@taskmaster/contracts";

const MEMBERS_INCLUDE = {
  members: {
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
export class PermissionGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.access.assertMembership(workspaceId, userId);
    const groups = await this.prisma.permissionGroup.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: MEMBERS_INCLUDE,
    });
    return groups.map((group) => this.toDto(group));
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreatePermissionGroupInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    const group = await this.prisma.permissionGroup.create({
      data: { workspaceId, ...input },
      include: MEMBERS_INCLUDE,
    });
    return this.toDto(group);
  }

  async update(
    workspaceId: string,
    userId: string,
    groupId: string,
    input: UpdatePermissionGroupInput,
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureExists(workspaceId, groupId);
    const group = await this.prisma.permissionGroup.update({
      where: { id: groupId },
      data: input,
      include: MEMBERS_INCLUDE,
    });
    return this.toDto(group);
  }

  async remove(workspaceId: string, userId: string, groupId: string) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureExists(workspaceId, groupId);
    await this.prisma.permissionGroup.delete({ where: { id: groupId } });
    return { success: true };
  }

  async assignMembers(
    workspaceId: string,
    userId: string,
    groupId: string,
    memberIds: string[],
  ) {
    await this.access.assertWriteRole(workspaceId, userId);
    await this.ensureExists(workspaceId, groupId);

    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, userId: { in: memberIds } },
      select: { id: true },
    });
    if (members.length !== memberIds.length) {
      throw new NotFoundException(
        "Alguno de los miembros no existe en este workspace",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.permissionGroupMember.deleteMany({ where: { groupId } });
      await tx.permissionGroupMember.createMany({
        data: members.map((m) => ({
          groupId,
          workspaceMemberId: m.id,
        })),
        skipDuplicates: true,
      });
    });

    const group = await this.prisma.permissionGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: MEMBERS_INCLUDE,
    });
    return this.toDto(group);
  }

  private async ensureExists(workspaceId: string, groupId: string) {
    const exists = await this.prisma.permissionGroup.count({
      where: { id: groupId, workspaceId },
    });
    if (exists === 0) throw new NotFoundException("Grupo no encontrado");
  }

  private toDto(group: {
    id: string;
    workspaceId: string;
    name: string;
    description: string;
    color: string;
    role: string;
    members: {
      workspaceMemberId: string;
      workspaceMember: {
        userId: string;
        role: string;
        user: {
          id: string;
          name: string;
          email: string;
          avatarUrl: string | null;
        };
      };
    }[];
  }) {
    return {
      id: group.id,
      workspaceId: group.workspaceId,
      name: group.name,
      description: group.description,
      color: group.color,
      role: group.role,
      members: group.members.map((m) => ({
        memberId: m.workspaceMemberId,
        userId: m.workspaceMember.userId,
        name: m.workspaceMember.user.name,
        email: m.workspaceMember.user.email,
        avatarUrl: m.workspaceMember.user.avatarUrl,
        workspaceRole: m.workspaceMember.role,
      })),
    };
  }
}
