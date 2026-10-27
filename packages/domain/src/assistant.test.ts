import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import {
  detectAssistantIntent,
  detectTaskScope,
  extractTaskRefs,
  isConfirmation,
  isTaskCountQuestion,
  parseTaskCount,
  resolveCompleteTarget,
  resolveRelativeTime,
  resolveReminderPayload,
  resolveTaskTargets,
  stripCreateCommand,
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
    expect(detectAssistantIntent("marcá 5 tareas como completadas")).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("completá las vencidas")).toEqual({
      kind: "complete",
    });
  });

  it("reconoce verbos con pronombre pegado y 'cerrar'", () => {
    expect(detectAssistantIntent("completame 5 tareas")).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("cierra 5 y marcalas como completas")).toEqual(
      {
        kind: "complete",
      },
    );
    expect(detectAssistantIntent("marcalas como completadas")).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("cerralas")).toEqual({ kind: "complete" });
  });

  it("trata 'dale', 'hazlo tú' y 'esas 5 están bien' como confirmación del pendiente", () => {
    const pendingComplete =
      "¿Marco estas 5 tareas como completadas?\n\n- Preparar demo";
    expect(detectAssistantIntent("dale", pendingComplete)).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("hazlo tu", pendingComplete)).toEqual({
      kind: "complete",
    });
    expect(detectAssistantIntent("esas 5 estan bien", pendingComplete)).toEqual(
      {
        kind: "complete",
      },
    );

    const pendingDelete =
      "¿Elimino estas 3 tareas? Esta acción no se puede deshacer.";
    expect(detectAssistantIntent("dale", pendingDelete)).toEqual({
      kind: "delete",
    });
    expect(detectAssistantIntent("dale")).toBeNull();
  });

  it("no confunde un 'dale' seguido de una orden con una confirmación", () => {
    expect(detectAssistantIntent("dale, completá las vencidas")).toEqual({
      kind: "complete",
    });
  });

  it("devuelve null para preguntas genéricas", () => {
    expect(detectAssistantIntent("¿qué tengo pendiente?")).toBeNull();
  });

  it("detecta eliminación y creación de tareas", () => {
    expect(detectAssistantIntent("eliminá la tarea Enviar propuesta")).toEqual({
      kind: "delete",
    });
    expect(detectAssistantIntent("borrá las tareas vencidas")).toEqual({
      kind: "delete",
    });
    expect(
      detectAssistantIntent("creá una tarea para llamar al cliente"),
    ).toEqual({ kind: "create" });
    expect(detectAssistantIntent("necesito crear una tarea")).toEqual({
      kind: "create",
    });
    expect(detectAssistantIntent("agregá una tarea al proyecto")).toEqual({
      kind: "create",
    });
    expect(
      detectAssistantIntent("creá una tarea para el equipo de ventas"),
    ).toEqual({ kind: "create" });
    expect(detectAssistantIntent("creá una nota rápida")).toBeNull();
  });

  it("no confunde preguntas de cómo hacer algo con una orden", () => {
    expect(detectAssistantIntent("¿cómo puedo eliminar una tarea?")).toBeNull();
    expect(detectAssistantIntent("¿cómo creo una tarea?")).toBeNull();
  });
});

describe("parseTaskCount", () => {
  it("reconoce cantidades en dígitos y palabras", () => {
    expect(parseTaskCount("marcá 5 tareas como completadas")).toBe(5);
    expect(parseTaskCount("completá las 3 primeras")).toBe(3);
    expect(parseTaskCount("terminá cinco pendientes")).toBe(5);
    expect(parseTaskCount("borrá un par de tareas")).toBe(2);
  });

  it("reconoce determinantes, 'más' y cantidades pegadas al verbo", () => {
    expect(parseTaskCount("marca esas 5 como completadas")).toBe(5);
    expect(parseTaskCount("completa otras 4")).toBe(4);
    expect(parseTaskCount("completá estas cinco")).toBe(5);
    expect(parseTaskCount("completá 5 más")).toBe(5);
    expect(parseTaskCount("dame un par más")).toBe(2);
    expect(parseTaskCount("cerrá 5")).toBe(5);
    expect(parseTaskCount("completame 5")).toBe(5);
  });

  it("reconoce 'todas' y devuelve null cuando no hay cantidad", () => {
    expect(parseTaskCount("completá todas las vencidas")).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(parseTaskCount("marcá la tarea Preparar demo")).toBeNull();
  });

  it("recorta al tope de lote", () => {
    expect(parseTaskCount("completá 99 tareas")).toBe(20);
  });
});

describe("detectTaskScope", () => {
  it("detecta subconjuntos por vencimiento y prioridad", () => {
    expect(detectTaskScope("borrá las vencidas")).toBe("overdue");
    expect(detectTaskScope("completá las de hoy")).toBe("today");
    expect(detectTaskScope("eliminá las urgentes")).toBe("urgent");
    expect(detectTaskScope("marcá prioridad alta")).toBe("high");
  });

  it("no trata 'las 5 más urgentes' como filtro de prioridad", () => {
    expect(detectTaskScope("completá las 5 más urgentes")).toBeNull();
  });
});

