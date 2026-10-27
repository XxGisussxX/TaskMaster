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
  | { kind: "complete" }
  | { kind: "delete" }
  | { kind: "create" }
  | { kind: "reminder" }
  | null;

/**
 * Tope de tareas que el asistente puede proponer en una sola acción de lote.
 *
 * Coincide con el máximo del contrato (`assistantCompleteManyActionSchema`) y
 * con el `bulk` del backend. Más que esto no entra en un mensaje de chat útil y
 * hace demasiado fácil borrar algo por accidente.
 */
export const ASSISTANT_BATCH_LIMIT = 20;

const DELETE_VERB =
  /\b(elimina|eliminen|eliminar|borra|borren|borrar|quita|quiten|quitar|saca|saquen|sacar|remove|remueve|remuevan|remover)\b/;
const CREATE_VERB =
  /\b(crea|crear|creame|agrega|agregar|agregame|anade|anadi|anadir|anademe|anadime|carga|cargar|cargame)\b/;
const CREATE_INFINITIVE =
  /\b(necesito|quiero|podes|podrias)\s+(crear|agregar|anadir|cargar)\b/;
const TASK_WORD = /\b(tareas?|pendientes?)\b/;
const NON_TASK_OBJECT =
  /\b(recordatorios?|notas?|documentos?|comentarios?|usuarios?|equipos?|canales?|etiquetas?|horas?)\b/;

/**
 * Detección determinista de intención para los comandos del copiloto.
 *
 * Opera sobre texto sin acentos, así que "terminé"/"termine", "marcá"/"marca"
 * etc. se comportan igual. Los turnos que matchean no consumen cuota de IA.
 *
 * El orden importa: un pedido de eliminación ("eliminá la tarea terminada")
 * también contiene una palabra de completado, y una creación ("creá una tarea y
 * marcala completada") también. Recordatorio va primero porque es excluyente.
 */
export function detectAssistantIntent(text: string): AssistantIntent {
  const value = fold(text);
  if (value.length === 0) return null;

  if (
    /\brec[oó]rd\w*\b|\bav[ií]s(ame|am|e|a|á)?\b|\brecordatorio\b/.test(value)
  ) {
    return { kind: "reminder" };
  }

  // "¿cómo elimino una tarea?" es una consulta, no una orden: sin esto el
  // verbo de la pregunta se confundía con una acción destructiva.
  const isQuestion =
    /^(como|que|donde|cuando|cuanto|por que)\b/.test(value) ||
    /\bcomo\s+(puedo|hago|se)\b/.test(value);

  const remove =
    DELETE_VERB.test(value) &&
    (TASK_WORD.test(value) || !NON_TASK_OBJECT.test(value));
  if (remove && !isQuestion) return { kind: "delete" };

  const create =
    (CREATE_VERB.test(value) &&
      (TASK_WORD.test(value) || !NON_TASK_OBJECT.test(value))) ||
    (CREATE_INFINITIVE.test(value) && TASK_WORD.test(value)) ||
    /\b(nueva|nuevo)\s+(tarea|pendiente)\b/.test(value);
  if (create && !isQuestion) return { kind: "create" };

  const completeVerb =
    /\b(marca|marquen|marcar|completa|completen|completar|termina|terminen|terminar|finaliza|finalicen|finalizar)\b/.test(
      value,
    );
  const completionWord =
    /\b(hech[oa]s?|completad[oa]s?|terminad[oa]s?|list[oa]s?|resuelt[oa]s?)\b/.test(
      value,
    );
  const complete =
    (completeVerb && !isQuestion) ||
    (completionWord && !isQuestion) ||
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
    );

  return complete ? { kind: "complete" } : null;
}

export function findTaskMention(
  text: string,
  suggestions: Suggestion[],
): Suggestion | null {
  return findTaskMentions(text, suggestions)[0] ?? null;
}

/**
 * Todas las tareas de la lista cuyo título aparece en el texto.
 *
 * Se usa para pedidos con varias tareas ("terminé Preparar demo y Enviar
 * propuesta") y conserva el orden de urgencia de las sugerencias, no el orden en
 * que el usuario las nombró.
 */
export function findTaskMentions(
  text: string,
  suggestions: Suggestion[],
): Suggestion[] {
  const norm = normalize(text);
  if (norm.length === 0) return [];
  return suggestions.filter((s) => norm.includes(normalize(s.title)));
}

/** Números escritos con palabras que el asistente reconoce en un pedido. */
const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
};

const WORD_NUMBER_PATTERN = Object.keys(NUMBER_WORDS).join("|");
const WORD_COUNT = new RegExp(
  `\\b(${WORD_NUMBER_PATTERN})\\s+(?:tareas?|pendientes?|cosas?)\\b`,
);

function clampCount(value: number): number {
  return Math.max(1, Math.min(ASSISTANT_BATCH_LIMIT, value));
}

/**
 * Cantidad de tareas pedidas explícitamente ("5 tareas", "las 3 primeras",
 * "cinco pendientes", "todas las vencidas").
 *
 * Devuelve `null` si el pedido no trae cantidad y `Infinity` para "todas", que
 * el seleccionador recorta al tope de lote.
 */
