import { Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { toDate, toLocalDateKey } from "./date";
import { isOverdue } from "./tasks";

/**
 * Revisión de agenda: qué está genuinamente mal hoy, en términos calculables.
 *
 * Cada regla responde a algo que se puede comprobar mirando las tareas, sin
 * pedirle a un modelo que opine. "No tenés problemas" es un resultado válido de
 * esta función, y es la razón de que el análisis no dependa de un proveedor de
 * IA: una instalación sin `GEMINI_API_KEY` recibe igual un diagnóstico real.
 */

/** Cuántas tareas abiertas se consideran una jornada posible, por día. */
export const DEFAULT_DAILY_CAPACITY = 5;

/** Días hacia adelante que cubre la revisión, contando desde hoy. */
export const DEFAULT_HORIZON_DAYS = 7;

/**
 * El tipo de tarea que la función necesita, más chico que `Task` a propósito:
 * la revisión no usa títulos ni etiquetas, y reduce lo que hay que traer de la
 * base a un `select` chico.
 */
export type AgendaTask = Pick<
  Task,
  "id" | "status" | "priority" | "dueDate" | "startDate" | "completedAt"
> & { assignees: { id: string }[] };

export interface AgendaOptions {
  /** Tareas que se consideran asumibles en un día. */
  dailyCapacity?: number;
  horizonDays?: number;
}

function dayKey(value: Date | string): string {
  return toLocalDateKey(toDate(value));
}

/** ¿La tarea sigue abierta y ocupa lugar en una agenda? */
function isOpenForAgenda(task: AgendaTask): boolean {
  return task.status !== TaskStatus.DONE && task.status !== TaskStatus.ARCHIVED;
}

/**
 * Ventana en la que una tarea ocupa agenda.
 *
 * Una tarea con `startDate` planificada se cuenta desde ese día; si solo tiene
 * vencimiento, se concentra en el día del `dueDate`. Sin ninguno de los dos no
 * hay ventana, así que no se puede chocar con nada ni sobrecargar un día.
 */
function window(task: AgendaTask): { start: string; end: string } | null {
  if (task.startDate && task.dueDate) {
    const start = dayKey(task.startDate);
    const end = dayKey(task.dueDate);
    return start <= end ? { start, end } : { start: end, end: start };
  }
  if (task.startDate)
    return { start: dayKey(task.startDate), end: dayKey(task.startDate) };
  if (task.dueDate)
    return { start: dayKey(task.dueDate), end: dayKey(task.dueDate) };
  return null;
}

function severityRank(priority: Priority): number {
  return priority === Priority.URGENT
    ? 0
    : priority === Priority.HIGH
      ? 1
      : priority === Priority.MEDIUM
        ? 2
        : 3;
}

function bySeverity(a: AgendaFinding, b: AgendaFinding): number {
  if (a.severity !== b.severity) return a.severity - b.severity;
  return a.kind.localeCompare(b.kind);
}

export interface AgendaFinding {
  kind: "OVERLAP" | "OVERLOAD" | "STALE_REVIEW" | "UNFLAGGED_OVERDUE";
  severity: number;
  taskIds: string[];
  message: string;
}

export interface AgendaReview {
  findings: AgendaFinding[];
  /** Días con más carga que la capacidad, para el resumen. */
  overloadedDays: { date: string; count: number }[];
  generatedAt: string;
}

/**
 * Analiza las tareas y devuelve hallazgos ordenados por gravedad.
 *
 * `now` es inyectable para que los tests no dependan del reloj, y para que la
 * ventana sea "hoy y los próximos días" en vez de un rango arbitrario.
 */
export function reviewAgenda(
  tasks: AgendaTask[],
  options: AgendaOptions = {},
  now: Date = new Date(),
): AgendaReview {
  const capacity = Math.max(1, options.dailyCapacity ?? DEFAULT_DAILY_CAPACITY);
  const horizon = Math.max(0, options.horizonDays ?? DEFAULT_HORIZON_DAYS);

  const today = toLocalDateKey(now);
  const lastDay = dayKey(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizon),
  );

  const open = tasks.filter(isOpenForAgenda);
  const inWindow = open.filter((t) => {
    const w = window(t);
    return w !== null && w.start <= lastDay;
  });

  const findings: AgendaFinding[] = [];

  findings.push(...overlapFindings(inWindow));
  findings.push(...overloadFindings(inWindow, capacity, today, lastDay));
  findings.push(...staleReviewFindings(open));
  findings.push(...unflaggedOverdueFindings(open, now));

  findings.sort(bySeverity);

  const overloadedDays = countPerDay(inWindow, today, lastDay)
    .filter((d) => d.count > capacity)
    .map((d) => ({ date: d.date, count: d.count }));

  return {
    findings,
    overloadedDays,
    generatedAt: now.toISOString(),
  };
}