describe("resolveTaskTargets", () => {
  const suggestions = [
    {
      taskId: "t1",
      title: "Preparar demo",
      dueDate: "2026-08-01",
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      reason: "Vencida",
    },
    {
      taskId: "t2",
      title: "Enviar propuesta",
      dueDate: "2026-08-02",
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      reason: "Vencida",
    },
    {
      taskId: "t3",
      title: "Revisar contrato",
      dueDate: "2026-08-07",
      priority: Priority.URGENT,
      status: TaskStatus.TODO,
      reason: "Vence hoy",
    },
    {
      taskId: "t4",
      title: "Actualizar tablero",
      dueDate: null,
      priority: Priority.LOW,
      status: TaskStatus.TODO,
      reason: "Abierta",
    },
  ];

  it("toma las N más urgentes cuando solo se pide una cantidad", () => {
    const targets = resolveTaskTargets(
      "marcá 2 tareas como completadas",
      suggestions,
    );
    expect(targets.map((task) => task.taskId)).toEqual(["t1", "t2"]);
  });

  it("prioriza todos los títulos mencionados", () => {
    const targets = resolveTaskTargets(
      "terminé Preparar demo y Revisar contrato",
      suggestions,
    );
    expect(targets.map((task) => task.taskId)).toEqual(["t1", "t3"]);
  });

  it("filtra por subconjunto antes de aplicar la cantidad", () => {
    const targets = resolveTaskTargets("borrá las vencidas", suggestions);
    expect(targets.map((task) => task.taskId)).toEqual(["t1", "t2"]);
  });

  it("devuelve vacío sin señales: el servicio pide aclaración", () => {
    expect(resolveTaskTargets("ya está listo", suggestions)).toEqual([]);
  });
});

describe("resolveTaskTargets con el lote del mensaje anterior", () => {
  const ranked = Array.from({ length: 13 }, (_, index) => ({
    taskId: `t${index + 1}`,
    title: `Tarea ${index + 1}`,
    dueDate: "2026-10-01",
    priority: Priority.HIGH,
    status: TaskStatus.TODO,
    reason: "Vencida",
  }));
  const previous = ranked.slice(0, 5);

  it("'esas 5' toma exactamente las tareas que el asistente listó", () => {
    const targets = resolveTaskTargets(
      "marca esas 5 como completadas",
      ranked,
      { previous },
    );
    expect(targets.map((task) => task.taskId)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
    ]);
  });

  it("'otras 4' excluye las ya propuestas y toma las siguientes", () => {
    const targets = resolveTaskTargets("completa otras 4", ranked, {
      previous,
    });
    expect(targets.map((task) => task.taskId)).toEqual([
      "t6",
      "t7",
      "t8",
      "t9",
    ]);
  });

  it("completa el lote con el ranking si el asistente nombró menos tareas", () => {
    const targets = resolveTaskTargets(
      "marca esas 5 como completadas",
      ranked,
      { previous: ranked.slice(0, 2) },
    );
    expect(targets.map((task) => task.taskId)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
    ]);
  });

  it("'esas' sin cantidad usa solo lo que el asistente listó", () => {
    const targets = resolveTaskTargets("marcá esas", ranked, {
      previous: ranked.slice(0, 3),
    });
    expect(targets.map((task) => task.taskId)).toEqual(["t1", "t2", "t3"]);
  });

  it("'otras' sin cantidad no adivina un lote", () => {
    expect(resolveTaskTargets("completá otras", ranked, { previous })).toEqual(
      [],
    );
  });

  it("extrae los títulos que el asistente listó en su último mensaje", () => {
    const reply =
      "¿Marco estas 5 tareas como completadas?\n\n- Tarea 1\n- Tarea 2\n- Tarea 3\n- Tarea 4\n- Tarea 5";
    expect(extractTaskRefs(reply, ranked).map((task) => task.taskId)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
    ]);
  });

  it("no confunde 'Tarea 1' con 'Tarea 10'", () => {
    expect(
      extractTaskRefs("- Tarea 10", ranked).map((task) => task.taskId),
    ).toEqual(["t10"]);
  });
});

describe("isTaskCountQuestion", () => {
  it("detecta preguntas por el total y no confunde pedidos de acción", () => {
    expect(isTaskCountQuestion("cuantas tareas tengo en total")).toBe(true);
    expect(isTaskCountQuestion("¿cuántas pendientes hay?")).toBe(true);
    expect(isTaskCountQuestion("marcá 5 tareas")).toBe(false);
  });
});

describe("isConfirmation", () => {
  it("solo acepta confirmaciones que ocupan todo el mensaje", () => {
    expect(isConfirmation("dale")).toBe(true);
    expect(isConfirmation("hazlo tú")).toBe(true);
    expect(isConfirmation("esas 5 están bien")).toBe(true);
    expect(isConfirmation("dale, completá las vencidas")).toBe(false);
  });
});

describe("stripCreateCommand", () => {
  it("quita el verbo de creación para no titular 'Crear una tarea'", () => {
    expect(stripCreateCommand("creá una tarea para llamar a Juan")).toBe(
      "para llamar a Juan",
    );
    expect(
      stripCreateCommand("necesito crear una tarea: revisar el contrato"),
    ).toBe("revisar el contrato");
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
