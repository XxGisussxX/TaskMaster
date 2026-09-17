import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SystemRole } from "@taskmaster/contracts";
import { AdminService } from "./admin.service";

interface FakeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: SystemRole;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function makeUser(id: string, role: SystemRole): FakeUser {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    avatarUrl: null,
    role,
    isEmailVerified: true,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  };
}

function setup(actor: FakeUser | null, target: FakeUser | null) {
  const prisma = {
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    user: {
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        if (where.id === actor?.id) return Promise.resolve(actor);
        if (where.id === target?.id) return Promise.resolve(target);
        return Promise.resolve(null);
      }),
      update: vi.fn(({ data }: { data: { role: SystemRole } }) =>
        Promise.resolve({ ...(target as FakeUser), role: data.role }),
      ),
    },
  };
  const auth = { revokeUserTokens: vi.fn().mockResolvedValue(undefined) };
  const service = new AdminService(prisma as never, auth as never);
  return { service, prisma, auth };
}

describe("AdminService.updateRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza que un actor cambie su propio rol", async () => {
    const { service } = setup(
      makeUser("u1", SystemRole.SUPER_ADMIN),
      makeUser("u1", SystemRole.SUPER_ADMIN),
    );

    await expect(
      service.updateRole("u1", "u1", { role: SystemRole.USER }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lanza NotFound si el usuario objetivo no existe", async () => {
    const { service } = setup(makeUser("admin", SystemRole.ADMIN), null);

    await expect(
      service.updateRole("admin", "missing", { role: SystemRole.USER }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lanza NotFound si el actor no existe", async () => {
    const { service } = setup(null, makeUser("u2", SystemRole.USER));

    await expect(
      service.updateRole("ghost", "u2", { role: SystemRole.USER }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("impide que un ADMIN otorgue SUPER_ADMIN", async () => {
    const { service } = setup(
      makeUser("admin", SystemRole.ADMIN),
      makeUser("u2", SystemRole.USER),
    );

    await expect(
      service.updateRole("admin", "u2", { role: SystemRole.SUPER_ADMIN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("impide que un ADMIN modifique a otro ADMIN", async () => {
    const { service } = setup(
      makeUser("admin", SystemRole.ADMIN),
      makeUser("admin2", SystemRole.ADMIN),
    );

    await expect(
      service.updateRole("admin", "admin2", { role: SystemRole.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("impide que un ADMIN modifique a un SUPER_ADMIN", async () => {
    const { service } = setup(
      makeUser("admin", SystemRole.ADMIN),
      makeUser("root", SystemRole.SUPER_ADMIN),
    );

    await expect(
      service.updateRole("admin", "root", { role: SystemRole.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite a un ADMIN promover a un USER a ADMIN", async () => {
    const { service, auth } = setup(
      makeUser("admin", SystemRole.ADMIN),
      makeUser("u2", SystemRole.USER),
    );

    const result = await service.updateRole("admin", "u2", {
      role: SystemRole.ADMIN,
    });

    expect(result.role).toBe(SystemRole.ADMIN);
    expect(auth.revokeUserTokens).toHaveBeenCalledWith("u2");
  });

  it("permite a un SUPER_ADMIN modificar a un ADMIN y revoca tokens", async () => {
    const { service, auth } = setup(
      makeUser("root", SystemRole.SUPER_ADMIN),
      makeUser("admin", SystemRole.ADMIN),
    );

    const result = await service.updateRole("root", "admin", {
      role: SystemRole.USER,
    });

    expect(result.role).toBe(SystemRole.USER);
    expect(auth.revokeUserTokens).toHaveBeenCalledWith("admin");
  });
});
