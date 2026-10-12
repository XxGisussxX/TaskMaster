import "reflect-metadata";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  buildActivitySeries,
  buildHeatmapData,
  buildKpiTrends,
  computeKpis,
  priorityDistribution,
} from "@taskmaster/domain";
import {
  Priority,
  TaskStatus,
  WorkspaceRole,
  type Task as DomainTask,
} from "@taskmaster/contracts";
import { createPrismaClient } from "../../prisma/prisma.service";
import { tenantContext } from "../../tenant/tenant-context";
import { DashboardService } from "./dashboard.service";

/**
 * Equivalencia del dashboard SQL contra el cálculo puro del dominio, que es el
 * oráculo: para el mismo conjunto de tareas, KPIs, series, distribuciones y
 * tendencias tienen que coincidir exactamente. Se salta si no hay base.
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
const FROM = "2025-02-01";
const TO = "2025-02-28";
const YEAR = 2025;

let dbUp = false;
let ownerId = "";
let viewerId = "";
let workspaceId = "";

/** Fecha local a mediodía, para que el día calendario sea inequívoco. */
function at(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

interface SeedTask {
  title: string;
  status: TaskStatus;
  priority: Priority;
  createdAt: Date;
  dueDate?: Date | null;
  completedAt?: Date | null;
  archived?: boolean;
  assignees?: string[];
}

const SEED: SeedTask[] = [
  // Abiertas con vencimiento previo a hoy (vencidas reales).
  {
    title: "todo vencida antes ventana",
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    createdAt: at(2025, 1, 10),
    dueDate: at(2025, 1, 20),
  },
  {
    title: "todo vencida en ventana",
    status: TaskStatus.TODO,
    priority: Priority.LOW,
    createdAt: at(2025, 2, 1),
    dueDate: at(2025, 2, 10),
  },
  {
    title: "todo vence sobre el fin",
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.URGENT,
    createdAt: at(2025, 2, 2),
    dueDate: at(2025, 2, 28),
  },
  {
    title: "todo sin vencimiento",
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    createdAt: at(2025, 2, 3),
  },
  {
    title: "todo creada antes con vence antes",
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    createdAt: at(2025, 1, 15),
    dueDate: at(2025, 1, 16),
  },
  {
    title: "todo creada despues de ventana",
    status: TaskStatus.TODO,
    priority: Priority.LOW,
    createdAt: at(2025, 3, 5),
    dueDate: at(2025, 3, 20),
  },
  // DONE y archivadas.
  {
    title: "done completa en ventana tras vencer",
    status: TaskStatus.DONE,
    priority: Priority.MEDIUM,
    createdAt: at(2025, 1, 20),
    dueDate: at(2025, 1, 25),
    completedAt: at(2025, 2, 5),
  },
  {
    title: "done completa el mismo dia del vence",
    status: TaskStatus.DONE,
    priority: Priority.HIGH,
    createdAt: at(2025, 2, 1),
    dueDate: at(2025, 2, 8),
    completedAt: at(2025, 2, 8),
  },
  {
    title: "done completa el dia siguiente al vence",
    status: TaskStatus.DONE,
    priority: Priority.LOW,
    createdAt: at(2025, 2, 2),
    dueDate: at(2025, 2, 9),
    completedAt: at(2025, 2, 10),
  },
  {
    title: "done completa antes de ventana",
    status: TaskStatus.DONE,
    priority: Priority.MEDIUM,
    createdAt: at(2025, 1, 5),
    dueDate: at(2025, 1, 12),
    completedAt: at(2025, 1, 20),
  },
  {
    title: "done completa despues de ventana",
    status: TaskStatus.DONE,
    priority: Priority.HIGH,
    createdAt: at(2025, 2, 10),
    dueDate: at(2025, 2, 15),
    completedAt: at(2025, 3, 3),
  },
  {
    title: "done sin completedAt",
    status: TaskStatus.DONE,
    priority: Priority.LOW,
    createdAt: at(2025, 2, 11),
    dueDate: at(2025, 2, 12),
  },
  {
    title: "done creada sobre el inicio",
    status: TaskStatus.DONE,
    priority: Priority.MEDIUM,
    createdAt: at(2025, 2, 1),
    dueDate: at(2025, 2, 2),
    completedAt: at(2025, 2, 3),
  },
  {
    title: "archivada",
    status: TaskStatus.ARCHIVED,
    priority: Priority.HIGH,
    createdAt: at(2025, 2, 4),
    dueDate: at(2025, 2, 5),
    archived: true,
  },
  {
    title: "en revision creada en ventana",
    status: TaskStatus.IN_REVIEW,
    priority: Priority.MEDIUM,
    createdAt: at(2025, 2, 20),
    dueDate: at(2025, 2, 25),
  },
];

function makeService(): DashboardService {
  const access = {
    assertMembership: async (wsId: string, userId: string) => {
      const member = await admin!.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: wsId, userId } },
      });
      if (!member)
        throw new ForbiddenException("No eres miembro de este workspace");
      return member;
    },
  };
  const activity = { list: async () => [] };
  return new DashboardService(
    scoped as never,
    access as never,
    activity as never,
  );
}

