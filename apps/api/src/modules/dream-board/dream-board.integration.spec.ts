import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type WorkspaceRole } from "@prisma/client";
import { createPrismaClient } from "../../prisma/prisma.service";
import { tenantContext } from "../../tenant/tenant-context";
import { DreamBoardService } from "./dream-board.service";

/**
 * Integración real contra Postgres del CRUD de dream board: crea los datos de
 * prueba, recorre el ciclo completo de un pin y verifica el aislamiento entre
 * workspaces (y entre miembros del mismo workspace).
 *
 * Se salta automáticamente si no hay `DATABASE_URL` o la base no responde.
 * Ejecutar en local: `pnpm --filter @taskmaster/api test`.
 */
function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
    const raw = match?.[1];
    if (!raw) return undefined;
    process.env.DATABASE_URL = raw.replace(/^["']|["']$/g, "");
    return process.env.DATABASE_URL;
  } catch {
    return undefined;
  }
}

const databaseUrl = loadDatabaseUrl();
const admin = databaseUrl ? new PrismaClient() : undefined;
const scoped = admin ? createPrismaClient() : undefined;

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let dbUp = false;
let ownerId = "";
let otherUserId = "";
let workspaceAId = "";
let workspaceBId = "";

/**
 * El servicio se instancia con el cliente extendido real: los tests pasan por
 * `tenantContext.run`, así que el aislamiento multi-tenant queda ejercitado.
 */
function makeService(): DreamBoardService {
  const access = {
    assertMembership: async (workspaceId: string, userId: string) => {
      const member = await admin!.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!member)
        throw new ForbiddenException("No eres miembro de este workspace");
      return member;
    },
    assertWriteRole: async (workspaceId: string, userId: string) => {
      const member = await admin!.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      });
      if (!member)
        throw new ForbiddenException("No eres miembro de este workspace");
      if (member.role === "VIEWER")
        throw new ForbiddenException("Sin permisos");
      return member;
    },
  };
  return new DreamBoardService(scoped as never, access as never);
}

/** Ejecuta el callback dentro del contexto de tenant del workspace. */
function asWorkspace<T>(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContext.run({ userId, workspaceId, role }, async () => fn());
}

