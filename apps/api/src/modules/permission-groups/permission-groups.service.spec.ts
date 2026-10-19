import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { PermissionGroupsService } from "./permission-groups.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: "pg1",
    workspaceId: WORKSPACE_ID,
    name: "Admins",
    description: "",
    color: "#6366f1",
    role: WorkspaceRole.ADMIN,
    members: [],
    ...overrides,
  };
}

function makeMemberRow(userId = "u2") {
  return {
    workspaceMemberId: "m2",
    workspaceMember: {
      userId,
      role: WorkspaceRole.MEMBER,
      user: {
        id: userId,
        name: "Ana",
        email: "ana@example.com",
        avatarUrl: null,
      },
    },
  };
}

function setup() {
  const prisma = {
    permissionGroup: {
      findMany: vi.fn().mockResolvedValue([makeGroup()]),
      create: vi.fn().mockResolvedValue(makeGroup()),
      update: vi.fn().mockResolvedValue(makeGroup({ name: "Nuevo" })),
      delete: vi.fn().mockResolvedValue(makeGroup()),
      count: vi.fn().mockResolvedValue(1),
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeGroup()),
    },
    workspaceMember: {
      findMany: vi.fn().mockResolvedValue([{ id: "m2" }]),
    },
    permissionGroupMember: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };
  const access = {
    assertMembership: vi.fn().mockResolvedValue({ role: WorkspaceRole.MEMBER }),
    assertWriteRole: vi.fn().mockResolvedValue({ role: WorkspaceRole.ADMIN }),
  };
  const service = new PermissionGroupsService(prisma as never, access as never);
  return { service, prisma, access };
}

describe("PermissionGroupsService.list", () => {
  it("exige membresía y devuelve los grupos con sus miembros", async () => {
    const { service, prisma } = setup();
    prisma.permissionGroup.findMany.mockResolvedValue([
      makeGroup({ members: [makeMemberRow()] }),
    ]);

    const groups = await service.list(WORKSPACE_ID, USER_ID);

    expect(prisma.permissionGroup.findMany).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { createdAt: "asc" },
      include: expect.any(Object),
    });
    expect(groups[0]?.members[0]).toMatchObject({
      memberId: "m2",
      userId: "u2",
      name: "Ana",
      workspaceRole: WorkspaceRole.MEMBER,
    });
  });
});

describe("PermissionGroupsService.create", () => {
  it("exige rol de escritura", async () => {
    const { service, access, prisma } = setup();

    await service.create(WORKSPACE_ID, USER_ID, {
      name: "Admins",
      description: "",
      color: "#6366f1",
      role: WorkspaceRole.ADMIN,
    });

    expect(access.assertWriteRole).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID);
    expect(prisma.permissionGroup.create).toHaveBeenCalledWith({
      data: {
        workspaceId: WORKSPACE_ID,
        name: "Admins",
        description: "",
        color: "#6366f1",
        role: WorkspaceRole.ADMIN,
      },
      include: expect.any(Object),
    });
  });
});

describe("PermissionGroupsService.update", () => {
  it("rechaza si el grupo no existe en el workspace", async () => {
    const { service, prisma } = setup();
    prisma.permissionGroup.count.mockResolvedValue(0);

    await expect(
      service.update(WORKSPACE_ID, USER_ID, "pg1", { name: "Nuevo" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("PermissionGroupsService.remove", () => {
  it("borra el grupo tras validar existencia", async () => {
    const { service, prisma } = setup();

    await service.remove(WORKSPACE_ID, USER_ID, "pg1");

    expect(prisma.permissionGroup.delete).toHaveBeenCalledWith({
      where: { id: "pg1" },
    });
  });
});

describe("PermissionGroupsService.assignMembers", () => {
  it("reemplaza los miembros del grupo en una transacción", async () => {
    const { service, prisma } = setup();
    prisma.permissionGroup.findUniqueOrThrow.mockResolvedValue(
      makeGroup({ members: [makeMemberRow()] }),
    );

    await service.assignMembers(WORKSPACE_ID, USER_ID, "pg1", ["u2"]);

    expect(prisma.permissionGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { groupId: "pg1" },
    });
    expect(prisma.permissionGroupMember.createMany).toHaveBeenCalledWith({
      data: [{ groupId: "pg1", workspaceMemberId: "m2" }],
      skipDuplicates: true,
    });
  });

  it("rechaza si algún miembro no pertenece al workspace", async () => {
    const { service, prisma } = setup();
    prisma.workspaceMember.findMany.mockResolvedValue([]);

    await expect(
      service.assignMembers(WORKSPACE_ID, USER_ID, "pg1", ["u2"]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
