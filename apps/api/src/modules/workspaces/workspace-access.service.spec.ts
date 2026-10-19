import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import {
  MIN_WRITE_ROLE,
  WorkspaceAccessService,
} from "./workspace-access.service";
import { tenantContext, type TenantContext } from "../../tenant/tenant-context";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

interface FakeMemberRow {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

function makeMember(role: WorkspaceRole): FakeMemberRow {
  return {
    id: "m1",
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    role,
  };
}

function setup(
  options: {
    member?: FakeMemberRow | null;
    workspaceId?: string | null;
    groupRoles?: WorkspaceRole[];
  } = {},
) {
  const {
    member = null,
    workspaceId = WORKSPACE_ID,
    groupRoles = [],
  } = options;
  const prisma = {
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue(member),
    },
    workspace: {
      findUnique: vi
        .fn()
        .mockResolvedValue(workspaceId ? { id: workspaceId } : null),
    },
    permissionGroupMember: {
      findMany: vi
        .fn()
        .mockResolvedValue(groupRoles.map((role) => ({ group: { role } }))),
    },
  };
  const service = new WorkspaceAccessService(prisma as never);
  return { service, prisma };
}

describe("WorkspaceAccessService.assertMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve la membresía si el usuario es miembro", async () => {
    const { service, prisma } = setup({
      member: makeMember(WorkspaceRole.VIEWER),
    });

    const member = await service.assertMembership(WORKSPACE_ID, USER_ID);

    expect(member.role).toBe(WorkspaceRole.VIEWER);
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: { workspaceId: WORKSPACE_ID, userId: USER_ID },
      },
    });
  });

  it("lanza NotFound si el workspace no existe", async () => {
    const { service } = setup({ workspaceId: null });

    await expect(
      service.assertMembership(WORKSPACE_ID, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lanza Forbidden si el workspace existe pero el usuario no es miembro", async () => {
    const { service } = setup({ member: null, workspaceId: WORKSPACE_ID });

    await expect(
      service.assertMembership(WORKSPACE_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("WorkspaceAccessService.assertRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite cuando el rol del usuario es igual al mínimo pedido", async () => {
    const { service } = setup({ member: makeMember(WorkspaceRole.MEMBER) });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).resolves.toMatchObject({ role: WorkspaceRole.MEMBER });
  });

  it("permite cuando el rol del usuario supera el mínimo pedido", async () => {
    const { service } = setup({ member: makeMember(WorkspaceRole.ADMIN) });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).resolves.toMatchObject({ role: WorkspaceRole.ADMIN });
  });

  it("rechaza con Forbidden cuando el rol es inferior al mínimo pedido", async () => {
    const { service } = setup({ member: makeMember(WorkspaceRole.VIEWER) });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ["rechaza a VIEWER para mínimo ADMIN", WorkspaceRole.VIEWER],
    ["rechaza a MEMBER para mínimo ADMIN", WorkspaceRole.MEMBER],
  ])("%s", async (_label: string, memberRole: WorkspaceRole) => {
    const { service } = setup({ member: makeMember(memberRole) });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.ADMIN),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ["permite a ADMIN para mínimo ADMIN", WorkspaceRole.ADMIN],
    ["permite a OWNER para mínimo ADMIN", WorkspaceRole.OWNER],
  ])("%s", async (_label: string, memberRole: WorkspaceRole) => {
    const { service } = setup({ member: makeMember(memberRole) });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.ADMIN),
    ).resolves.toMatchObject({ role: memberRole });
  });

  it("la jerarquía intermedia no depende de la posición en un array: ADMIN y OWNER permiten mínimo MEMBER pero VIEWER no", async () => {
    const { service } = setup({ member: makeMember(WorkspaceRole.VIEWER) });
    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const { service: serviceAdmin } = setup({
      member: makeMember(WorkspaceRole.ADMIN),
    });
    await expect(
      serviceAdmin.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).resolves.toMatchObject({ role: WorkspaceRole.ADMIN });

    const { service: serviceOwner } = setup({
      member: makeMember(WorkspaceRole.OWNER),
    });
    await expect(
      serviceOwner.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).resolves.toMatchObject({ role: WorkspaceRole.OWNER });
  });

  it("rechaza a un no-miembro independientemente del rol pedido", async () => {
    const { service } = setup({ member: null, workspaceId: WORKSPACE_ID });

    await expect(
      service.assertRole(WORKSPACE_ID, USER_ID, WorkspaceRole.MEMBER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("WorkspaceAccessService.assertWriteRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa MEMBER como rol mínimo de escritura", () => {
    expect(MIN_WRITE_ROLE).toBe(WorkspaceRole.MEMBER);
  });

  it.each([
    ["rechaza a VIEWER", WorkspaceRole.VIEWER, true],
    ["permite a MEMBER", WorkspaceRole.MEMBER, false],
    ["permite a ADMIN", WorkspaceRole.ADMIN, false],
    ["permite a OWNER", WorkspaceRole.OWNER, false],
  ])(
    "%s",
    async (_label: string, role: WorkspaceRole, shouldReject: boolean) => {
      const { service } = setup({ member: makeMember(role) });

      const promise = service.assertWriteRole(WORKSPACE_ID, USER_ID);
      if (shouldReject) {
        await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      } else {
        await expect(promise).resolves.toMatchObject({ role });
      }
    },
  );

  it("rechaza a un usuario sin membresía, no solo por rol", async () => {
    const { service } = setup({ member: null, workspaceId: WORKSPACE_ID });

    await expect(
      service.assertWriteRole(WORKSPACE_ID, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lanza NotFound cuando el workspace no existe (no Forbidden)", async () => {
    const { service } = setup({ member: null, workspaceId: null });

    await expect(
      service.assertWriteRole(WORKSPACE_ID, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("WorkspaceAccessService con grupos de permisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promueve el rol al máximo de los grupos", async () => {
    const { service } = setup({
      member: makeMember(WorkspaceRole.MEMBER),
      groupRoles: [WorkspaceRole.ADMIN],
    });

    const member = await service.assertMembership(WORKSPACE_ID, USER_ID);

    expect(member.role).toBe(WorkspaceRole.ADMIN);
  });

  it("usa el rol propio cuando es mayor que los grupos", async () => {
    const { service } = setup({
      member: makeMember(WorkspaceRole.OWNER),
      groupRoles: [WorkspaceRole.VIEWER],
    });

    const member = await service.assertMembership(WORKSPACE_ID, USER_ID);

    expect(member.role).toBe(WorkspaceRole.OWNER);
  });

  it("toma el máximo entre varios grupos", async () => {
    const { service } = setup({
      member: makeMember(WorkspaceRole.VIEWER),
      groupRoles: [WorkspaceRole.MEMBER, WorkspaceRole.ADMIN],
    });

    const member = await service.assertMembership(WORKSPACE_ID, USER_ID);

    expect(member.role).toBe(WorkspaceRole.ADMIN);
  });

  it("un VIEWER en un grupo ADMIN supera el mínimo de escritura", async () => {
    const { service } = setup({
      member: makeMember(WorkspaceRole.VIEWER),
      groupRoles: [WorkspaceRole.ADMIN],
    });

    await expect(
      service.assertWriteRole(WORKSPACE_ID, USER_ID),
    ).resolves.toMatchObject({ role: WorkspaceRole.ADMIN });
  });
});

describe("WorkspaceAccessService con contexto de tenant", () => {
  const context: TenantContext = {
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    role: WorkspaceRole.VIEWER,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assertMembership resuelve desde el contexto sin consultar la DB", async () => {
    const { service, prisma } = setup();

    const member = await tenantContext.run(context, () =>
      service.assertMembership(WORKSPACE_ID, USER_ID),
    );

    expect(member.role).toBe(WorkspaceRole.VIEWER);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("assertWriteRole rechaza a VIEWER del contexto sin consultar la DB", async () => {
    const { service, prisma } = setup();

    await expect(
      tenantContext.run(context, () =>
        service.assertWriteRole(WORKSPACE_ID, USER_ID),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it("assertWriteRole permite a MEMBER del contexto sin consultar la DB", async () => {
    const { service, prisma } = setup();

    await expect(
      tenantContext.run({ ...context, role: WorkspaceRole.MEMBER }, () =>
        service.assertWriteRole(WORKSPACE_ID, USER_ID),
      ),
    ).resolves.toMatchObject({ role: WorkspaceRole.MEMBER });
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it("cae a la DB cuando el workspace pedido no coincide con el contexto", async () => {
    const { service, prisma } = setup({
      member: makeMember(WorkspaceRole.ADMIN),
    });

    const member = await tenantContext.run(
      { ...context, workspaceId: "otro-workspace" },
      () => service.assertWriteRole(WORKSPACE_ID, USER_ID),
    );

    expect(member.role).toBe(WorkspaceRole.ADMIN);
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalled();
  });

  it("fuera de un contexto de tenant mantiene el camino por DB", async () => {
    const { service, prisma } = setup({
      member: makeMember(WorkspaceRole.MEMBER),
    });

    await service.assertWriteRole(WORKSPACE_ID, USER_ID);

    expect(prisma.workspaceMember.findUnique).toHaveBeenCalled();
  });
});
