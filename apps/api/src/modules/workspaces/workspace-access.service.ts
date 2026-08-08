import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { WorkspaceRole } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import type { WorkspaceMemberWithUser } from "./workspaces.types";

const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve la membresía o lanza error si el workspace no existe o no eres miembro. */
  async assertMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberWithUser> {
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
    const member = await this.assertMembership(workspaceId, userId);
    if (ROLE_WEIGHT[member.role] < ROLE_WEIGHT[minRole]) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }
    return member;
  }
}
