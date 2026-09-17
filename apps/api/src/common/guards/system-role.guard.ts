import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { SystemRole } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { SYSTEM_ROLES_KEY } from "../decorators/require-system-role.decorator";
import type { AuthUser } from "../../modules/auth/types";

/**
 * Guard de rol de plataforma (SystemRole).
 *
 * Decide en contra de confiar en el claim `role` del JWT: consulta la DB en cada
 * invocación, así una democión (p. ej. ADMIN a USER) se refleja de forma inmediata
 * aunque el access token siga sin expirar.
 *
 * Decisión consciente (ver código): no existe blacklist de access tokens. El JWT
 * sigue siendo válido hasta su expiración, pero como este guard valida contra la DB
 * por request, la autorización nunca depende de claims congelados. El access token
 * debe además estar autenticado por JwtAuthGuard antes de llegar aquí.
 */
@Injectable()
export class SystemRoleGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<SystemRole[]>(
      SYSTEM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed || allowed.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
    }>();
    const actor = request.user;
    if (!actor) {
      throw new UnauthorizedException("Sesión inválida o expirada");
    }

    const current = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      select: { role: true },
    });
    if (!current) {
      throw new UnauthorizedException("Sesión inválida o expirada");
    }

    if (!allowed.includes(current.role)) {
      throw new ForbiddenException("No tienes permisos para esta acción");
    }
    return true;
  }
}
