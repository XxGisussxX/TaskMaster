import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  WorkspaceRole,
  type AcceptInviteInput,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type UpdateWorkspaceInput,
  type Workspace,
  type WorkspaceMember,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "./workspace-access.service";
import type { WorkspaceMemberWithUser } from "./workspaces.types";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {}

  async listForUser(userId: string): Promise<Workspace[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: { members: { include: { user: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => this.toWorkspaceDto(m.workspace));
  }

  async get(workspaceId: string, userId: string): Promise<Workspace> {
    await this.access.assertMembership(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });
    return this.toWorkspaceDto(workspace);
  }

  async create(userId: string, dto: CreateWorkspaceInput): Promise<Workspace> {
    const slug = await this.uniqueSlug(dto.slug ?? this.slugify(dto.name));

    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug,
        icon: dto.icon,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
      include: { members: { include: { user: true } } },
    });

    return this.toWorkspaceDto(workspace);
  }

  async update(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
        icon: dto.icon,
      },
      include: { members: { include: { user: true } } },
    });
    return this.toWorkspaceDto(workspace);
  }

  async remove(workspaceId: string, userId: string): Promise<{ id: string }> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.OWNER);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    return { id: workspaceId };
  }

  async members(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberWithUser[]> {
    await this.access.assertMembership(workspaceId, userId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(
    workspaceId: string,
    userId: string,
    dto: InviteMemberInput,
  ): Promise<{ token: string }> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: existingUser.id },
        },
      });
      if (existingMember) {
        throw new ConflictException("El usuario ya es miembro del workspace");
      }
    }

    const token = randomBytes(24).toString("base64url");

    await this.prisma.invite.create({
      data: {
        workspaceId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    return { token };
  }

  async acceptInvite(
    userId: string,
    dto: AcceptInviteInput,
  ): Promise<Workspace> {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.token },
    });

    if (!invite) {
      throw new NotFoundException("Invitación no encontrada");
    }
    if (invite.acceptedAt) {
      throw new BadRequestException("La invitación ya fue usada");
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("La invitación expiró");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.email !== invite.email) {
      throw new ForbiddenException("La invitación fue enviada a otro email");
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
        },
      }),
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: invite.workspaceId },
      include: { members: { include: { user: true } } },
    });
    return this.toWorkspaceDto(workspace);
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberRoleInput,
  ): Promise<WorkspaceMemberWithUser> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException("Miembro no encontrado");
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException(
        "No se puede modificar el rol del propietario",
      );
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);

    const member = await this.prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException("Miembro no encontrado");
    }
    if (member.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException("No se puede eliminar al propietario");
    }
    if (member.userId === userId) {
      throw new ForbiddenException("No puedes eliminarte a ti mismo");
    }

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });
    return { id: memberId };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let n = 2;
    while (true) {
      const existing = await this.prisma.workspace.findUnique({
        where: { slug },
      });
      if (!existing) return slug;
      slug = `${base}-${n}`;
      n += 1;
    }
  }

  private slugify(value: string): string {
    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return normalized.length >= 2 ? normalized : "workspace";
  }

  private toWorkspaceDto(workspace: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    ownerId: string;
    createdAt: Date;
    members: WorkspaceMemberWithUser[];
  }): Workspace {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      icon: workspace.icon,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt.toISOString(),
      members: workspace.members.map((m): WorkspaceMember => ({
        id: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        role: m.role,
        user: m.user
          ? {
              id: m.user.id,
              name: m.user.name,
              email: m.user.email,
              avatarUrl: m.user.avatarUrl,
            }
          : undefined,
      })),
    };
  }
}
