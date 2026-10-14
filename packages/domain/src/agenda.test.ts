import { describe, expect, it } from "vitest";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import { makeAgendaTask } from "./helpers";
import { DEFAULT_DAILY_CAPACITY, reviewAgenda } from "./agenda";

/**
 * La revisión de agenda tiene que ser capaz de decir "no hay nada que reportar".
 * Eso es lo que permite que la tarjeta del dashboard no prometa nada, y es la
 * razón de que no dependa de un modelo.
 */

// Fijado a un día local cualquiera para que las claves YYYY-MM-DD de los tests
// no dependan del huso en el que corren.
const NOW = new Date(2026, 9, 5, 10, 0, 0); // 2026-10-05 local
const TODAY = "2026-10-05";

describe("reviewAgenda sin hallazgos", () => {
  it("no inventa problemas cuando la agenda está limpia", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ id: "t1", dueDate: "2026-10-07" })],
      {},
      NOW,
    );

    expect(review.findings).toEqual([]);
    expect(review.overloadedDays).toEqual([]);
  });

  it("ignora tareas cerradas y archivadas", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({ status: TaskStatus.DONE, dueDate: "2026-10-01" }),
        makeAgendaTask({ status: TaskStatus.ARCHIVED, dueDate: "2026-10-01" }),
      ],
      {},
      NOW,
    );

    expect(review.findings).toEqual([]);
  });

  it("no cuenta una vencida si ya está cerrada", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          status: TaskStatus.DONE,
          priority: Priority.LOW,
          dueDate: "2026-10-01",
        }),
      ],
      {},
      NOW,
    );

    expect(review.findings).toEqual([]);
  });
});

describe("UNFLAGGED_OVERDUE", () => {
  it("marca la vencida que no se escaló a URGENT", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ id: "t1", dueDate: "2026-10-01" })],
      {},
      NOW,
    );

    expect(review.findings).toEqual([
      {
        kind: "UNFLAGGED_OVERDUE",
        severity: 0,
        taskIds: ["t1"],
        message: expect.stringContaining("URGENT"),
      },
    ]);
  });

  it("no marca la vencida que ya es URGENT", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          priority: Priority.URGENT,
          dueDate: "2026-10-01",
        }),
      ],
      {},
      NOW,
    );

    expect(review.findings).toEqual([]);
  });

  it("no marca la que vence hoy: todavía tiene el día", () => {
    const review = reviewAgenda([makeAgendaTask({ dueDate: TODAY })], {}, NOW);

    expect(review.findings).toEqual([]);
  });
});

describe("STALE_REVIEW", () => {
  it("marca la que quedó en revisión sin cerrarse", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ status: TaskStatus.IN_REVIEW, completedAt: null })],
      {},
      NOW,
    );

    expect(review.findings.map((f) => f.kind)).toEqual(["STALE_REVIEW"]);
  });

  it("no marca la que tiene completedAt", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          status: TaskStatus.IN_REVIEW,
          completedAt: "2026-10-04T12:00:00.000Z",
        }),
      ],
      {},
      NOW,
    );

    expect(review.findings).toEqual([]);
  });
});

describe("OVERLAP", () => {
  it("detecta dos tareas del mismo responsable en la misma ventana", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    const overlap = review.findings.find((f) => f.kind === "OVERLAP");
    expect(overlap?.taskIds).toEqual(["a", "b"]);
    expect(overlap?.message).toContain("2026-10-06");
  });

  it("no marca solapamiento entre responsables distintos", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          startDate: "2026-10-06",
          assigneeIds: ["u2"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    expect(review.findings.filter((f) => f.kind === "OVERLAP")).toEqual([]);
  });

  it("no marca lo que se solapa con sí mismo por estar en dos tareas del mismo día", () => {
    // Una tarea sin asignados no tiene contra quién chocar: reportar un
    // solapamiento consigo misma sería ruido.
    const review = reviewAgenda(
      [makeAgendaTask({ startDate: "2026-10-06" })],
      { dailyCapacity: 10 },
      NOW,
    );

    expect(review.findings.filter((f) => f.kind === "OVERLAP")).toEqual([]);
  });

  it("detecta el solapamiento parcial de dos ventanas", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-05",
          dueDate: "2026-10-07",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          startDate: "2026-10-07",
          dueDate: "2026-10-09",
          assigneeIds: ["u1"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    const overlap = review.findings.find((f) => f.kind === "OVERLAP");
    expect(overlap?.message).toContain("2026-10-07");
  });

  it("no marca ventanas separadas por un día de hueco", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-05",
          dueDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          startDate: "2026-10-08",
          dueDate: "2026-10-09",
          assigneeIds: ["u1"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    expect(review.findings.filter((f) => f.kind === "OVERLAP")).toEqual([]);
  });

  it("tolera ventanas invertidas en vez de descartarlas", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-09",
          dueDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    expect(review.findings.filter((f) => f.kind === "OVERLAP").length).toBe(1);
  });
});

