import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "@taskmaster/contracts";
import { describe, expect, it, vi } from "vitest";
import { TimeEntriesService } from "./time-entries.service";

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry1",
    workspaceId: "ws1",
    taskId: "task1",
    userId: "owner",
    description: "trabajo",
    startedAt: new Date("2026-01-01T10:00:00Z"),
    stoppedAt: null,
    duration: null,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    user: { id: "owner", name: "Owner", avatarUrl: null },
    ...overrides,
  };
}

function setup(role: WorkspaceRole, entry = makeEntry()) {
  const prisma = {
    timeEntry: {
      findUnique: vi.fn().mockResolvedValue(entry),
      update: vi
        .fn()
        .mockResolvedValue(makeEntry({ stoppedAt: new Date(), duration: 60 })),
      delete: vi.fn().mockResolvedValue(entry),
    },
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue({ role }),
    assertRole: vi
      .fn()
      .mockImplementation(
        async (
          _w: string,
          _u: string,
          min: WorkspaceRole,
        ): Promise<{ role: WorkspaceRole }> => {
          const weights: Record<WorkspaceRole, number> = {
            VIEWER: 1,
            MEMBER: 2,
            ADMIN: 3,
            OWNER: 4,
          };
          if (weights[role] < weights[min]) {
            throw new ForbiddenException("No tienes permisos para esta acción");
          }
          return { role };
        },
      ),
  };
  const service = new TimeEntriesService(prisma as never, access as never);
  return { service, prisma, access };
}

describe("TimeEntriesService ownership", () => {
  it("permite al dueño detener su propia entrada", async () => {
    const { service, prisma } = setup(WorkspaceRole.MEMBER);

    await service.stop("ws1", "owner", "entry1");

    expect(prisma.timeEntry.update).toHaveBeenCalled();
  });

  it("bloquea a un MEMBER que intenta detener la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(service.stop("ws1", "owner", "entry1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  it("permite a un ADMIN detener la entrada ajena", async () => {
    const { service } = setup(
      WorkspaceRole.ADMIN,
      makeEntry({ userId: "otro" }),
    );

    await expect(service.stop("ws1", "owner", "entry1")).resolves.toBeDefined();
  });

  it("bloquea a un MEMBER que edita la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(
      service.update("ws1", "owner", "entry1", { description: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  it("bloquea a un MEMBER que elimina la entrada ajena", async () => {
    const { service, prisma } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ userId: "otro" }),
    );

    await expect(
      service.remove("ws1", "owner", "entry1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });

  it("oculta como no encontrada una entrada de otro workspace", async () => {
    const { service } = setup(
      WorkspaceRole.MEMBER,
      makeEntry({ workspaceId: "ws2" }),
    );

    await expect(
      service.remove("ws1", "owner", "entry1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("TimeEntriesService list (paginación y totales)", () => {
  function setupPrisma(entries: unknown[], count: number, sum: number | null) {
    const prisma = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue(entries),
        aggregate: vi
          .fn()
          .mockResolvedValue({ _count: count, _sum: { duration: sum } }),
      },
    };
    const access = {
      assertMembership: vi
        .fn()
        .mockResolvedValue({ role: WorkspaceRole.VIEWER }),
    };
    return { prisma, access };
  }

  it("devuelve la página pedida y los agregados del filtro completo", async () => {
    const { prisma, access } = setupPrisma([makeEntry()], 23, 5400);
    const service = new TimeEntriesService(prisma as never, access as never);

    const result = await service.list("ws1", "owner", {
      page: 2,
      pageSize: 10,
    });

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.total).toBe(23);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.totals).toEqual({ count: 23, durationSeconds: 5400 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "entry1", taskId: "task1" });
  });

  it("agrega sobre todas las filas del filtro, no solo la página", async () => {
    const { prisma, access } = setupPrisma(
      Array.from({ length: 10 }, (_, i) => makeEntry({ id: `e${i}` })),
      300,
      7200,
    );
    const service = new TimeEntriesService(prisma as never, access as never);

    const result = await service.list("ws1", "owner", {
      taskId: "task1",
      page: 3,
      pageSize: 10,
    });

    expect(prisma.timeEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taskId: "task1" }),
      }),
    );
    expect(result.total).toBe(300);
    expect(result.totals.durationSeconds).toBe(7200);
    expect(result.totals.count).toBe(300);
    expect(result.items).toHaveLength(10);
  });

  it("usa página 1 y tamaño por defecto cuando no se pasan", async () => {
    const { prisma, access } = setupPrisma([], 0, null);
    const service = new TimeEntriesService(prisma as never, access as never);

    const result = await service.list("ws1", "owner", {});

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.totals).toEqual({ count: 0, durationSeconds: 0 });
    expect(result.items).toEqual([]);
  });

  it("aplica desde/hasta al filtro y a los agregados", async () => {
    const from = new Date("2026-03-01T00:00:00Z");
    const to = new Date("2026-03-31T23:59:59Z");
    const { prisma, access } = setupPrisma([], 2, 300);
    const service = new TimeEntriesService(prisma as never, access as never);

    await service.list("ws1", "owner", { from, to });

    const expected = expect.objectContaining({
      startedAt: { gte: from, lte: to },
    });
    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expected }),
    );
    expect(prisma.timeEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expected }),
    );
  });

  it("aplica un rango por defecto cuando no se pasa from/to", async () => {
    const { prisma, access } = setupPrisma([], 0, null);
    const service = new TimeEntriesService(prisma as never, access as never);

    const before = Date.now();
    await service.list("ws1", "owner", {});
    const after = Date.now();

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0] as {
      where: { startedAt: { gte: Date; lte: Date } };
    };
    const { gte, lte } = call.where.startedAt;
    const spanDays = (lte.getTime() - gte.getTime()) / 86_400_000;
    expect(spanDays).toBeCloseTo(30, 5);
    expect(lte.getTime()).toBeGreaterThanOrEqual(before);
    expect(lte.getTime()).toBeLessThanOrEqual(after);
  });

  it("recorta una ventana mayor al máximo razonable", async () => {
    const from = new Date("2000-01-01T00:00:00Z");
    const to = new Date("2026-01-01T00:00:00Z");
    const { prisma, access } = setupPrisma([], 0, null);
    const service = new TimeEntriesService(prisma as never, access as never);

    await service.list("ws1", "owner", { from, to });

    const call = prisma.timeEntry.findMany.mock.calls[0]?.[0] as {
      where: { startedAt: { gte: Date; lte: Date } };
    };
    const { gte, lte } = call.where.startedAt;
    expect(lte.getTime()).toBe(to.getTime());
    expect((lte.getTime() - gte.getTime()) / 86_400_000).toBeCloseTo(366, 5);
  });
});

