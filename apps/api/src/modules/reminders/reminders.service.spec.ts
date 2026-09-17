import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ReminderRepeat } from "@taskmaster/contracts";
import { RemindersService } from "./reminders.service";

const WORKSPACE_ID = "ws1";
const USER_ID = "user1";

interface FakeReminderRow {
  id: string;
  workspaceId: string;
  userId: string;
  taskId: string | null;
  noteId: string | null;
  title: string;
  triggerAt: Date;
  sentAt: Date | null;
  repeat: ReminderRepeat;
  createdAt: Date;
}

function makeReminder(
  overrides: Partial<FakeReminderRow> = {},
): FakeReminderRow {
  return {
    id: "r1",
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    taskId: null,
    noteId: null,
    title: "Recordatorio",
    triggerAt: new Date("2024-05-01T10:00:00.000Z"),
    sentAt: null,
    repeat: ReminderRepeat.NONE,
    createdAt: new Date("2024-04-01T00:00:00.000Z"),
    ...overrides,
  };
}

function setup(options: {
  existing?: FakeReminderRow | null;
  taskInWorkspace?: boolean;
  noteInWorkspace?: boolean;
}) {
  const prisma = {
    task: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.taskInWorkspace === false ? null : { id: "task1" },
        ),
    },
    note: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.noteInWorkspace === false ? null : { id: "note1" },
        ),
    },
    reminder: {
      create: vi.fn(({ data }: { data: Partial<FakeReminderRow> }) =>
        Promise.resolve(makeReminder(data)),
      ),
      update: vi.fn(({ data }: { data: Partial<FakeReminderRow> }) =>
        Promise.resolve(makeReminder({ ...(options.existing ?? {}), ...data })),
      ),
      findUnique: vi.fn().mockResolvedValue(options.existing ?? null),
    },
  };
  const access = { assertWriteRole: vi.fn().mockResolvedValue({ id: "m1" }) };
  const notifications = { create: vi.fn() };
  const unscoped = {
    reminder: prisma.reminder,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(unscoped)),
  };
  const service = new RemindersService(
    prisma as never,
    unscoped as never,
    access as never,
    notifications as never,
  );
  return { service, prisma, access };
}

describe("RemindersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza crear un recordatorio con tarea de otro workspace", async () => {
    const { service, prisma } = setup({ taskInWorkspace: false });

    await expect(
      service.create(WORKSPACE_ID, USER_ID, {
        title: "X",
        triggerAt: new Date(),
        repeat: ReminderRepeat.NONE,
        taskId: "foreign",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it("crea el recordatorio cuando la tarea pertenece al workspace", async () => {
    const { service, prisma } = setup({});

    const reminder = await service.create(WORKSPACE_ID, USER_ID, {
      title: "X",
      triggerAt: new Date("2024-05-01T10:00:00.000Z"),
      repeat: ReminderRepeat.NONE,
      taskId: "task1",
    });

    expect(reminder.taskId).toBe("task1");
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task1", workspaceId: WORKSPACE_ID },
      select: { id: true },
    });
  });

  it("lanza NotFound al actualizar un recordatorio inexistente", async () => {
    const { service } = setup({ existing: null });

    await expect(
      service.update(WORKSPACE_ID, "missing", USER_ID, { title: "nuevo" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rechaza actualizar con una nota de otro workspace", async () => {
    const { service, prisma } = setup({
      existing: makeReminder(),
      noteInWorkspace: false,
    });

    await expect(
      service.update(WORKSPACE_ID, "r1", USER_ID, { noteId: "foreign" }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it("actualiza el recordatorio cuando los targets son válidos", async () => {
    const { service } = setup({ existing: makeReminder() });

    const reminder = await service.update(WORKSPACE_ID, "r1", USER_ID, {
      title: "actualizado",
      taskId: "task1",
    });

    expect(reminder.title).toBe("actualizado");
    expect(reminder.taskId).toBe("task1");
  });
});
