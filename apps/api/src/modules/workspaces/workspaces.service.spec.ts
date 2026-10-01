import "reflect-metadata";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { WorkspacesService } from "./workspaces.service";

const WORKSPACE_ID = "ws1";

/** Oráculo independiente del `private hashInviteToken` del service. */
const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Primer argumento con el que se llamó a un mock. Lanza si nunca se llamó, para
 * que un test no pueda pasar por no haber ejercitado el código.
 */
function firstCall(mock: { mock: { calls: unknown[][] } }): Record<string, any> {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("el mock nunca fue invocado");
  return (call[0] ?? {}) as Record<string, any>;
}

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

interface FakeInviteRow {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedById: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

function makeInvite(overrides: Partial<FakeInviteRow> = {}): FakeInviteRow {
  return {
    id: "inv1",
    workspaceId: WORKSPACE_ID,
    email: "new@example.com",
    role: WorkspaceRole.MEMBER,
    tokenHash: sha256("token-inicial"),
    invitedById: "actor",
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeWorkspace() {
  return {
    id: WORKSPACE_ID,
    name: "Espacio",
    slug: "espacio",
    icon: null,
    ownerId: "actor",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    members: [],
  };
}

/**
 * Mock completo para el flujo de invitaciones: `setup()` no alcanza porque pasa
 * `{}` como MailService, y con eso `invite()` reventaba con TypeError — lo que
 * hacía que el test previo pasara sin verificar nada.
 */
function setupInvites(actorRole: WorkspaceRole = WorkspaceRole.OWNER) {
  const prisma = {
    workspace: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(makeWorkspace()),
    },
    workspaceMember: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(({ data }: { data: Partial<FakeMemberRow> }) =>
        Promise.resolve({ id: "m-new", createdAt: new Date(), ...data }),
      ),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ id: "actor", name: "Actor", email: "actor@example.com" }),
    },
    invite: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(({ data }: { data: Partial<FakeInviteRow> }) =>
        Promise.resolve(makeInvite(data as Partial<FakeInviteRow>)),
      ),
      update: vi.fn(({ data }: { data: Partial<FakeInviteRow> }) =>
        Promise.resolve(makeInvite(data as Partial<FakeInviteRow>)),
      ),
      delete: vi.fn().mockResolvedValue(makeInvite()),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  const access = {
    assertRole: vi
      .fn()
      .mockResolvedValue({ id: "actorMember", role: actorRole }),
  };
  const mail = {
    sendInvite: vi.fn().mockResolvedValue({ sent: false }),
    emailConfig: vi.fn().mockReturnValue({ isConfigured: false, isDev: true }),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === "WEB_URL" ? "http://localhost:5173" : undefined,
    ),
  };
  const auth = { revokeUserTokens: vi.fn().mockResolvedValue(undefined) };
  const service = new WorkspacesService(
    prisma as never,
    access as never,
    mail as never,
    config as never,
    auth as never,
  );
  return { service, prisma, access, mail };
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
    const { service, prisma } = setupInvites(WorkspaceRole.ADMIN);

    await expect(
      service.invite(WORKSPACE_ID, "actor", {
        email: "new@example.com",
        role: WorkspaceRole.OWNER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.invite.create).not.toHaveBeenCalled();
  });

  it("permite al propietario invitar con rol de propietario", async () => {
    const { service, prisma } = setupInvites(WorkspaceRole.OWNER);

    const result = await service.invite(WORKSPACE_ID, "actor", {
      email: "new@example.com",
      role: WorkspaceRole.OWNER,
    });

    // Antes esto solo comprobaba `not ForbiddenException`, lo que también
    // pasaba si el service reventaba con un TypeError. Ahora se exige que la
    // invitación se haya creado de verdad.
    expect(result.id).toBe("inv1");
    expect(prisma.invite.create).toHaveBeenCalledTimes(1);
    expect(firstCall(prisma.invite.create).data.role).toBe(WorkspaceRole.OWNER);
  });
});