function asWorkspace<T>(
  userId: string,
  role: WorkspaceRole,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContext.run({ userId, workspaceId, role }, async () => fn());
}

describe("dashboard SQL vs dominio (integración Postgres)", () => {
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
        email: `dash-owner-${suffix}@test.local`,
        name: "Owner",
        passwordHash: "x",
        isEmailVerified: true,
      },
    });
    const viewer = await admin.user.create({
      data: {
        email: `dash-viewer-${suffix}@test.local`,
        name: "Viewer",
        passwordHash: "x",
        isEmailVerified: true,
      },
    });
    ownerId = owner.id;
    viewerId = viewer.id;

    const ws = await admin.workspace.create({
      data: {
        name: "Dash Bench",
        slug: `dash-${suffix}`,
        ownerId,
        members: {
          create: [
            { userId: ownerId, role: WorkspaceRole.OWNER },
            { userId: viewerId, role: WorkspaceRole.VIEWER },
          ],
        },
      },
    });
    workspaceId = ws.id;

    for (const t of SEED) {
      const assignees =
        t.assignees ?? (t.title.startsWith("todo") ? [ownerId] : []);
      await admin.task.create({
        data: {
          workspaceId,
          creatorId: ownerId,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          dueDate: t.dueDate ?? null,
          completedAt: t.completedAt ?? null,
          assignees: {
            create: assignees.map((userId) => ({ userId })),
          },
        },
      });
    }

    await admin.timeEntry.create({
      data: {
        workspaceId,
        taskId: (
          await admin.task.findFirstOrThrow({
            where: { workspaceId, title: "todo sin vencimiento" },
          })
        ).id,
        userId: ownerId,
        startedAt: at(2025, 2, 3),
        stoppedAt: at(2025, 2, 3),
        duration: 3600,
      },
    });
  });

  afterAll(async () => {
    if (!admin || !dbUp) return;
    if (workspaceId)
      await admin.workspace
        .delete({ where: { id: workspaceId } })
        .catch(() => {});
    if (ownerId)
      await admin.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (viewerId)
      await admin.user.delete({ where: { id: viewerId } }).catch(() => {});
    await admin.$disconnect();
  });

  it("coincide con el oráculo del dominio", async (ctx) => {
    if (!admin || !dbUp) return ctx.skip();

    const query = { from: FROM, to: TO, year: YEAR };
    const service = makeService();
    const stats = await asWorkspace(ownerId, WorkspaceRole.OWNER, () =>
      service.stats(workspaceId, ownerId, query),
    );

    const rows = await admin.task.findMany({
      where: { workspaceId, status: { not: TaskStatus.ARCHIVED } },
      select: {
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
      },
    });
    const domainTasks: DomainTask[] = rows.map((t) => ({
      id: "",
      workspaceId,
      creatorId: "",
      title: "",
      description: "",
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      startDate: null,
      order: 0,
      parentId: null,
      channelId: null,
      tags: [],
      assignees: [],
      subtasks: [],
      isRecurring: false,
      recurrence: null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    }));

    const now = new Date();
    const from = new Date(2025, 1, 1);
    const to = new Date(2025, 1, 28);

    expect(stats.kpis).toEqual(computeKpis(domainTasks, now));
    expect(stats.priorityDistribution).toEqual(
      priorityDistribution(domainTasks),
    );
    expect(stats.createdCompletedSeries).toEqual(
      buildActivitySeries(domainTasks, from, to),
    );
    expect(stats.kpiTrends).toEqual(buildKpiTrends(domainTasks, from, to));
    expect(stats.heatmap).toEqual(buildHeatmapData(domainTasks, YEAR));

    expect(stats.range).toEqual({ from: FROM, to: TO });
  });

  it("expone datos por persona solo a ADMIN/OWNER", async (ctx) => {
    if (!dbUp) return ctx.skip();
    const service = makeService();
    const ownerStats = await asWorkspace(ownerId, WorkspaceRole.OWNER, () =>
      service.stats(workspaceId, ownerId, { from: FROM, to: TO, year: YEAR }),
    );
    expect(ownerStats.workloadByPerson?.length).toBeGreaterThan(0);
    expect(ownerStats.hoursByPerson?.some((h) => h.seconds === 3600)).toBe(
      true,
    );

    const viewerStats = await asWorkspace(viewerId, WorkspaceRole.VIEWER, () =>
      service.stats(workspaceId, viewerId, { from: FROM, to: TO, year: YEAR }),
    );
    expect(viewerStats.workloadByPerson).toBeUndefined();
    expect(viewerStats.hoursByPerson).toBeUndefined();
  });
});
