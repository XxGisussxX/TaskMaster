import { describe, expect, it } from "vitest";
import { Priority, TaskStatus, type Task } from "@taskmaster/contracts";
import {
  addDays,
  computeTeamLoad,
  formatLongToday,
  isOpen,
  partOfDayGreeting,
  startOfWeek,
  upcomingDeadlines,
  weekCompleted,
} from "./dashboardStats";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspaceId: "ws-1",
    creatorId: "u-1",
    title: "Tarea",
    description: "",
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    dueDate: null,
    startDate: null,
    order: 0,
    parentId: null,
    channelId: null,
    tags: [],
    assignees: [],
    subtasks: [],
    isRecurring: false,
    recurrence: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("dashboardStats → startOfWeek / addDays", () => {
  it("retorna el lunes de la semana para un jueves", () => {
    const monday = startOfWeek(new Date(2026, 9, 22)); // jueves 22/10
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(9);
    expect(monday.getDate()).toBe(19);
    expect(monday.getHours()).toBe(0);
  });

  it("addDays suma días cruzando meses", () => {
    const result = addDays(new Date(2026, 9, 30), 4);
    expect(result.getMonth()).toBe(10);
    expect(result.getDate()).toBe(3);
  });
});

describe("dashboardStats → weekCompleted", () => {
  const thursday = new Date(2026, 9, 22);
  const mondayOfWeek = startOfWeek(thursday); // 19/10
  const previousWeekStart = addDays(mondayOfWeek, -7); // 12/10
  const series = [
    ...Array.from({ length: 7 }, (_, i) => {
      const d = addDays(mondayOfWeek, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { date: iso, completed: 1 };
    }),
    ...Array.from({ length: 7 }, (_, i) => {
      const d = addDays(previousWeekStart, i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { date: iso, completed: 2 };
    }),
  ];

  it("suma 7 en la semana actual y 14 en la anterior (+100% → cambio -50%)", () => {
    const result = weekCompleted(series, thursday);
    expect(result.current).toBe(7);
    expect(result.previous).toBe(14);
    expect(result.changePct).toBe(-50);
  });

  it("ignora semanas fuera de la ventana", () => {
    const result = weekCompleted(series.slice(0, 3), thursday);
    expect(result.current).toBe(3);
    expect(result.previous).toBe(0);
  });

  it("sin datos previos con tareas actuales reporta +100%", () => {
    const result = weekCompleted(series.slice(0, 7), thursday);
    expect(result.current).toBe(7);
    expect(result.previous).toBe(0);
    expect(result.changePct).toBe(100);
  });
});

describe("dashboardStats → saludos y fecha", () => {
  it("saluda según la franja horaria", () => {
    expect(partOfDayGreeting(8)).toBe("Buenos días");
    expect(partOfDayGreeting(13)).toBe("Buenas tardes");
    expect(partOfDayGreeting(21)).toBe("Buenas noches");
  });

  it("formatea día y fecha en español", () => {
    const formatted = formatLongToday(new Date(2026, 9, 22));
    expect(formatted.toLowerCase()).toContain("jueves");
    expect(formatted.toLowerCase()).toContain("octubre");
  });
});

describe("dashboardStats → tareas", () => {
  it("isOpen excluye completadas y archivadas", () => {
    expect(isOpen(makeTask())).toBe(true);
    expect(isOpen(makeTask({ status: TaskStatus.DONE }))).toBe(false);
    expect(isOpen(makeTask({ status: TaskStatus.ARCHIVED }))).toBe(false);
  });

  it("upcomingDeadlines ordena por vencimiento y omite pasadas/completadas", () => {
    const now = new Date(2026, 9, 20);
    const tasks = [
      makeTask({
        id: "t1",
        dueDate: "2026-10-25T12:00:00.000Z",
        title: "Más lejana",
      }),
      makeTask({
        id: "t2",
        dueDate: "2026-10-21T12:00:00.000Z",
        title: "Cercana",
      }),
      makeTask({
        id: "t3",
        dueDate: "2026-10-19T12:00:00.000Z",
        title: "Vencida ayer",
      }),
      makeTask({
        id: "t4",
        dueDate: "2026-10-22T12:00:00.000Z",
        status: TaskStatus.DONE,
      }),
      makeTask({ id: "t5", dueDate: null, title: "Sin fecha" }),
    ];
    const result = upcomingDeadlines(tasks, now, 10);
    expect(result.map((t) => t.id)).toEqual(["t2", "t1"]);
  });
});

describe("dashboardStats → computeTeamLoad", () => {
  const alice = {
    id: "u-a",
    name: "Alice",
    email: "alice@test.dev",
    avatarUrl: null,
  };
  const bob = {
    id: "u-b",
    name: "Bob",
    email: "bob@test.dev",
    avatarUrl: null,
  };
  const tasks: Task[] = [
    makeTask({
      id: "1",
      status: TaskStatus.IN_PROGRESS,
      assignees: [alice],
    }),
    makeTask({ id: "2", assignees: [alice] }),
    makeTask({ id: "3", status: TaskStatus.DONE, assignees: [bob] }),
    makeTask({ id: "4", status: TaskStatus.TODO, assignees: [] }),
  ];
  const members = [
    { userId: "u-a", role: "MEMBER" as const, user: alice },
    { userId: "u-b", role: "ADMIN" as const, user: bob },
  ];

  it("distribuye tareas abiertas y completadas por asignado", () => {
    const load = computeTeamLoad(tasks, members, "u-b");
    expect(load.totalOpen).toBe(3);
    expect(load.totalCompleted).toBe(1);
    expect(load.unassignedOpen).toBe(1);
    expect(load.members.find((m) => m.userId === "u-a")).toMatchObject({
      open: 2,
      completed: 0,
      currentUser: false,
    });
    expect(load.members.find((m) => m.userId === "u-b")).toMatchObject({
      open: 0,
      completed: 1,
      currentUser: true,
      role: "ADMIN",
    });
  });

  it("ordena por carga descendente", () => {
    const load = computeTeamLoad(tasks, members);
    expect(load.members[0]!.userId).toBe("u-a");
  });
});
