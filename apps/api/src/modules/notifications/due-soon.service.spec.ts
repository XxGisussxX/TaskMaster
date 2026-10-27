import { describe, expect, it, vi } from "vitest";
import { TaskStatus } from "@taskmaster/contracts";
import { DueSoonService } from "./due-soon.service";

function setup(tasks: unknown[] = []) {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const notifications = {
    create: vi.fn().mockResolvedValue({ id: "n1" }),
  };
  const prisma = {
    task: {
      findMany: vi.fn().mockResolvedValue(tasks),
      updateMany,
    },
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
  return { service, prisma, notifications, updateMany };
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
      orderBy: { dueDate: "asc" },
      take: 500,
    });
  });

  it("reclama la tarea y notifica a cada asignado con DUE_SOON", async () => {
    const { service, notifications, updateMany } = setup([
      task({ assignees: [{ userId: "u1" }, { userId: "u2" }] }),
    ]);

    await service.handleDueSoon();

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "t1", dueSoNotifiedAt: null },
      data: { dueSoNotifiedAt: expect.any(Date) },
    });
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
  });

  it("no notifica si otra réplica ya reclamó la tarea", async () => {
    const { service, notifications, updateMany } = setup([task()]);
    updateMany.mockResolvedValueOnce({ count: 0 });

    await service.handleDueSoon();

    expect(notifications.create).not.toHaveBeenCalled();
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

  it("libera el claim si falla la notificación, para reintentar", async () => {
    const { service, notifications, updateMany } = setup([task()]);
    notifications.create.mockRejectedValueOnce(new Error("boom"));

    await service.handleDueSoon();

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { id: "t1", dueSoNotifiedAt: expect.any(Date) },
      data: { dueSoNotifiedAt: null },
    });
  });

  it("no hace nada si no hay tareas en la ventana", async () => {
    const { service, notifications } = setup([]);

    await service.handleDueSoon();

    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("aísla el error de una tarea sin cortar el resto", async () => {
    const { service, notifications, updateMany } = setup([
      task({ id: "t1", assignees: [{ userId: "u1" }] }),
      task({ id: "t2", title: "Otra", assignees: [{ userId: "u2" }] }),
    ]);

    updateMany
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ count: 1 });

    await service.handleDueSoon();

    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u2" }),
    );
  });
});
