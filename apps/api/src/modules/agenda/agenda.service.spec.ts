import { beforeEach, describe, expect, it, vi } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import { AgendaService } from "./agenda.service";

/**
 * El service no debe decidir nada: traduce filas de Prisma a la forma que pide
 * el dominio y le devuelve el resultado. Estos tests fijan esa traducción, que
 * es donde se puede colar un `dueDate` que llega como `Date` y el dominio espera
 * string ISO.
 */
function setup(tasks: unknown[] = []) {
  const prisma = {
    task: { findMany: vi.fn().mockResolvedValue(tasks) },
  };
  const access = {
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const service = new AgendaService(prisma as never, access as never);
  return { service, prisma, access };
}

function prismaTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: null,
    startDate: null,
    completedAt: null,
    assignees: [],
    ...overrides,
  };
}

describe("AgendaService.review", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exige membresía antes de leer tareas", async () => {
    const { service, access, prisma } = setup();

    await service.review("ws1", "u1", {});

    expect(access.assertMembership).toHaveBeenCalledWith("ws1", "u1");
    expect(prisma.task.findMany).toHaveBeenCalled();
  });

  it("solo trae las tareas abiertas del workspace", async () => {
    const { service, prisma } = setup();

    await service.review("ws1", "u1", {});

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws1",
          status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
        },
      }),
    );
  });

  it("pide una fila de más y ordena por vencimiento para acotar la lectura", async () => {
    const { service, prisma } = setup([]);

    await service.review("ws1", "u1", {});

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        take: 5001,
      }),
    );
  });

  it("marca truncated y recorta al tope cuando hay más tareas que el límite", async () => {
    const many = Array.from({ length: 5001 }, (_, i) =>
      prismaTask({ id: `t${i}` }),
    );
    const { service } = setup(many);

    const review = await service.review("ws1", "u1", {});

    expect(review.analyzedTasks).toBe(5000);
    expect(review.truncated).toBe(true);
  });

  it("no marca truncated cuando las tareas caben en el tope", async () => {
    const { service } = setup([
      prismaTask({ id: "a" }),
      prismaTask({ id: "b" }),
    ]);

    const review = await service.review("ws1", "u1", {});

    expect(review.analyzedTasks).toBe(2);
    expect(review.truncated).toBeUndefined();
  });

  it("traduce `assignees: [{ userId }]` a `[{ id }]`", async () => {
    const { service } = setup([
      prismaTask({
        id: "a",
        startDate: new Date(2026, 9, 6),
        assignees: [{ userId: "u1" }],
      }),
      prismaTask({
        id: "b",
        startDate: new Date(2026, 9, 6),
        assignees: [{ userId: "u1" }],
      }),
    ]);

    // Si la traducción se rompe, el solapamiento deja de detectarse en silencio.
    const review = await service.review("ws1", "u1", { dailyCapacity: 10 });

    expect(review.findings.filter((f) => f.kind === "OVERLAP")).toHaveLength(1);
  });

  it("convierte las fechas a ISO y deja en null las ausentes", async () => {
    const { service } = setup([
      prismaTask({ id: "t1", dueDate: new Date(2026, 9, 6), startDate: null }),
    ]);

    const review = await service.review("ws1", "u1", { dailyCapacity: 10 });

    expect(review.findings).toBeDefined();
    expect(review.analyzedTasks).toBe(1);
  });

  it("devuelve el conteo de tareas analizadas para que la UI pueda escalar", async () => {
    const { service } = setup([
      prismaTask({ id: "a" }),
      prismaTask({ id: "b" }),
      prismaTask({ id: "c" }),
    ]);

    expect((await service.review("ws1", "u1", {})).analyzedTasks).toBe(3);
  });

  it("no produce hallazgos con un workspace vacío", async () => {
    const { service } = setup([]);

    const review = await service.review("ws1", "u1", {});

    expect(review.findings).toEqual([]);
    expect(review.overloadedDays).toEqual([]);
    expect(review.analyzedTasks).toBe(0);
  });

  it("propaga el now inyectado en generatedAt", async () => {
    const { service } = setup([]);
    const now = new Date(2026, 9, 5, 10, 0, 0);

    const review = await service.review("ws1", "u1", {}, now);

    expect(review.generatedAt).toBe(now.toISOString());
  });

  it("rechaza un no miembro sin tocar la base", async () => {
    const { service, access, prisma } = setup();
    access.assertMembership.mockRejectedValue(new Error("Forbidden"));

    await expect(service.review("ws1", "u1", {})).rejects.toThrow("Forbidden");
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});
