import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  SystemRole,
  type UpdateSystemRoleInput,
  type User,
} from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";

/**
 * Jerarquía de asignación de roles de plataforma: solo SUPER_ADMIN puede otorgar
 * SUPER_ADMIN; un ADMIN como máximo otorga ADMIN. Así se impide la promoción en
 * cadena entre dos ADMINS. Nadie puede cambiarse el rol a sí mismo.
 */
const ROLE_ASSIGNMENT_RANK: Record<SystemRole, number> = {
  USER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  isEmailVerified: boolean;
  createdAt: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async listUsers(
    page: number,
    pageSize: number,
  ): Promise<{ items: AdminUserRow[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isEmailVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  }

  async updateRole(
    actorId: string,
    targetId: string,
    dto: UpdateSystemRoleInput,
  ): Promise<User> {
    if (actorId === targetId) {
      throw new BadRequestException(
        "No puedes cambiar tu propio rol de plataforma",
      );
    }

    const [actor, target] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: actorId },
        select: { role: true },
      }),
      this.prisma.user.findUnique({ where: { id: targetId } }),
    ]);

    if (!target) {
      throw new NotFoundException("Usuario no encontrado");
    }
    if (!actor) {
      throw new NotFoundException("Usuario solicitante no encontrado");
    }

    if (ROLE_ASSIGNMENT_RANK[dto.role] > ROLE_ASSIGNMENT_RANK[actor.role]) {
      throw new ForbiddenException(
        "Tu rol no permite asignar ese rol: solo un SUPER_ADMIN puede otorgar SUPER_ADMIN",
      );
    }

    // Solo un SUPER_ADMIN puede modificar el rol de otro ADMIN o SUPER_ADMIN.
    // Esto evita que dos ADMIN se degraden mutuamente.
    const isPrivilegedTarget =
      target.role === SystemRole.ADMIN ||
      target.role === SystemRole.SUPER_ADMIN;
    if (isPrivilegedTarget && actor.role !== SystemRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Solo un SUPER_ADMIN puede modificar el rol de un ADMIN",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.role },
    });

    await this.auth.revokeUserTokens(targetId);

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
      isEmailVerified: updated.isEmailVerified,
      hasPassword: !!updated.passwordHash,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
