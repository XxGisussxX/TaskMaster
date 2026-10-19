import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import { TasksService } from "./tasks.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "u1";

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    workspaceId: WORKSPACE_ID,
    creatorId: USER_ID,
    title: "tarea",
    description: "",
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: null,
    startDate: null,
    order: 1,
    parentId: null,
    channelId: null,
    channel: null,
    isRecurring: false,
    recurrence: null,
    completedAt: null,
    dueSoNotifiedAt: null,
    tags: [],
    assignees: [],
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function setup() {
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  const findUnique = vi.fn().mockResolvedValue(null);
  const count = vi.fn().mockResolvedValue(0);
  const create = vi.fn();
  const update = vi.fn();
  const remove = vi.fn().mockResolvedValue(undefined);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const aggregate = vi.fn().mockResolvedValue({ _max: { order: null } });
  const channelCount = vi.fn().mockResolvedValue(0);
  const tagCount = vi.fn().mockResolvedValue(0);
  const memberCount = vi.fn().mockResolvedValue(0);

  const prisma = {
    task: {
      findMany,
      findFirst,
      findUnique,
      count,
      create,
      update,
      delete: remove,
      deleteMany,
      aggregate,
    },
    channel: { count: channelCount },
    tag: { count: tagCount },
    workspaceMember: { count: memberCount },
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    ),
  };
  const access = {
    assertWriteRole: vi.fn().mockResolvedValue(undefined),
    assertMembership: vi.fn().mockResolvedValue(undefined),
  };
  const activity = { log: vi.fn().mockResolvedValue(undefined) };
  const events = { emit: vi.fn() };
  const service = new TasksService(
    prisma as never,
    access as never,
    activity as never,
    events as never,
  );
  return {
    service,
    mock: {
      findMany,
      findFirst,
      findUnique,
      count,
      create,
      update,
      remove,
      deleteMany,
      aggregate,
      channelCount,
    },
    access,
    activity,
    events,
  };
}

const baseFilters = {
  page: 1,
  pageSize: 20,
};

