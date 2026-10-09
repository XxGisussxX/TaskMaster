import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./prisma.service";
import { tenantContext } from "../tenant/tenant-context";

/**
 * Integración real contra Postgres: verifica que `CustomFieldValue` (con
 * columna `workspaceId`) queda bajo el auto-scope del tenant, incluido el
 * `upsert` por unique compuesto (`definitionId_entityId` + `workspaceId`
 * inyectado por extendedWhereUnique). Se salta si no hay `DATABASE_URL`.
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
let wsId = "";
let taskId = "";
let defId = "";

describe("auto-scope de CustomFieldValue (integración Postgres)", () => {
  beforeAll(async () => {
    if (!admin) return;
    try {
      await admin.$queryRaw`SELECT 1`;
    } catch {
      return;
    }
    dbUp = true;
    ownerId = (
      await admin.user.create({
        data: {
          email: `cfv-owner-${suffix}@integration.test`,
          passwordHash: "x",
          name: "CFV Owner",
        },
      })
    ).id;
    wsId = (
      await admin.workspace.create({
        data: {
          name: `CFV ${suffix}`,
          slug: `cfv-${suffix}`,
          ownerId,
          members: { create: { userId: ownerId, role: "OWNER" } },
        },
      })
    ).id;
    taskId = (
      await admin.task.create({
        data: { title: "t", workspaceId: wsId, creatorId: ownerId },
      })
    ).id;
    defId = (
      await admin.customFieldDefinition.create({
        data: {
          workspaceId: wsId,
          name: "Prioridad",
          type: "SELECT",
          options: ["A", "B"],
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!admin || !dbUp) return;
    await admin.workspace.delete({ where: { id: wsId } });
    await admin.user.delete({ where: { id: ownerId } });
    await admin.$disconnect();
  });

  it("upsert por unique compuesto funciona con workspaceId inyectado", async () => {
    if (!dbUp) return;
    const value = await tenantContext.run(
      { userId: ownerId, workspaceId: wsId, role: "OWNER" },
      async () =>
        scoped!.customFieldValue.upsert({
          where: {
            definitionId_entityId: { definitionId: defId, entityId: taskId },
          },
          create: {
            workspaceId: wsId,
            definitionId: defId,
            entityId: taskId,
            entityType: "TASK",
            value: "A",
          },
          update: { value: "B" },
        }),
    );
    expect(value.workspaceId).toBe(wsId);

    const updated = await tenantContext.run(
      { userId: ownerId, workspaceId: wsId, role: "OWNER" },
      async () =>
        scoped!.customFieldValue.upsert({
          where: {
            definitionId_entityId: { definitionId: defId, entityId: taskId },
          },
          create: {
            workspaceId: wsId,
            definitionId: defId,
            entityId: taskId,
            entityType: "TASK",
            value: "A",
          },
          update: { value: "B" },
        }),
    );
    expect(updated.value).toBe("B");
  });

  it("falla fail-closed si se opera CustomFieldValue scoped sin contexto", async () => {
    if (!dbUp) return;
    await expect(
      scoped!.customFieldValue.findMany({ where: {} }),
    ).rejects.toThrow();
  });
});