describe("OVERLOAD", () => {
  it("marca el día que excede la capacidad", () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeAgendaTask({ id: `t${i}`, dueDate: TODAY }),
    );

    const review = reviewAgenda(tasks, { dailyCapacity: 3 }, NOW);

    const overload = review.findings.find((f) => f.kind === "OVERLOAD");
    expect(overload?.taskIds).toHaveLength(4);
    expect(review.overloadedDays).toEqual([{ date: TODAY, count: 4 }]);
  });

  it("no marca un día que llega justo a la capacidad", () => {
    const tasks = Array.from({ length: 3 }, (_, i) =>
      makeAgendaTask({ id: `t${i}`, dueDate: TODAY }),
    );

    const review = reviewAgenda(tasks, { dailyCapacity: 3 }, NOW);

    expect(review.findings.filter((f) => f.kind === "OVERLOAD")).toEqual([]);
    expect(review.overloadedDays).toEqual([]);
  });

  it("cuenta la tarea una vez por día de una ventana de varios días", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          startDate: "2026-10-05",
          dueDate: "2026-10-07",
        }),
        makeAgendaTask({ id: "b", dueDate: "2026-10-06" }),
      ],
      { dailyCapacity: 1 },
      NOW,
    );

    // El día 06 tiene dos tareas: la ventana de `a` y `b`.
    expect(review.overloadedDays).toEqual([{ date: "2026-10-06", count: 2 }]);
  });

  it("deja fuera lo que cae fuera del horizonte", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({ id: "a", dueDate: "2026-10-06" }),
        makeAgendaTask({ id: "b", dueDate: "2026-10-07" }),
        makeAgendaTask({ id: "c", dueDate: "2026-11-30" }),
      ],
      { dailyCapacity: 1, horizonDays: 7 },
      NOW,
    );

    // Ningún día dentro del horizonte llega a 2.
    expect(review.overloadedDays).toEqual([]);
  });

  it("usa la capacidad por defecto cuando no se pasa ninguna", () => {
    const tasks = Array.from({ length: DEFAULT_DAILY_CAPACITY + 1 }, (_, i) =>
      makeAgendaTask({ id: `t${i}`, dueDate: TODAY }),
    );

    const review = reviewAgenda(tasks, {}, NOW);

    expect(review.overloadedDays).toEqual([
      { date: TODAY, count: DEFAULT_DAILY_CAPACITY + 1 },
    ]);
  });
});

describe("tareas sin ventana", () => {
  it("no genera hallazgos de agenda sin fechas, pero sí detecta vencidas", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ id: "t1", dueDate: null, startDate: null })],
      { dailyCapacity: 1 },
      NOW,
    );

    expect(review.findings).toEqual([]);
  });

  it("no cuenta una tarea sin fechas hacia la sobrecarga", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ dueDate: null })],
      { dailyCapacity: 0 },
      NOW,
    );

    expect(review.findings.filter((f) => f.kind === "OVERLOAD")).toEqual([]);
  });
});

describe("tope de hallazgos (maxFindings)", () => {
  it("recorta las solapas cuando el tope se alcanza y lo avisa", () => {
    const tasks = Array.from({ length: 40 }, (_, i) =>
      makeAgendaTask({ id: `t${i}`, startDate: TODAY, assigneeIds: ["u1"] }),
    );

    const review = reviewAgenda(
      tasks,
      { dailyCapacity: 10, maxFindings: 5 },
      NOW,
    );

    expect(review.findings.length).toBeLessThanOrEqual(5);
    expect(review.truncated).toBe(true);
  });

  it("no marca truncado si los hallazgos caben en el tope", () => {
    const review = reviewAgenda(
      [makeAgendaTask({ id: "t1", dueDate: "2026-10-01" })],
      { maxFindings: 1000 },
      NOW,
    );

    expect(review.truncated).toBeUndefined();
  });

  it("no revienta la pila con miles de solapas", () => {
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      makeAgendaTask({ id: `t${i}`, startDate: TODAY, assigneeIds: ["u1"] }),
    );

    expect(() => reviewAgenda(tasks, { dailyCapacity: 10 }, NOW)).not.toThrow();

    const review = reviewAgenda(tasks, { dailyCapacity: 10 }, NOW);

    expect(review.findings.length).toBeLessThanOrEqual(1000);
    expect(review.truncated).toBe(true);
  });

  it("deja espacio para los demás grupos dentro del tope", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({ id: "load", dueDate: TODAY }),
        makeAgendaTask({ id: "load2", dueDate: TODAY }),
        makeAgendaTask({ id: "stale", status: TaskStatus.IN_REVIEW }),
        makeAgendaTask({ id: "overdue", dueDate: "2026-10-01" }),
      ],
      { dailyCapacity: 1, maxFindings: 10 },
      NOW,
    );

    expect(review.findings.map((f) => f.kind)).toEqual(
      expect.arrayContaining(["OVERLOAD", "STALE_REVIEW", "UNFLAGGED_OVERDUE"]),
    );
  });
});

describe("orden y forma de la respuesta", () => {
  it("ordena por gravedad, de más urgente a menos", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({ id: "overdue", dueDate: "2026-10-01" }),
        makeAgendaTask({ id: "review", status: TaskStatus.IN_REVIEW }),
        makeAgendaTask({
          id: "load",
          dueDate: "2026-10-05",
          startDate: "2026-10-05",
        }),
        makeAgendaTask({
          id: "load2",
          dueDate: "2026-10-05",
          startDate: "2026-10-05",
        }),
      ],
      { dailyCapacity: 1 },
      NOW,
    );

    const severities = review.findings.map((f) => f.severity);
    expect([...severities].sort((a, b) => a - b)).toEqual(severities);
  });

  it("expone generatedAt a partir del now inyectado", () => {
    const review = reviewAgenda([], {}, NOW);
    expect(review.generatedAt).toBe(NOW.toISOString());
  });

  it("usa la prioridad más urgente del par para la severidad del solapamiento", () => {
    const review = reviewAgenda(
      [
        makeAgendaTask({
          id: "a",
          priority: Priority.LOW,
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
        makeAgendaTask({
          id: "b",
          priority: Priority.URGENT,
          startDate: "2026-10-06",
          assigneeIds: ["u1"],
        }),
      ],
      { dailyCapacity: 10 },
      NOW,
    );

    expect(review.findings.find((f) => f.kind === "OVERLAP")?.severity).toBe(0);
  });
});