describe("TasksService", () => {
  describe("list", () => {
    it("devuelve items paginados y exige membresía", async () => {
      const { service, mock, access } = setup();
      mock.findMany.mockResolvedValue([makeTask()]);
      mock.count.mockResolvedValue(1);

      const result = await service.list(WORKSPACE_ID, USER_ID, baseFilters);

      expect(access.assertMembership).toHaveBeenCalledWith(
        WORKSPACE_ID,
        USER_ID,
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("calcula skip/take según la página", async () => {
      const { service, mock } = setup();
      mock.findMany.mockResolvedValue([]);
      mock.count.mockResolvedValue(45);

      const result = await service.list(WORKSPACE_ID, USER_ID, {
        page: 3,
        pageSize: 20,
      });

      expect(result.totalPages).toBe(3);
      expect(mock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe("get", () => {
    it("lanza NotFound si la tarea no existe en el workspace", async () => {
      const { service, mock } = setup();
      mock.findFirst.mockResolvedValue(null);

      await expect(service.get(WORKSPACE_ID, "t1", USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("incluye subtareas en el DTO", async () => {
      const { service, mock } = setup();
      mock.findFirst.mockResolvedValue({
        ...makeTask(),
        subtasks: [makeTask({ id: "t2" })],
      });

      const result = await service.get(WORKSPACE_ID, "t1", USER_ID);

      expect(result.subtasks).toHaveLength(1);
      expect(result.subtasks[0]!.id).toBe("t2");
    });
  });

  describe("create", () => {
    it("crea la tarea, registra actividad y emite el evento", async () => {
      const { service, mock, activity, events } = setup();
      mock.aggregate.mockResolvedValue({ _max: { order: 4 } });
      mock.create.mockResolvedValue(makeTask({ order: 5 }));

      const result = await service.create(WORKSPACE_ID, USER_ID, {
        title: "nueva",
      } as never);

      expect(result.order).toBe(5);
      expect(activity.log).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        "task.created",
        expect.objectContaining({ workspaceId: WORKSPACE_ID }),
      );
    });

    it("rechaza si una relación no existe en el workspace", async () => {
      const { service, mock } = setup();
      mock.channelCount.mockResolvedValue(0);

      await expect(
        service.create(WORKSPACE_ID, USER_ID, {
          title: "x",
          channelId: "c1",
        } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("update", () => {
    it("lanza NotFound si no existe", async () => {
      const { service, mock } = setup();
      mock.findFirst.mockResolvedValue(null);

      await expect(
        service.update(WORKSPACE_ID, "t1", USER_ID, {} as never),
      ).rejects.toThrow(NotFoundException);
    });

    it("actualiza y registra el diff de cambios", async () => {
      const { service, mock, activity } = setup();
      mock.findFirst.mockResolvedValue(makeTask({ title: "viejo" }));
      mock.update.mockResolvedValue(makeTask({ title: "nuevo" }));

      const result = await service.update(WORKSPACE_ID, "t1", USER_ID, {
        title: "nuevo",
      } as never);

      expect(result.title).toBe("nuevo");
      expect(activity.log).toHaveBeenCalled();
    });

    it("al pasar a DONE marca el subárbol y crea la siguiente ocurrencia", async () => {
      const { service, mock } = setup();
      mock.findFirst.mockResolvedValue(
        makeTask({
          isRecurring: true,
          recurrence: { frequency: "DAILY", interval: 1 },
          dueDate: new Date("2024-01-01T00:00:00.000Z"),
        }),
      );
      mock.update.mockResolvedValue(makeTask({ status: TaskStatus.DONE }));
      mock.findMany.mockResolvedValue([]);
      mock.findUnique.mockResolvedValue({
        ...makeTask(),
        tags: [],
        assignees: [],
      });
      mock.aggregate.mockResolvedValue({ _max: { order: 0 } });
      mock.create.mockResolvedValue(makeTask({ id: "next" }));

      await service.update(WORKSPACE_ID, "t1", USER_ID, {
        status: TaskStatus.DONE,
      } as never);

      expect(mock.create).toHaveBeenCalled();
    });
  });

  describe("setStatus", () => {
    it("emite task.status-changed con el estado previo y nuevo", async () => {
      const { service, mock, events } = setup();
      mock.findFirst.mockResolvedValue(makeTask({ status: TaskStatus.TODO }));
      mock.update.mockResolvedValue(
        makeTask({ status: TaskStatus.IN_PROGRESS }),
      );

      await service.setStatus(
        WORKSPACE_ID,
        "t1",
        USER_ID,
        TaskStatus.IN_PROGRESS,
      );

      expect(events.emit).toHaveBeenCalledWith(
        "task.status-changed",
        expect.objectContaining({
          oldStatus: TaskStatus.TODO,
          newStatus: TaskStatus.IN_PROGRESS,
        }),
      );
    });
  });

  describe("remove", () => {
    it("borra la tarea y sus descendientes", async () => {
      const { service, mock } = setup();
      mock.findFirst.mockResolvedValue(makeTask());
      mock.findMany
        .mockResolvedValueOnce([{ id: "t2" }])
        .mockResolvedValueOnce([]);

      const result = await service.remove(WORKSPACE_ID, "t1", USER_ID);

      expect(result).toEqual({ id: "t1" });
      expect(mock.remove).toHaveBeenCalledWith({ where: { id: "t1" } });
    });
  });

  describe("bulkUpdateStatus", () => {
    it("separa los ids exitosos de los inexistentes", async () => {
      const { service, mock } = setup();
      mock.findMany.mockResolvedValue([{ id: "t1", status: TaskStatus.TODO }]);
      mock.update.mockResolvedValue(makeTask());
      mock.findUnique.mockResolvedValue(null);

      const result = await service.bulkUpdateStatus(
        WORKSPACE_ID,
        USER_ID,
        ["t1", "missing"],
        TaskStatus.DONE,
      );

      expect(result.succeeded).toEqual(["t1"]);
      expect(result.failed).toEqual([
        { id: "missing", error: "Tarea no encontrada" },
      ]);
    });

    it("no actualiza tareas que ya tienen el estado destino", async () => {
      const { service, mock } = setup();
      mock.findMany.mockResolvedValue([{ id: "t1", status: TaskStatus.DONE }]);

      const result = await service.bulkUpdateStatus(
        WORKSPACE_ID,
        USER_ID,
        ["t1"],
        TaskStatus.DONE,
      );

      expect(result.succeeded).toEqual([]);
      expect(mock.update).not.toHaveBeenCalled();
    });
  });

  describe("bulkDelete", () => {
    it("reporta los ids no encontrados", async () => {
      const { service, mock } = setup();
      mock.findMany
        .mockResolvedValueOnce([{ id: "t1" }])
        .mockResolvedValueOnce([]);

      const result = await service.bulkDelete(WORKSPACE_ID, USER_ID, [
        "t1",
        "nope",
      ]);

      expect(result.succeeded).toEqual(["t1"]);
      expect(result.failed).toEqual([
        { id: "nope", error: "Tarea no encontrada" },
      ]);
    });
  });
});