export function parseTaskCount(text: string): number | null {
  const value = fold(text);

  if (/\bun\s+par\s+de\s+(?:tareas?|pendientes?|cosas?)\b/.test(value)) {
    return 2;
  }

  if (
    /\b(todas|todos)\b/.test(value) &&
    !/\b(todas|todos)\s+(los\s+)?(dias?|semanas?|meses?|anos?)\b/.test(value)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const digit =
    /\b(\d{1,2})\s+(?:tareas?|pendientes?|cosas?)\b/.exec(value) ??
    /\b(?:las|los|primeras?|primeros?|ultimas?|ultimos?)\s+(\d{1,2})\b/.exec(
      value,
    ) ??
    /\b(\d{1,2})\s+de\s+(?:las|los)\s+(?:tareas?|pendientes?)\b/.exec(value);

  if (digit) return clampCount(Number.parseInt(digit[1]!, 10));

  const word = WORD_COUNT.exec(value);
  if (word) return clampCount(NUMBER_WORDS[word[1]!]!);

  return null;
}

export type AssistantTaskScope =
  "overdue" | "today" | "tomorrow" | "urgent" | "high";

/**
 * Filtro por estado/prioridad mencionado en el pedido ("las vencidas", "las de
 * hoy", "las urgentes", "prioridad alta").
 *
 * "las 5 más urgentes" se interpreta como ranking, no como filtro de prioridad
 * URGENT: por eso se excluye cuando la palabra viene precedida por "más".
 */
export function detectTaskScope(text: string): AssistantTaskScope | null {
  const value = fold(text);
  if (/\bvencid[oa]s?\b|\batrasad[oa]s?\b/.test(value)) return "overdue";
  if (/\b(hoy|para\s+hoy|de\s+hoy)\b/.test(value)) return "today";
  if (/\bmanana\b/.test(value)) return "tomorrow";
  if (/\bprioridad\s+alta\b|\balta\s+prioridad\b/.test(value)) return "high";
  if (/\burgentes?\b/.test(value) && !/\bmas\s+urgentes?\b/.test(value)) {
    return "urgent";
  }
  return null;
}

function matchesScope(
  suggestion: Suggestion,
  scope: AssistantTaskScope,
): boolean {
  switch (scope) {
    case "overdue":
      return suggestion.reason === "Vencida";
    case "today":
      return suggestion.reason === "Vence hoy";
    case "tomorrow":
      return suggestion.reason === "Vence mañana";
    case "urgent":
      return suggestion.priority === Priority.URGENT;
    case "high":
      return suggestion.priority === Priority.HIGH;
  }
}

/**
 * Elige las tareas sobre las que aplicar una acción.
 *
 * Prioridad:
 * 1) títulos mencionados explícitamente (varios permitidos);
 * 2) filtro por estado/prioridad ("las vencidas");
 * 3) cantidad pedida, tomando el ranking de urgencia que ya calcula
 *    `suggestibleTasks` (vencidas → hoy → mañana → prioridad).
 *
 * Si no hay ninguna de las tres señales devuelve `[]` y el servicio pide
 * aclaración: nunca adivina una tarea para una acción destructiva.
 */
export function resolveTaskTargets(
  text: string,
  suggestions: Suggestion[],
): Suggestion[] {
  const mentioned = findTaskMentions(text, suggestions);
  const count = parseTaskCount(text);
  const scope = detectTaskScope(text);

  if (mentioned.length > 0) {
    return Number.isFinite(count)
      ? mentioned.slice(0, count ?? mentioned.length)
      : mentioned.slice(0, ASSISTANT_BATCH_LIMIT);
  }

  let pool = scope
    ? suggestions.filter((suggestion) => matchesScope(suggestion, scope))
    : suggestions;

  if (count === Number.POSITIVE_INFINITY) {
    pool = pool.slice(0, ASSISTANT_BATCH_LIMIT);
  } else if (count !== null) {
    pool = pool.slice(0, count);
  } else if (!scope) {
    return [];
  }

  return pool;
}

/**
 * Quita el verbo de creación del texto para que el generador de borradores no
 * titule la tarea "Crear una tarea: ...".
 */
export function stripCreateCommand(text: string): string {
  const stripped = text
    .replace(
      /^\s*(?:por favor[,\s]*)?(?:(?:necesito|quiero|pod[eé]s|podr[ií]as)\s+)?(?:cre[aeá](?:me)?|crear|agreg[aeá](?:me)?|agregar|añad[ieí](?:me)?|añadir|anad[ieí](?:me)?|anadir|carg[aeá](?:me)?|cargar)\s+(?:una?|la|el|las|los)?\s*(?:tarea|tareas|pendiente|pendientes)?\s*(?:nueva|nuevas|nuevo|nuevos)?\s*[:,\-–—]?\s*/i,
      "",
    )
    .trim();

  return stripped.length > 0 ? stripped : text.trim();
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
