import { Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { toDate, toLocalDateKey } from "./date";
import { isOverdue, PRIORITY_RANK } from "./tasks";

export interface Suggestion {
  taskId: string;
  title: string;
  dueDate: string | null;
  priority: Priority;
  status: TaskStatus;
  reason: string;
}

/**
 * Candidatas accionables, ordenadas por urgencia y con datos reales:
 * vencidas, por vencer, prioridad alta. Nunca se generan al azar.
 */
export function suggestibleTasks(
  tasks: Pick<Task, "id" | "title" | "dueDate" | "priority" | "status">[],
  now = new Date(),
  limit = 5,
): Suggestion[] {
  const today = toDate(now);
  const todayKey = toLocalDateKey(today);
  const tomorrowKey = toLocalDateKey(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  );

  const ranked = tasks
    .filter(
      (t) => t.status !== TaskStatus.DONE && t.status !== TaskStatus.ARCHIVED,
    )
    .map((t) => {
      const dueKey = t.dueDate ? toLocalDateKey(toDate(t.dueDate)) : null;
      let reason: string;
      let rank: number;
      if (isOverdue(t, now)) {
        reason = "Vencida";
        rank = 0;
      } else if (dueKey === todayKey) {
        reason = "Vence hoy";
        rank = 1;
      } else if (dueKey === tomorrowKey) {
        reason = "Vence mañana";
        rank = 2;
      } else if (t.priority === Priority.URGENT) {
        reason = "Urgente";
        rank = 3;
      } else if (t.priority === Priority.HIGH) {
        reason = "Prioridad alta";
        rank = 4;
      } else {
        reason = "Abierta";
        rank = 5;
      }
      return {
        taskId: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        reason,
        rank,
      };
    })
    .sort((a, b) => {
      const r = a.rank - b.rank;
      if (r !== 0) return r;
      const ad = a.dueDate ?? "9999-12-31";
      const bd = b.dueDate ?? "9999-12-31";
      if (ad !== bd) return ad < bd ? -1 : 1;
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);

  return ranked.map(({ rank: _rank, ...rest }) => rest);
}

/** Minúsculas, sin acentos (NFD + quitar marcas combinantes) y sin puntuación. */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:()]/g, "")
    .trim();
}

function normalize(value: string): string {
  return fold(value).replace(/\s+/g, " ");
}

/**
 * Convierte expresiones relativas de tiempo a un Date absoluto.
 * Reglas soportadas (deterministas y tested): "en N {min|minutos|h|hs|horas|días}",
 * "mañana", "pasado mañana", "semana que viene".
 */
export function resolveRelativeTime(
  text: string,
  now = new Date(),
): Date | null {
  const value = fold(text);

  const unitMatch =
    /en\s+(\d+(?:[.,]\d+)?)\s*(min|m|minutos?|h|hs?|horas?|d[ií]as?|dias?)\b/.exec(
      value,
    );
  if (unitMatch) {
    const amount = parseFloat(unitMatch[1]!.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = unitMatch[2]!;
    const msPerUnit = /^d/.test(unit)
      ? 86_400_000
      : /^h/.test(unit)
        ? 3_600_000
        : 60_000;
    return new Date(now.getTime() + amount * msPerUnit);
  }

  if (/\bpasado\s+manana\b/.test(value)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d;
  }
  if (/\bmanana\b/.test(value)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\bsemana\s+que\s+viene\b/.test(value)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d;
  }

  return null;
}

export type AssistantIntent =
  { kind: "complete" } | { kind: "reminder" } | null;

/**
 * Detección determinista de intención para los dos comandos del copiloto.
 * Opera sobre texto sin acentos, así que "terminé"/"termine", "marcá"/"marca"
 * etc. se comportan igual. Los turnos que matchean no consumen cuota de IA.
 */
export function detectAssistantIntent(text: string): AssistantIntent {
  const value = fold(text);
  if (value.length === 0) return null;

  if (
    /\brec[oó]rd\w*\b|\bav[ií]s(ame|am|e|a|á)?\b|\brecordatorio\b/.test(value)
  ) {
    return { kind: "reminder" };
  }

  const complete =
    /\best[aá]s?\s+(list[oa]|hech[oa]|completad[oa]|terminad[oa]|resuel[tao])\b/.test(
      value,
    ) ||
    /\bqued[oó]\s+(list[oa]|hech[oa]|completad[oa]|terminad[oa])\b/.test(
      value,
    ) ||
    /\b(y[ao]\s+)?(l[oa]\s+)?(termin[ée]|hice|complet[ée]|resolv[ií]|finalic[ée])\b/.test(
      value,
    ) ||
    /\bmar[ck]([aáe]|ar|al[oa]|arlo|arla)?\s+como\s+(hech[oa]|completad[oa]|list[oa])\b/.test(
      value,
    ) ||
    /\b(hech[oa]|completad[oa]|terminad[oa]|resuel[tao])\b/.test(value);

  return complete ? { kind: "complete" } : null;
}

export function findTaskMention(
  text: string,
  suggestions: Suggestion[],
): Suggestion | null {
  const norm = normalize(text);
  if (norm.length === 0) return null;
  return suggestions.find((s) => norm.includes(normalize(s.title))) ?? null;
}

/**
 * Regla de desambiguación de "ya está listo":
 * 1) título mencionado explícitamente por el usuario;
 * 2) si no, la sugerencia principal del último mensaje del asistente;
 * 3) si no se puede resolver, null (el chat pide aclarar).
 */
export function resolveCompleteTarget(
  text: string,
  suggestions: Suggestion[],
  lastAssistantText: string,
): Suggestion | null {
  const mentioned = findTaskMention(text, suggestions);
  if (mentioned) return mentioned;

  const primary = suggestions[0];
  if (primary && lastAssistantText) {
    const norm = normalize(lastAssistantText);
    if (norm.includes(normalize(primary.title))) return primary;
  }
  return null;
}

export interface ReminderResolution {
  title: string;
  triggerAt: Date;
  taskId: string | null;
}

/**
 * Resuelve un pedido "recordáme en X" a un recordatorio accionable.
 * Devuelve null si no hay un momento claro (el chat pregunta cuándo).
 */
export function resolveReminderPayload(
  text: string,
  suggestions: Suggestion[],
  now = new Date(),
): ReminderResolution | null {
  const triggerAt = resolveRelativeTime(text, now);
  if (!triggerAt) return null;

  const mentioned = findTaskMention(text, suggestions);

  let cleaned = fold(text)
    .replace(/\brec[oó]rd\w*\s*/, "")
    .replace(/\bav[ií]sa(me|m[eé])?\s*/, "")
    .trim();
  cleaned = cleaned.replace(
    /en\s+[\d.,]+\s*(min|m|minutos?|h|hs?|horas?|d[ií]as?|dias?)\b/,
    "",
  );
  cleaned = cleaned.replace(
    /\b(pasado\s+manana|manana|semana\s+que\s+viene|hoy)\b/,
    "",
  );
  cleaned = cleaned.replace(/\b(que|de|para)\s+/, "").trim();
  cleaned = cleaned.replace(/[¿?!¡.,;:]+$/, "").trim();

  const title = cleaned.length > 0 ? cleaned : "Recordatorio";
  return {
    title: title.slice(0, 200),
    triggerAt,
    taskId: mentioned?.taskId ?? null,
  };
}
