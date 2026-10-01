import { describe, expect, it, vi } from "vitest";
import { TaskStatus } from "@taskmaster/contracts";
import { DueSoonService } from "./due-soon.service";

function setup(tasks: unknown[] = []) {
  const txUpdate = vi.fn().mockResolvedValue({ id: "t1" });
  const notifications = {
    create: vi.fn().mockResolvedValue({ id: "n1" }),
  };
  const prisma = {
    task: {
      findMany: vi.fn().mockResolvedValue(tasks),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ task: { update: txUpdate } }),
    ),
  };
  const config = {
    get: vi.fn((key: string) =>
      key === "DUE_SOON_WINDOW_HOURS" ? 24 : undefined,
    ),
  };
  const service = new DueSoonService(
    prisma as never,
    notifications as never,
    config as never,
  );
  return { service, prisma, notifications, txUpdate };
}

function task(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "t1",
    workspaceId: "ws1",
    title: "Preparar demo",
    dueDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
    creatorId: "u0",
    assignees: [{ userId: "u1" }],
    ...overrides,
  };
}

describe("DueSoonService.handleDueSoon", () => {
  it("consulta tareas en la ventana de vencimiento sin notificar previamente", async () => {
    const { service, prisma } = setup([]);

    await service.handleDueSoon();

    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: {
        dueDate: { gte: expect.any(Date), lte: expect.any(Date) },
        status: { notIn: [TaskStatus.DONE, TaskStatus.ARCHIVED] },
        dueSoNotifiedAt: null,
      },
      select: expect.objectContaining({ id: true, title: true, dueDate: true }),
    });
  });

  it("notifica a cada asignado con DUE_SOON y marca la tarea como notificada", async () => {
    const { service, notifications, txUpdate } = setup([
      task({ assignees: [{ userId: "u1" }, { userId: "u2" }] }),
    ]);

    await service.handleDueSoon();

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        workspaceId: "ws1",
        type: "DUE_SOON",
        title: 'La tarea "Preparar demo" vence pronto',
        data: expect.objectContaining({ taskId: "t1" }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2", type: "DUE_SOON" }),
    );
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { dueSoNotifiedAt: expect.any(Date) },
    });
  });

  it("deduplica asignados repetidos (una notificación por usuario)", async () => {
    const { service, notifications } = setup([
      task({ assignees: [{ userId: "u1" }, { userId: "u1" }] }),
    ]);

    await service.handleDueSoon();

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
  });

  it("notifica al creador si la tarea no tiene asignados", async () => {
    const { service, notifications } = setup([
      task({ assignees: [], creatorId: "u0" }),
    ]);

    await service.handleDueSoon();

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u0" }),
    );
  });

  it("no hace nada si no hay tareas en la ventana", async () => {
    const { service, notifications } = setup([]);

    await service.handleDueSoon();

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("aísla el error de una tarea sin cortar el resto", async () => {
    const { service, prisma, notifications } = setup([
      task({ id: "t1", assignees: [{ userId: "u1" }] }),
      task({ id: "t2", title: "Otra", assignees: [{ userId: "u2" }] }),
    ]);

    prisma.$transaction = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ task: { update: vi.fn() } }),
      );

    await service.handleDueSoon();

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2" }),
    );
  });
});