/**
 * Dos tareas del mismo responsable con ventanas que se pisan.
 *
 * El solapamiento se evalúa por día clave, no por instante: las tareas tienen
 * granularidad de fecha, y comparar timestamps produciría falsos negativos
 * entre dos tareas que ambas caen en el mismo día.
 */
function overlapFindings(tasks: AgendaTask[]): AgendaFinding[] {
  const byAssignee = new Map<string, AgendaTask[]>();

  for (const task of tasks) {
    if (task.assignees.length === 0) continue;
    for (const assignee of task.assignees) {
      const list = byAssignee.get(assignee.id);
      if (list) list.push(task);
      else byAssignee.set(assignee.id, [task]);
    }
  }

  const findings: AgendaFinding[] = [];

  for (const tasksOfPerson of byAssignee.values()) {
    const dated = tasksOfPerson
      .map((task) => ({ task, w: window(task) }))
      .filter(
        (e): e is { task: AgendaTask; w: { start: string; end: string } } =>
          e.w !== null,
      );

    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        const a = dated[i]!;
        const b = dated[j]!;
        const start = a.w.start > b.w.start ? a.w.start : b.w.start;
        const end = a.w.end < b.w.end ? a.w.end : b.w.end;
        if (start > end) continue;

        findings.push({
          kind: "OVERLAP",
          // `Math.min` y no `Math.max`: el rango ordena URGENT como 0, así que
          // el más bajo es el más urgente. Tomar el mayor hacía que un choque
          // entre dos tareas LOW se reportara con la misma gravedad que una
          // que incluyera una URGENT.
          severity: Math.min(
            severityRank(a.task.priority),
            severityRank(b.task.priority),
          ),
          taskIds: [a.task.id, b.task.id],
          message: `Se pisan del ${start} al ${end}`,
        });
      }
    }
  }

  return findings;
}

/** Días con más tareas de las que la jornada soporta. */
function overloadFindings(
  tasks: AgendaTask[],
  capacity: number,
  today: string,
  lastDay: string,
): AgendaFinding[] {
  return countPerDay(tasks, today, lastDay)
    .filter((day) => day.count > capacity)
    .map((day) => ({
      kind: "OVERLOAD" as const,
      severity: day.count > capacity * 2 ? 0 : 2,
      taskIds: tasksOn(tasks, day.date),
      message: `${day.count} tareas para una capacidad de ${capacity}`,
    }));
}

/** `IN_REVIEW` sin completar: nadie la está revisando. */
function staleReviewFindings(tasks: AgendaTask[]): AgendaFinding[] {
  return tasks
    .filter((task) => task.status === TaskStatus.IN_REVIEW && !task.completedAt)
    .map((task) => ({
      kind: "STALE_REVIEW" as const,
      severity: 1,
      taskIds: [task.id],
      message: "En revisión desde hace tiempo y sin cerrarse",
    }));
}

/** Vencida sin `URGENT`: el vencimiento pasó y la prioridad nunca se escaló. */
function unflaggedOverdueFindings(
  tasks: AgendaTask[],
  now: Date,
): AgendaFinding[] {
  return tasks
    .filter((task) => isOverdue(task, now) && task.priority !== Priority.URGENT)
    .map((task) => ({
      kind: "UNFLAGGED_OVERDUE" as const,
      severity: 0,
      taskIds: [task.id],
      message: "Vencida y sin escalar a URGENT",
    }));
}

/** Cuántas tareas tocan cada día, expandiendo la ventana de cada una. */
function countPerDay(
  tasks: AgendaTask[],
  from: string,
  to: string,
): { date: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    const w = window(task);
    if (!w) continue;
    for (const day of daysBetweenKeys(w.start, w.end)) {
      if (day < from || day > to) continue;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function tasksOn(tasks: AgendaTask[], date: string): string[] {
  return tasks
    .filter((task) => {
      const w = window(task);
      return w !== null && date >= w.start && date <= w.end;
    })
    .map((task) => task.id);
}

/** Días calendario entre dos claves `YYYY-MM-DD`, inclusive. */
function daysBetweenKeys(start: string, end: string): string[] {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const days: string[] = [];
  const cursor = new Date(sy!, sm! - 1, sd!);
  const last = new Date(ey!, em! - 1, ed!);

  while (cursor.getTime() <= last.getTime()) {
    days.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
