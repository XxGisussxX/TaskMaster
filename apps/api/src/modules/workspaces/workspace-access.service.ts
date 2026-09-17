import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { UnscopedPrismaService } from "../../prisma/prisma.service";
import { tenantContext, type TenantContext } from "../../tenant/tenant-context";
import type { WorkspaceMemberWithUser } from "./workspaces.types";

/** Rol mínimo para operaciones de escritura dentro de un workspace. */
export const MIN_WRITE_ROLE = WorkspaceRole.MEMBER;

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: UnscopedPrismaService) {}

  /**
   * Devuelve el contexto de tenant si coincide con el workspace pedido. Cuando
   * existe, la membresía ya fue validada por `TenantInterceptor`, por lo que
   * podemos resolver rol y pertenencia sin tocar la DB.
   */
  private contextFor(workspaceId: string): TenantContext | undefined {
    const context = tenantContext.get();
    if (!context || context.workspaceId !== workspaceId) return undefined;
    return context;
  }

  private memberFromContext(context: TenantContext): WorkspaceMemberWithUser {
    return {
      id: "",
      workspaceId: context.workspaceId,
      userId: context.userId,
      role: context.role,
      createdAt: new Date(0),
    };
  }

  /** Devuelve la membresía o lanza error si el workspace no existe o no eres miembro. */
  async assertMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberWithUser> {
    const context = this.contextFor(workspaceId);
    if (context) return this.memberFromContext(context);

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });

    if (!member) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) {
        throw new NotFoundException("Workspace no encontrado");
      }
      throw new ForbiddenException("No eres miembro de este workspace");
    }

    return member;
  }

  /** Valida que el rol del usuario sea >= al mínimo requerido. */
  async assertRole(
    workspaceId: string,
    userId: string,
    minRole: WorkspaceRole,
  ): Promise<WorkspaceMemberWithUser> {
    const context = this.contextFor(workspaceId);
    if (context) {
      if (ROLE_WEIGHT[context.role] < ROLE_WEIGHT[minRole]) {
        throw new ForbiddenException("No tienes permisos para esta acción");
      }
      return this.memberFromContext(context);
    }

    const member = await this.assertMembership(workspaceId, userId);
    if (ROLE_WEIGHT[member.role] < ROLE_WEIGHT[minRole]) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }
    return member;
  }

  /** Bloquea escrituras para VIEWER dentro del workspace. */
  assertWriteRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberWithUser> {
    return this.assertRole(workspaceId, userId, MIN_WRITE_ROLE);
  }
}