describe("dream board CRUD (integración Postgres)", () => {
  beforeAll(async () => {
    if (!admin) return;

    try {
      await admin.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    dbUp = true;

    const owner = await admin.user.create({
      data: {
        email: `dream-owner-${suffix}@integration.test`,
        passwordHash: "not-a-real-hash",
        name: "Dream Owner",
      },
    });
    ownerId = owner.id;

    const other = await admin.user.create({
      data: {
        email: `dream-other-${suffix}@integration.test`,
        passwordHash: "not-a-real-hash",
        name: "Dream Other",
      },
    });
    otherUserId = other.id;

    workspaceAId = (
      await admin.workspace.create({
        data: {
          name: "Dream A",
          slug: `dream-a-${suffix}`,
          ownerId,
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      })
    ).id;

    workspaceBId = (
      await admin.workspace.create({
        data: {
          name: "Dream B",
          slug: `dream-b-${suffix}`,
          ownerId,
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!admin || !dbUp) return;

    await admin.workspace.deleteMany({
      where: { id: { in: [workspaceAId, workspaceBId] } },
    });
    await admin.user.deleteMany({
      where: { id: { in: [ownerId, otherUserId] } },
    });
    await admin.$disconnect();
  });

  it("crea el tablero con el título por defecto y sin pins", async () => {
    if (!dbUp) return;

    const service = makeService();
    const board = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.getBoard(workspaceAId, ownerId),
    );

    expect(board.workspaceId).toBe(workspaceAId);
    expect(board.title).toBe("Mi Tablero de Sueños");
    expect(board.pins).toEqual([]);
  });

  it("devuelve siempre el mismo tablero (1:1 con el workspace)", async () => {
    if (!dbUp) return;

    const service = makeService();
    const first = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.getBoard(workspaceAId, ownerId),
    );
    const second = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.getBoard(workspaceAId, ownerId),
    );

    expect(second.id).toBe(first.id);
    expect(
      await admin!.dreamBoard.count({ where: { workspaceId: workspaceAId } }),
    ).toBe(1);
  });

  it("recorre el ciclo completo: crear, leer, mover, editar y eliminar", async () => {
    if (!dbUp) return;

    const service = makeService();

    const pin = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.createPin(workspaceAId, ownerId, {
        title: "Viaje a Kyoto",
        description: "Primavera",
        type: "TRAVEL",
        color: "SKY",
        positionX: 120,
        positionY: 240,
      }),
    );

    expect(pin.title).toBe("Viaje a Kyoto");
    expect(pin.type).toBe("TRAVEL");
    expect(pin.x).toBe(120);
    expect(pin.boardId).toBeTruthy();

    const board = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.getBoard(workspaceAId, ownerId),
    );
    expect(board.pins.map((p) => p.id)).toContain(pin.id);

    const moved = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.updatePin(workspaceAId, pin.id, ownerId, {
        positionX: 300,
        positionY: 80,
      }),
    );
    expect(moved).toMatchObject({ x: 300, y: 80, title: "Viaje a Kyoto" });

    const edited = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.updatePin(workspaceAId, pin.id, ownerId, {
        title: "Viaje a Osaka",
        color: "VIOLET",
      }),
    );
    expect(edited).toMatchObject({ title: "Viaje a Osaka", color: "VIOLET" });

    await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.removePin(workspaceAId, pin.id, ownerId),
    );

    const afterDelete = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.getBoard(workspaceAId, ownerId),
    );
    expect(afterDelete.pins).toHaveLength(0);
  });

  it("un usuario de otro workspace no puede leer el tablero", async () => {
    if (!dbUp) return;

    const service = makeService();
    await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.createPin(workspaceAId, ownerId, {
        title: "Secreto",
        description: "",
        type: "GOAL",
        color: "AMBER",
        positionX: 0,
        positionY: 0,
      }),
    );

    await expect(
      service.getBoard(workspaceAId, otherUserId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.createPin(workspaceAId, otherUserId, {
        title: "Intruso",
        description: "",
        type: "GOAL",
        color: "AMBER",
        positionX: 0,
        positionY: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("un pin del workspace B no existe dentro del workspace A", async () => {
    if (!dbUp) return;

    const service = makeService();
    const pinB = await asWorkspace(workspaceBId, ownerId, "OWNER", () =>
      service.createPin(workspaceBId, ownerId, {
        title: "Meta B",
        description: "",
        type: "GOAL",
        color: "ROSE",
        positionX: 10,
        positionY: 10,
      }),
    );

    await expect(
      asWorkspace(workspaceAId, ownerId, "OWNER", () =>
        service.updatePin(workspaceAId, pinB.id, ownerId, {
          title: "hackeado",
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      asWorkspace(workspaceAId, ownerId, "OWNER", () =>
        service.removePin(workspaceAId, pinB.id, ownerId),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const stillThere = await admin!.dreamPin.findUnique({
      where: { id: pinB.id },
    });
    expect(stillThere?.title).toBe("Meta B");
  });

  it("un miembro no puede editar ni borrar el pin de otro miembro", async () => {
    if (!dbUp) return;

    const service = makeService();

    await admin!.workspaceMember.create({
      data: { workspaceId: workspaceAId, userId: otherUserId, role: "MEMBER" },
    });

    const pinDelOwner = await asWorkspace(workspaceAId, ownerId, "OWNER", () =>
      service.createPin(workspaceAId, ownerId, {
        title: "Pin del owner",
        description: "",
        type: "PROJECT",
        color: "EMERALD",
        positionX: 0,
        positionY: 0,
      }),
    );

    await expect(
      asWorkspace(workspaceAId, otherUserId, "MEMBER", () =>
        service.updatePin(workspaceAId, pinDelOwner.id, otherUserId, {
          title: "no soy el autor",
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      asWorkspace(workspaceAId, otherUserId, "MEMBER", () =>
        service.removePin(workspaceAId, pinDelOwner.id, otherUserId),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const intact = await admin!.dreamPin.findUnique({
      where: { id: pinDelOwner.id },
    });
    expect(intact?.title).toBe("Pin del owner");

    await asWorkspace(workspaceAId, otherUserId, "MEMBER", () =>
      service.removePin(workspaceAId, pinDelOwner.id, ownerId),
    );
  });

  it("un VIEWER puede leer el tablero pero no escribir", async () => {
    if (!dbUp) return;

    const service = makeService();
    await admin!.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId: workspaceAId, userId: otherUserId },
      },
      data: { role: "VIEWER" },
    });

    const board = await asWorkspace(workspaceAId, otherUserId, "VIEWER", () =>
      service.getBoard(workspaceAId, otherUserId),
    );
    expect(board.workspaceId).toBe(workspaceAId);

    await expect(
      asWorkspace(workspaceAId, otherUserId, "VIEWER", () =>
        service.createPin(workspaceAId, otherUserId, {
          title: "No permitido",
          description: "",
          type: "GOAL",
          color: "SLATE",
          positionX: 0,
          positionY: 0,
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("borra los pins en cascada cuando se elimina el workspace", async () => {
    if (!dbUp) return;

    const service = makeService();
    const pin = await asWorkspace(workspaceBId, ownerId, "OWNER", () =>
      service.createPin(workspaceBId, ownerId, {
        title: "Se va con el workspace",
        description: "",
        type: "HEALTH",
        color: "VIOLET",
        positionX: 0,
        positionY: 0,
      }),
    );

    await admin!.workspace.delete({ where: { id: workspaceBId } });

    expect(await admin!.dreamPin.count({ where: { id: pin.id } })).toBe(0);
    expect(
      await admin!.dreamBoard.count({ where: { workspaceId: workspaceBId } }),
    ).toBe(0);
  });
});
