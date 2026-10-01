import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import {
  detectAssistantIntent,
  resolveCompleteTarget,
  resolveRelativeTime,
  resolveReminderPayload,
  suggestibleTasks,
} from "../src/assistant";
import { makeTask } from "./helpers";

const now = new Date("2026-08-07T12:00:00Z");

describe("suggestibleTasks", () => {
  it("ordena vencidas, por vencer y prioridad alta, con datos reales", () => {
    const tasks = [
      makeTask({
        title: "Reporte",
        priority: Priority.HIGH,
        dueDate: "2026-08-10",
        status: TaskStatus.TODO,
      }),
      makeTask({
        title: "Vencida",
        priority: Priority.LOW,
        dueDate: "2026-08-05",
        status: TaskStatus.TODO,
      }),
      makeTask({
        title: "DONE",
        priority: Priority.HIGH,
        dueDate: "2026-08-05",
        status: TaskStatus.DONE,
        completedAt: "2026-08-06T10:00:00Z",
      }),
      makeTask({
        title: "Vence hoy",
        priority: Priority.MEDIUM,
        dueDate: "2026-08-07",
        status: TaskStatus.TODO,
      }),
      makeTask({
        title: "Urgente sin due",
        priority: Priority.URGENT,
        status: TaskStatus.TODO,
      }),
      makeTask({
        title: "Abierta",
        priority: Priority.LOW,
        status: TaskStatus.TODO,
      }),
    ];

    const result = suggestibleTasks(tasks, now, 5);
    expect(result.map((s) => s.title)).toEqual([
      "Vencida",
      "Vence hoy",
      "Urgente sin due",
      "Reporte",
      "Abierta",
    ]);
    expect(result[0]?.reason).toBe("Vencida");
    expect(result.some((s) => s.title === "DONE")).toBe(false);
  });

  it("respeta el límite", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({
        id: `t${i}`,
        title: `Tarea ${i}`,
        priority: Priority.MEDIUM,
        status: TaskStatus.TODO,
      }),
    );
    expect(suggestibleTasks(tasks, now, 3)).toHaveLength(3);
  });
});

describe("resolveRelativeTime", () => {
  it("resuelve minutos, horas y días", () => {
    expect(resolveRelativeTime("recordame en 30 minutos", now)?.getTime()).toBe(
      now.getTime() + 30 * 60_000,
    );
    expect(resolveRelativeTime("en 2 horas", now)?.getTime()).toBe(
      now.getTime() + 2 * 3_600_000,
    );
    expect(resolveRelativeTime("en 3 días", now)?.getTime()).toBe(
      now.getTime() + 3 * 86_400_000,
    );
  });

  it("resuelve expresiones relativas", () => {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(resolveRelativeTime("mañana", now)?.getTime()).toBe(
      tomorrow.getTime(),
    );
    const past = new Date(now);
    past.setDate(past.getDate() + 2);
    expect(resolveRelativeTime("pasado mañana", now)?.getTime()).toBe(
      past.getTime(),
    );
  });

  it("devuelve null si no hay momento resuelto", () => {
    expect(resolveRelativeTime("hola cómo estás", now)).toBeNull();
  });
});

describe("detectAssistantIntent", () => {
  it("detecta recordatorios antes que completion porque son mutuamente excluyentes", () => {
    expect(
      detectAssistantIntent("recordame en 1 hora que revise el mail"),
    ).toEqual({ kind: "reminder" });
    expect(detectAssistantIntent("avísame cuando pueda el jueves")).toEqual({
      kind: "reminder",
    });
  });

  it("detecta marcado como hecha", () => {
    expect(detectAssistantIntent("ya está listo")).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("la terminé")).toEqual({ kind: "complete" });
    expect(detectAssistantIntent("marcala como completada")).toEqual({
      kind: "complete",
    });
  });

  it("devuelve null para preguntas genéricas", () => {
    expect(detectAssistantIntent("¿qué tengo pendiente?")).toBeNull();
  });
});

describe("resolveCompleteTarget", () => {
  const suggestions = [
    {
      taskId: "t1",
      title: "Preparar demo",
      dueDate: null,
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      reason: "Prioridad alta",
    },
    {
      taskId: "t2",
      title: "Enviar propuesta",
      dueDate: null,
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      reason: "Abierta",
    },
  ];

  it("prioriza el título mencionado por el usuario", () => {
    const target = resolveCompleteTarget(
      "ya está lista, la de Enviar propuesta",
      suggestions,
      "Te sugiero empezar por Preparar demo",
    );
    expect(target?.taskId).toBe("t2");
  });

  it("cae a la sugerencia principal del último mensaje del asistente", () => {
    const target = resolveCompleteTarget(
      "ya está",
      suggestions,
      "Te sugiero empezar por Preparar demo",
    );
    expect(target?.taskId).toBe("t1");
  });

  it("devuelve null si no hay forma de resolver", () => {
    expect(resolveCompleteTarget("ya está", suggestions, "")).toBeNull();
    expect(
      resolveCompleteTarget("ya está", suggestions, "No hay tareas sugeridas"),
    ).toBeNull();
  });
});

describe("resolveReminderPayload", () => {
  it("arma recordatorio con título y momento", () => {
    const reminder = resolveReminderPayload(
      "recordame en 2 horas que mande el mail",
      [],
      now,
    );
    expect(reminder?.title).toBe("mande el mail");
    expect(reminder?.triggerAt.getTime()).toBe(now.getTime() + 2 * 3_600_000);
    expect(reminder?.taskId).toBeNull();
  });

  it("vincula la tarea mencionada", () => {
    const suggestions = [
      {
        taskId: "t9",
        title: "Preparar demo",
        dueDate: null,
        priority: Priority.HIGH,
        status: TaskStatus.TODO,
        reason: "Prioridad alta",
      },
    ];
    const reminder = resolveReminderPayload(
      "recordame en 1 hora con Preparar demo",
      suggestions,
      now,
    );
    expect(reminder?.taskId).toBe("t9");
  });

  it("devuelve null sin un momento claro", () => {
    expect(
      resolveReminderPayload("recordame revisar el mail", [], now),
    ).toBeNull();
  });
});
