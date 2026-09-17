import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { SystemRole } from "@taskmaster/contracts";
import { SYSTEM_ROLES_KEY } from "../decorators/require-system-role.decorator";
import { SystemRoleGuard } from "./system-role.guard";
import type { AuthUser } from "../../modules/auth/types";

function makeUser(role: SystemRole): AuthUser & { sub: string } {
  return {
    sub: "u1",
    email: "u1@example.com",
    name: "User",
    role,
  };
}

function setup(options: {
  allowed?: SystemRole[] | null;
  user?: AuthUser | null;
  dbRole?: SystemRole | null;
}) {
  const { allowed = null, user = null, dbRole = null } = options;
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(allowed),
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(dbRole ? { role: dbRole } : null),
    },
  };
  const guard = new SystemRoleGuard(reflector as never, prisma as never);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard, context, reflector, prisma };
}

describe("SystemRoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite pasar cuando el endpoint no declara roles requeridos", async () => {
    const { guard, context, prisma, reflector } = setup({ allowed: null });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(SYSTEM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("lanza Unauthorized si no hay usuario autenticado", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.USER],
      user: null,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("lanza Unauthorized si el usuario ya no existe en la DB", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.USER],
      user: makeUser(SystemRole.USER),
      dbRole: null,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("permite cuando el rol en DB está en la lista permitida", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
      user: makeUser(SystemRole.ADMIN),
      dbRole: SystemRole.ADMIN,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("lanza Forbidden cuando el rol en DB no está en la lista permitida", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
      user: makeUser(SystemRole.USER),
      dbRole: SystemRole.USER,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refleja una democión en DB mid-sesión aunque el claim del JWT siga diciendo ADMIN", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
      user: makeUser(SystemRole.ADMIN),
      dbRole: SystemRole.USER,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refleja una promoción en DB mid-sesión aunque el claim del JWT siga diciendo USER", async () => {
    const { guard, context } = setup({
      allowed: [SystemRole.ADMIN, SystemRole.SUPER_ADMIN],
      user: makeUser(SystemRole.USER),
      dbRole: SystemRole.SUPER_ADMIN,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("consulta la DB por el id del usuario autenticado", async () => {
    const { guard, context, prisma } = setup({
      allowed: [SystemRole.USER],
      user: makeUser(SystemRole.USER),
      dbRole: SystemRole.USER,
    });

    await guard.canActivate(context);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { role: true },
    });
  });
});