describe("WorkspacesService — tokens de invitación hasheados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persiste el SHA-256 del token y nunca el token en claro", async () => {
    const { service, prisma } = setupInvites();

    await service.invite(WORKSPACE_ID, "actor", {
      email: "new@example.com",
      role: WorkspaceRole.MEMBER,
    });

    const data = firstCall(prisma.invite.create).data;
    expect(data).not.toHaveProperty("token");
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("el link del email lleva el token crudo, que es lo que hashea a lo guardado", async () => {
    const { service, prisma, mail } = setupInvites();

    await service.invite(WORKSPACE_ID, "actor", {
      email: "new@example.com",
      role: WorkspaceRole.MEMBER,
    });

    const inviteUrl = firstCall(mail.sendInvite).inviteUrl as string;
    const rawToken = inviteUrl.split("/invite/")[1];

    expect(inviteUrl.startsWith("http://localhost:5173/invite/")).toBe(true);
    expect(rawToken).toBeTruthy();

    // La propiedad de seguridad real: lo que viaja por email, hasheado, es
    // exactamente lo que quedó en la DB.
    expect(firstCall(prisma.invite.create).data.tokenHash).toBe(
      sha256(rawToken as string),
    );
  });

  it("reemplaza el hash al re-invitar a alguien con una invitación pendiente", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findFirst.mockResolvedValue(makeInvite());

    await service.invite(WORKSPACE_ID, "actor", {
      email: "new@example.com",
      role: WorkspaceRole.MEMBER,
    });

    expect(prisma.invite.create).not.toHaveBeenCalled();
    const data = firstCall(prisma.invite.update).data;
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data).not.toHaveProperty("token");
  });

  it("busca el preview por tokenHash, no por token en claro", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue({
      ...makeInvite({ tokenHash: sha256("tok-abc") }),
      workspace: { id: WORKSPACE_ID, name: "Espacio" },
      invitedBy: { id: "actor", name: "Actor" },
    });

    const preview = await service.invitePreview("tok-abc");

    expect(prisma.invite.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256("tok-abc") } }),
    );
    expect(preview.workspaceName).toBe("Espacio");
    expect(preview.inviterName).toBe("Actor");
    expect(preview.accepted).toBe(false);
  });

  it("el preview no filtra el tokenHash al cliente", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue({
      ...makeInvite({ tokenHash: sha256("tok-abc") }),
      workspace: { id: WORKSPACE_ID, name: "Espacio" },
      invitedBy: null,
    });

    const preview = await service.invitePreview("tok-abc");

    expect(preview).not.toHaveProperty("tokenHash");
    expect(preview).not.toHaveProperty("token");
    expect(preview.inviterName).toBe("Alguien de TaskMaster");
  });

  it("rechaza un token que no existe", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue(null);

    await expect(service.invitePreview("no-existe")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("canjea la invitación buscando por tokenHash", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue(
      makeInvite({
        tokenHash: sha256("tok-xyz"),
        // La invitación es para el mismo usuario que la canjea.
        email: "actor@example.com",
      }),
    );

    const workspace = await service.acceptInvite("actor", { token: "tok-xyz" });

    expect(prisma.invite.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: sha256("tok-xyz") },
    });
    expect(workspace.slug).toBe("espacio");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("no acepta una invitación expirada", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue(
      makeInvite({
        tokenHash: sha256("tok-vencida"),
        expiresAt: new Date(Date.now() - 1000),
      }),
    );

    await expect(
      service.acceptInvite("actor", { token: "tok-vencida" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("no acepta dos veces la misma invitación", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue(
      makeInvite({
        tokenHash: sha256("tok-usada"),
        acceptedAt: new Date("2024-01-01T00:00:00.000Z"),
      }),
    );

    await expect(
      service.acceptInvite("actor", { token: "tok-usada" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("no acepta una invitación enviada a otro email", async () => {
    const { service, prisma } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue(
      makeInvite({ tokenHash: sha256("tok-ajena"), email: "otra@example.com" }),
    );
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "actor",
      name: "Actor",
      email: "actor@example.com",
    });

    await expect(
      service.acceptInvite("actor", { token: "tok-ajena" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("el resend rota el token y guarda el hash del nuevo", async () => {
    const { service, prisma, mail } = setupInvites();
    prisma.invite.findUnique.mockResolvedValue({
      ...makeInvite({ tokenHash: sha256("token-viejo") }),
      workspace: { id: WORKSPACE_ID, name: "Espacio" },
      invitedBy: { id: "actor", name: "Actor" },
    });

    await service.resendInvite(WORKSPACE_ID, "inv1", "actor");

    const data = firstCall(prisma.invite.update).data;
    const newRawToken = (firstCall(mail.sendInvite).inviteUrl as string).split(
      "/invite/",
    )[1] as string;

    expect(data.tokenHash).toBe(sha256(newRawToken));
    // El token viejo queda invalidado: es justamente de lo que sirve el resend.
    expect(data.tokenHash).not.toBe(sha256("token-viejo"));
  });
});
