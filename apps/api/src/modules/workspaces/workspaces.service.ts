import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "node:crypto";
import {
  WorkspaceRole,
  type AcceptInviteInput,
  type CreateWorkspaceInput,
  type Invite,
  type InviteMemberInput,
  type InvitePreview,
  type UpdateMemberRoleInput,
  type UpdateWorkspaceInput,
  type Workspace,
  type WorkspaceMember,
} from "@taskmaster/contracts";
import { UnscopedPrismaService } from "../../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuthService } from "../auth/auth.service";
import { WorkspaceAccessService } from "./workspace-access.service";
import type { WorkspaceMemberWithUser } from "./workspaces.types";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: UnscopedPrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
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
  ): Promise<{ id: string }> {
    const actor = await this.access.assertRole(
      workspaceId,
      userId,
      WorkspaceRole.ADMIN,
    );

    // Solo el propietario puede invitar con rol de propietario: un ADMIN no debe
    // poder crear un par OWNER (ni escalar por esa vía).
    if (
      dto.role === WorkspaceRole.OWNER &&
      actor.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException(
        "Solo el propietario puede invitar con el rol de propietario",
      );
    }

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

    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const existingPending = await this.prisma.invite.findFirst({
      where: { workspaceId, email: dto.email, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const token = randomBytes(24).toString("base64url");
    const tokenHash = this.hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    let inviteId: string;
    if (existingPending) {
      await this.prisma.invite.update({
        where: { id: existingPending.id },
        data: { tokenHash, expiresAt, role: dto.role, invitedById: userId },
      });
      inviteId = existingPending.id;
    } else {
      const invite = await this.prisma.invite.create({
        data: {
          workspaceId,
          email: dto.email,
          role: dto.role,
          tokenHash,
          expiresAt,
          invitedById: userId,
        },
      });
      inviteId = invite.id;
    }

    const { sent, inviteUrl } = await this.sendInviteEmail({
      inviteId,
      token,
      to: dto.email,
      workspaceId,
      inviterName: inviter.name,
    });

    return this.inviteResult(inviteId, sent, inviteUrl);
  }

  async invitePreview(token: string): Promise<InvitePreview> {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: this.hashInviteToken(token) },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      throw new NotFoundException("Invitación no encontrada");
    }

    return {
      workspaceName: invite.workspace.name,
      inviterName: invite.invitedBy?.name ?? "Alguien de TaskMaster",
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      accepted: Boolean(invite.acceptedAt),
    };
  }

  async pendingInvites(workspaceId: string, userId: string): Promise<Invite[]> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);
    const invites = await this.prisma.invite.findMany({
      where: { workspaceId, acceptedAt: null },
      include: {
        invitedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return invites.map((invite) => this.toInviteDto(invite));
  }

  async resendInvite(
    workspaceId: string,
    inviteId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);

    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { id: true, name: true } },
      },
    });
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new NotFoundException("Invitación no encontrada");
    }
    if (invite.acceptedAt) {
      throw new BadRequestException("La invitación ya fue usada");
    }

    const inviter = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { tokenHash: this.hashInviteToken(token), expiresAt, invitedById: userId },
    });

    const { sent, inviteUrl } = await this.sendInviteEmail({
      inviteId,
      token,
      to: invite.email,
      workspaceId,
      inviterName: inviter.name,
    });

    return this.inviteResult(inviteId, sent, inviteUrl);
  }

  async revokeInvite(
    workspaceId: string,
    inviteId: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertRole(workspaceId, userId, WorkspaceRole.ADMIN);

    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!invite || invite.workspaceId !== workspaceId) {
      throw new NotFoundException("Invitación no encontrada");
    }

    await this.prisma.invite.delete({ where: { id: inviteId } });
    return { id: inviteId };
  }

  async acceptInvite(
    userId: string,
    dto: AcceptInviteInput,
  ): Promise<Workspace> {
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash: this.hashInviteToken(dto.token) },
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

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: invite.workspaceId, userId },
      },
    });

    if (existingMember) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    } else {
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
    }

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
    const actor = await this.access.assertRole(
      workspaceId,
      userId,
      WorkspaceRole.ADMIN,
    );

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

    // Solo el propietario puede tocar a un ADMIN, para evitar que dos ADMIN se
    // degraden entre sí (misma regla que el rol de plataforma).
    if (
      member.role === WorkspaceRole.ADMIN &&
      actor.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException(
        "Solo el propietario puede modificar a un administrador",
      );
    }

    // Un ADMIN no debe poder elevar a nadie (ni a sí mismo) a propietario.
    if (
      dto.role === WorkspaceRole.OWNER &&
      actor.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException(
        "Solo el propietario puede asignar el rol de propietario",
      );
    }

    const updated = await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    // Un cambio de rol (p. ej. democión) invalida las sesiones activas del afectado
    // para forzar re-login con los nuevos permisos. La autorización de workspace ya
    // se valida contra la DB por request, esto es net: cierre de sesión del usuario.
    await this.auth.revokeUserTokens(updated.userId);

    return updated;
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    userId: string,
  ): Promise<{ id: string }> {
    const actor = await this.access.assertRole(
      workspaceId,
      userId,
      WorkspaceRole.ADMIN,
    );

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

    // Solo el propietario puede eliminar a un ADMIN (evita que dos ADMIN se
    // expulsen entre sí).
    if (
      member.role === WorkspaceRole.ADMIN &&
      actor.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException(
        "Solo el propietario puede eliminar a un administrador",
      );
    }

    await this.prisma.workspaceMember.delete({ where: { id: memberId } });
    return { id: memberId };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async sendInviteEmail(input: {
    inviteId: string;
    token: string;
    to: string;
    workspaceId: string;
    inviterName: string;
  }): Promise<{ sent: boolean; inviteUrl: string }> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
      select: { id: true, name: true },
    });
    const webUrl =
      this.config.get<string>("WEB_URL") ?? "http://localhost:5173";
    const inviteUrl = `${webUrl.replace(/\/+$/, "")}/invite/${input.token}`;

    const { sent } = await this.mail.sendInvite({
      to: input.to,
      workspaceName: workspace.name,
      inviterName: input.inviterName,
      inviteUrl,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    return { sent, inviteUrl };
  }

  /** Expone el link de invitación solo en dev y cuando no se pudo enviar email. */
  private inviteResult(
    inviteId: string,
    sent: boolean,
    inviteUrl: string,
  ): { id: string; emailSent: boolean; inviteUrl?: string } {
    const { isConfigured, isDev } = this.mail.emailConfig();
    if (!sent || (!isConfigured && isDev)) {
      return { id: inviteId, emailSent: sent, inviteUrl };
    }
    return { id: inviteId, emailSent: sent };
  }

  private toInviteDto(invite: {
    id: string;
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    invitedBy: { id: string; name: string } | null;
    expiresAt: Date;
    createdAt: Date;
  }): Invite {
    return {
      id: invite.id,
      workspaceId: invite.workspaceId,
      email: invite.email,
      role: invite.role,
      invitedBy: invite.invitedBy
        ? { id: invite.invitedBy.id, name: invite.invitedBy.name }
        : null,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
    };
  }

  /**
   * El token en claro viaja únicamente por el email; la DB guarda el hash.
   * Mismo algoritmo que la migración 20261001000000 (SHA-256 hex en minúsculas).
   */
  private hashInviteToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

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