describe("TimeEntriesService totals (por tarea/persona/semana)", () => {
  type Row = {
    key: string;
    label: string | null;
    count: number;
    total: number;
  };

  function setupPrisma(rows: Row[]) {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
    const access = {
      assertMembership: vi
        .fn()
        .mockResolvedValue({ role: WorkspaceRole.VIEWER }),
    };
    return { prisma, access };
  }

  it("agrupa por tarea y suma los totales de los grupos", async () => {
    const rows: Row[] = [
      { key: "t1", label: "Diseño", count: 3, total: 3600 },
      { key: "t2", label: "API", count: 2, total: 1800 },
    ];
    const { prisma, access } = setupPrisma(rows);
    const service = new TimeEntriesService(prisma as never, access as never);

    const report = await service.totals("ws1", "owner", { groupBy: "task" });

    expect(report.groupBy).toBe("task");
    expect(report.groups).toEqual([
      { key: "t1", label: "Diseño", count: 3, durationSeconds: 3600 },
      { key: "t2", label: "API", count: 2, durationSeconds: 1800 },
    ]);
    expect(report.totals).toEqual({ count: 5, durationSeconds: 5400 });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("en semanas deja el label en null", async () => {
    const { prisma, access } = setupPrisma([
      { key: "2026-W15", label: null, count: 4, total: 7200 },
    ]);
    const service = new TimeEntriesService(prisma as never, access as never);

    const report = await service.totals("ws1", "owner", { groupBy: "week" });

    expect(report.groups[0]).toEqual({
      key: "2026-W15",
      label: null,
      count: 4,
      durationSeconds: 7200,
    });
  });

  it("normaliza el rango del reporte cuando no se manda from/to", async () => {
    const { prisma, access } = setupPrisma([]);
    const service = new TimeEntriesService(prisma as never, access as never);

    const before = Date.now();
    const report = await service.totals("ws1", "owner", { groupBy: "user" });
    const after = Date.now();

    const from = new Date(report.from).getTime();
    const to = new Date(report.to).getTime();
    expect((to - from) / 86_400_000).toBeCloseTo(30, 5);
    expect(to).toBeGreaterThanOrEqual(before);
    expect(to).toBeLessThanOrEqual(after);
  });
});
