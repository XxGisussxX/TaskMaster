import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { WorkspacesService } from "./workspaces.service";

const WORKSPACE_ID = "ws1";

interface FakeMemberRow {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
}

function makeMember(role: WorkspaceRole, userId = "target"): FakeMemberRow {
  return {
    id: "m1",
    workspaceId: WORKSPACE_ID,
    userId,
    role,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  };
}

function setup(actorRole: WorkspaceRole, member: FakeMemberRow | null) {
  const prisma = {
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue(member),
      update: vi.fn(({ data }: { data: { role: WorkspaceRole } }) =>
        Promise.resolve({
          ...(member as FakeMemberRow),
          role: data.role,
          user: {
            id: "target",
            name: "Target",
            email: "t@x.com",
            avatarUrl: null,
          },
        }),
      ),
      delete: vi.fn().mockResolvedValue(member),
    },
  };
  const access = {
    assertRole: vi
      .fn()
      .mockResolvedValue({ id: "actorMember", role: actorRole }),
  };
  const auth = { revokeUserTokens: vi.fn().mockResolvedValue(undefined) };
  const service = new WorkspacesService(
    prisma as never,
    access as never,
    {} as never,
    {} as never,
    auth as never,
  );
  return { service, prisma, access, auth };
}

describe("WorkspacesService.updateMemberRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impide que un ADMIN modifique a otro ADMIN", async () => {
    const { service } = setup(
      WorkspaceRole.ADMIN,
      makeMember(WorkspaceRole.ADMIN),
    );

    await expect(
      service.updateMemberRole(WORKSPACE_ID, "m1", "actor", {
        role: WorkspaceRole.MEMBER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("impide que un ADMIN asigne el rol de propietario", async () => {
    const { service } = setup(
      WorkspaceRole.ADMIN,
      makeMember(WorkspaceRole.MEMBER),
    );

    await expect(
      service.updateMemberRole(WORKSPACE_ID, "m1", "actor", {
        role: WorkspaceRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("permite al propietario modificar a un ADMIN", async () => {
    const { service, auth } = setup(
      WorkspaceRole.OWNER,
      makeMember(WorkspaceRole.ADMIN),
    );

    const updated = await service.updateMemberRole(
      WORKSPACE_ID,
      "m1",
      "actor",
      {
        role: WorkspaceRole.MEMBER,
      },
    );

    expect(updated.role).toBe(WorkspaceRole.MEMBER);
    expect(auth.revokeUserTokens).toHaveBeenCalledWith("target");
  });

  it("permite a un ADMIN modificar a un MEMBER", async () => {
    const { service } = setup(
      WorkspaceRole.ADMIN,
      makeMember(WorkspaceRole.MEMBER),
    );

    const updated = await service.updateMemberRole(
      WORKSPACE_ID,
      "m1",
      "actor",
      {
        role: WorkspaceRole.VIEWER,
      },
    );

    expect(updated.role).toBe(WorkspaceRole.VIEWER);
  });

  it("impide modificar el rol del propietario", async () => {
    const { service } = setup(
      WorkspaceRole.OWNER,
      makeMember(WorkspaceRole.OWNER),
    );

    await expect(
      service.updateMemberRole(WORKSPACE_ID, "m1", "actor", {
        role: WorkspaceRole.MEMBER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("WorkspacesService.removeMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impide que un ADMIN elimine a otro ADMIN", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.ADMIN,
      makeMember(WorkspaceRole.ADMIN),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, "m1", "actor"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
  });

  it("permite al propietario eliminar a un ADMIN", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.OWNER,
      makeMember(WorkspaceRole.ADMIN),
    );

    await service.removeMember(WORKSPACE_ID, "m1", "actor");

    expect(prisma.workspaceMember.delete).toHaveBeenCalledWith({
      where: { id: "m1" },
    });
  });

  it("impide eliminarse a sí mismo", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.OWNER,
      makeMember(WorkspaceRole.MEMBER, "actor"),
    );

    await expect(
      service.removeMember(WORKSPACE_ID, "m1", "actor"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
  });
});

describe("WorkspacesService.invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impide que un ADMIN invite con rol de propietario", async () => {
    const { service, prisma } = setup(WorkspaceRole.ADMIN, null);

    await expect(
      service.invite(WORKSPACE_ID, "actor", {
        email: "new@example.com",
        role: WorkspaceRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it("permite al propietario invitar con rol de propietario", async () => {
    const { service } = setup(WorkspaceRole.OWNER, null);

    await expect(
      service.invite(WORKSPACE_ID, "actor", {
        email: "new@example.com",
        role: WorkspaceRole.OWNER,
      }),
    ).rejects.not.toBeInstanceOf(ForbiddenException);
  });
});
