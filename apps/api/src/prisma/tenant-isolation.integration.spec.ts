import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { WorkspaceRole } from "@taskmaster/contracts";
import { tenantContext } from "../tenant/tenant-context";
import { TenantContextMissingError, tenantExtension } from "./tenant.extension";

/**
 * Test de integración real contra Postgres: verifica de punta a punta que la
 * extensión de Prisma aísla los datos por workspace (scoping + fail-closed) y
 * que `UnscopedPrismaService` es la única vía de escape.
 *
 * Se salta automáticamente si no hay `DATABASE_URL` (se lee de `apps/api/.env`)
 * o si la base no responde, para no romper suites sin infraestructura.
 *
 * Ejecutar en local: `pnpm --filter @taskmaster/api test`.
 */

function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  try {
    const contents = readFileSync(join(process.cwd(), ".env"), "utf8");
    const match = contents.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
    const raw = match?.[1];
    if (!raw) return undefined;
    const value = raw.replace(/^["']|["']$/g, "");
    process.env.DATABASE_URL = value;
    return value;
  } catch {
    return undefined;
  }
}

const databaseUrl = loadDatabaseUrl();
const base = databaseUrl ? new PrismaClient() : undefined;
const scoped = base ? base.$extends(tenantExtension) : undefined;

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let dbUp = false;
let userId = "";
let workspaceAId = "";
let workspaceBId = "";
let taskAId = "";
let taskBId = "";

/**
 * Patrón correcto: envolver la consulta en un callback `async` para que la
 * adopción del thenable ocurra dentro del contexto ALS. Pasar el thenable
 * directamente desde un callback síncrono pierde el contexto (ver último test).
 */
function runAsWorkspace<T>(
  workspaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContext.run(
    {
      userId,
      workspaceId,
      role: WorkspaceRole.OWNER,
    },
    async () => fn(),
  );
}

describe("aislamiento multi-tenant (integración Postgres)", () => {
  beforeAll(async () => {
    if (!base) return;

    try {
      await base.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    dbUp = true;

    const user = await base.user.create({
      data: {
        email: `tenant-${suffix}@integration.test`,
        passwordHash: "not-a-real-hash",
        name: "Tenant Integration",
      },
    });
    userId = user.id;

    const workspaceA = await base.workspace.create({
      data: {
        name: "Tenant A",
        slug: `tenant-a-${suffix}`,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
    });
    workspaceAId = workspaceA.id;

    const workspaceB = await base.workspace.create({
      data: {
        name: "Tenant B",
        slug: `tenant-b-${suffix}`,
        ownerId: userId,
        members: {
          create: { userId, role: WorkspaceRole.OWNER },
        },
      },
    });
    workspaceBId = workspaceB.id;

    const taskA = await base.task.create({
      data: { workspaceId: workspaceAId, creatorId: userId, title: "Task A" },
    });
    taskAId = taskA.id;

    const taskB = await base.task.create({
      data: { workspaceId: workspaceBId, creatorId: userId, title: "Task B" },
    });
    taskBId = taskB.id;
  });

  afterAll(async () => {
    if (!base) return;

    if (dbUp) {
      await base.workspace.deleteMany({
        where: { id: { in: [workspaceAId, workspaceBId] } },
      });
      await base.user.deleteMany({ where: { id: userId } });
    }

    await base.$disconnect();
  });

  it("filtra findMany al workspace del contexto", async (ctx) => {
    if (!dbUp) return ctx.skip();

    const rows = await runAsWorkspace(workspaceAId, () =>
      scoped!.task.findMany({
        where: { id: { in: [taskAId, taskBId] } },
      }),
    );

    expect(rows.map((row) => row.id)).toEqual([taskAId]);
  });

  it("permite leer por id una fila del workspace del contexto", async (ctx) => {
    if (!dbUp) return ctx.skip();

    const row = await runAsWorkspace(workspaceAId, () =>
      scoped!.task.findUnique({ where: { id: taskAId } }),
    );

    expect(row?.id).toBe(taskAId);
  });

  it("bloquea la lectura de una fila de otro workspace", async (ctx) => {
    if (!dbUp) return ctx.skip();

    const row = await runAsWorkspace(workspaceAId, () =>
      scoped!.task.findUnique({ where: { id: taskBId } }),
    );

    expect(row).toBeNull();
  });

  it("lanza fail-closed al consultar un modelo scoped sin contexto", async (ctx) => {
    if (!dbUp) return ctx.skip();

    await expect(
      scoped!.task.findMany({ where: { id: { in: [taskAId, taskBId] } } }),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
  });

  it("permite cruzar workspaces solo a través del cliente sin extender", async (ctx) => {
    if (!dbUp) return ctx.skip();

    const rows = await base!.task.findMany({
      where: { id: { in: [taskAId, taskBId] } },
    });

    expect(rows.map((row) => row.id).sort()).toEqual([taskAId, taskBId].sort());
  });

  it("expone el foot-gun: callback síncrono que devuelve el thenable pierde el contexto ALS", async (ctx) => {
    if (!dbUp) return ctx.skip();

    await expect(
      tenantContext.run(
        { userId, workspaceId: workspaceAId, role: WorkspaceRole.OWNER },
        () =>
          scoped!.task.findMany({ where: { id: { in: [taskAId, taskBId] } } }),
      ),
    ).rejects.toBeInstanceOf(TenantContextMissingError);
  });
});
