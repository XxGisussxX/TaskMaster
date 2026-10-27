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
 * Verbos que el usuario puede escribir con el pronombre pegado.
 *
 * "completame", "marcalas" o "cerralas" son la forma natural de pedir la acción
 * en español rioplatense, y el regex de intención espera el verbo suelto. Antes
 * de analizar partimos verbo y pronombre, así el resto del detector no necesita
 * conocer las variantes enclíticas.
 */
const COMMAND_VERBS =
  "completa|completar|marca|marcar|cierra|cerrar|cerra|termina|terminar|finaliza|finalizar|elimina|eliminar|borra|borrar|quita|quitar|saca|sacar|remueve|remover|agrega|agregar|crea|crear|anade|anadir|carga|cargar";

const ENCLITIC_PRONOUNS =
  "melas|melos|meles|mela|melo|me|te|se|nos|las|los|les|la|lo|le";

const ENCLITIC = new RegExp(
  `\\b(${COMMAND_VERBS})(?:${ENCLITIC_PRONOUNS})\\b`,
  "g",
);

/**
 * Normaliza un mensaje de comando: minúsculas, sin acentos, sin puntuación y
 * sin el pronombre enclítico. No se usa para títulos de tareas, solo para
 * interpretar lo que pide el usuario.
 */
function normalizeCommand(value: string): string {
  return fold(value).replace(ENCLITIC, "$1").replace(/\s+/g, " ").trim();
}

/**
 * Confirmaciones cortas ("dale", "hazlo", "esas 5 están bien").
 *
 * Se exige que ocupen todo el mensaje: "dale, completá las vencidas" es una
 * orden nueva y tiene que resolverse como tal, no como confirmación.
 */
const CONFIRMATION =
  /^(?:si|dale|dele|hazlo|hacelo|hazlo tu|hacelo tu|ok|okey|vale|confirmo|confirmado|adelante|perfecto|de una|claro|obvio|correcto|esta bien)(?:\s+por favor)?$/;

const DEMONSTRATIVE_FINE =
  /^(?:esas?|estas?|esos?|estos?)\s+(?:(?:\d{1,2}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+)?(?:estan|esta)\s+bien$/;

export function isConfirmation(text: string): boolean {
  const value = normalizeCommand(text);
  return CONFIRMATION.test(value) || DEMONSTRATIVE_FINE.test(value);
}

/**
 * Qué acción dejó pendiente el asistente en su último mensaje.
 *
 * Solo se re-proponen acciones que ya tenían botón de confirmación; el click
 * sigue siendo obligatorio. Las propuestas de creación no se re-ejecutan porque
 * volver a llamar al modelo por un "dale" suelto generaría un borrador distinto.
 */
function detectPendingIntent(lastAssistantText: string): AssistantIntent {
  const raw = lastAssistantText.toLowerCase();
  if (raw.includes("¿elimino") || raw.includes("elimino estas")) {
    return { kind: "delete" };
  }
  if (raw.includes("¿marco") || raw.includes("marco estas")) {
    return { kind: "complete" };
  }
  return null;
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
export function detectAssistantIntent(
  text: string,
  lastAssistantText = "",
): AssistantIntent {
  const value = normalizeCommand(text);
  if (value.length === 0) return null;

  // "dale"/"hazlo tú" confirman lo que el asistente acaba de proponer. La
  // acción se vuelve a proponer con su botón; nunca se ejecuta sola.
  if (isConfirmation(value)) {
    return detectPendingIntent(lastAssistantText);
  }

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
    /\b(marca|marquen|marcar|completa|completen|completar|termina|terminen|terminar|finaliza|finalicen|finalizar|cierra|cierren|cierre|cerrar|cerra)\b/.test(
      value,
    );
  const completionWord =
    /\b(hech[oa]s?|completad[oa]s?|complet[oa]s?|terminad[oa]s?|finalizad[oa]s?|cerrad[oa]s?|list[oa]s?|resuelt[oa]s?)\b/.test(
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ¿El texto menciona este título como palabra/frase completa?
 *
 * Un `includes` simple hacía que "Tarea 1" matcheara dentro de "Tarea 10" y
 * metiera tareas de más en el lote. Los bordes excluyen letras y números, no
 * espacios: los títulos pueden tener puntuación alrededor.
 */
function mentionsTitleIn(normText: string, title: string): boolean {
  const normTitle = normalize(title);
  if (normTitle.length === 0) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(normTitle)}($|[^\\p{L}\\p{N}])`,
    "u",
  );
  return pattern.test(normText);
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
  const normText = normalize(text);
  if (normText.length === 0) return [];
  return suggestions.filter((s) => mentionsTitleIn(normText, s.title));
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

/**
 * Determinantes que acompañan una cantidad sin repetir "tareas": "esas 5",
 * "otras 4", "las 3 primeras". Es la forma más común de referirse al lote que
 * el asistente acaba de proponer.
 */
const DETERMINERS =
  "(?:esas|estas|esos|estos|otras|otros|las|los|primeras|primeros|ultimas|ultimos)";
const DETERMINER_DIGIT = new RegExp(`\\b${DETERMINERS}\\s+(\\d{1,2})\\b`);
const DETERMINER_WORD = new RegExp(
  `\\b${DETERMINERS}\\s+(${WORD_NUMBER_PATTERN})\\b`,
);

/**
 * "cerrá 5", "completame 3": cantidad pegada al verbo, sin la palabra "tareas".
 * El pronombre ya se partió en `normalizeCommand`, por eso se acepta separado.
 */
const COMMAND_DIGIT =
  /\b(?:completa|marca|cierra|cierre|cerra|termina|finaliza|borra|elimina|quita|saca|remueve|agrega|crea|anade|carga)(?:\s+(?:me|te|se|nos|las|los|les|la|lo|le))?\s+(\d{1,2})\b/;

function clampCount(value: number): number {
  return Math.max(1, Math.min(ASSISTANT_BATCH_LIMIT, value));
}

/**
 * Cantidad de tareas pedidas explícitamente ("5 tareas", "las 3 primeras",
 * "esas 5", "otras 4", "5 más", "cinco pendientes", "todas las vencidas").
 *
 * Devuelve `null` si el pedido no trae cantidad y `Infinity` para "todas", que
 * el seleccionador recorta al tope de lote.
 */
export function parseTaskCount(text: string): number | null {
  const value = normalizeCommand(text);

  if (
    /\bun\s+par\s+(?:de\s+)?(?:tareas?|pendientes?|cosas?|mas)\b/.test(value)
  ) {
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
    DETERMINER_DIGIT.exec(value) ??
    /\b(\d{1,2})\s+de\s+(?:las|los)\s+(?:tareas?|pendientes?)\b/.exec(value) ??
    /\b(\d{1,2})\s+mas\b/.exec(value) ??
    COMMAND_DIGIT.exec(value);

  if (digit) return clampCount(Number.parseInt(digit[1]!, 10));

  const word = WORD_COUNT.exec(value) ?? DETERMINER_WORD.exec(value);
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

/**
 * Pregunta por el total de tareas abiertas ("¿cuántas tareas tengo?", "cuántas
 * pendientes hay").
 *
 * Se responde de forma determinista con el total real de la base: el modelo
 * solo veía las 5 más urgentes y de ahí salían totales inventados.
 */
export function isTaskCountQuestion(text: string): boolean {
  const value = normalizeCommand(text);
  return (
    /\b(cuantas?|cuantos?)\s+(tareas?|pendientes?)\b/.test(value) ||
    /\bcuantas?\s+(tengo|hay|quedan)\b/.test(value) ||
    /\b(total|numero)\s+de\s+(tareas?|pendientes?)\b/.test(value)
  );
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

/** "esas/estas" apuntan a lo que el asistente acaba de listar. */
const PREVIOUS_REF = /\b(?:esas?|esos?|estas?|estos?|aquellas?|aquellos?)\b/;
/** "otras/otros" piden tareas distintas de las ya propuestas. */
const OTHER_REF = /\b(?:otras?|otros?)\b/;

export interface ResolveTaskTargetsOptions {
  /**
   * Tareas que el asistente propuso en su último mensaje. Permiten resolver
   * "esas 5" (el lote mostrado) y "otras 4" (las siguientes, sin repetir).
   */
  previous?: Suggestion[];
}

/**
 * Elige las tareas sobre las que aplicar una acción.
 *
 * Prioridad:
 * 1) títulos mencionados explícitamente (varios permitidos);
 * 2) "otras N": N tareas del ranking que no estén en el lote anterior;
 * 3) "esas N": el lote que el asistente acaba de proponer (si el pedido pide
 *    más de las listadas, se completa con el ranking para no quedarse corto);
 * 4) filtro por estado/prioridad ("las vencidas");
 * 5) cantidad pedida sobre el ranking de urgencia de `suggestibleTasks`.
 *
 * Si no hay ninguna señal devuelve `[]` y el servicio pide aclaración: nunca
 * adivina una tarea para una acción destructiva.
 */
export function resolveTaskTargets(
  text: string,
  suggestions: Suggestion[],
  options: ResolveTaskTargetsOptions = {},
): Suggestion[] {
  const value = normalizeCommand(text);
  const mentioned = findTaskMentions(text, suggestions);
  const count = parseTaskCount(text);
  const scope = detectTaskScope(text);
  const previous = options.previous ?? [];

  if (mentioned.length > 0) {
    if (count !== null && Number.isFinite(count)) {
      return mentioned.slice(0, count);
    }
    return mentioned.slice(0, ASSISTANT_BATCH_LIMIT);
  }

  if (OTHER_REF.test(value) && count !== null) {
    const excluded = new Set(previous.map((task) => task.taskId));
    let pool = suggestions.filter((task) => !excluded.has(task.taskId));
    if (scope) pool = pool.filter((task) => matchesScope(task, scope));
    const limit =
      count === Number.POSITIVE_INFINITY ? ASSISTANT_BATCH_LIMIT : count;
    return pool.slice(0, limit);
  }

  if (PREVIOUS_REF.test(value) && previous.length > 0) {
    if (count === null) return previous.slice(0, ASSISTANT_BATCH_LIMIT);
    if (count === Number.POSITIVE_INFINITY) return previous;
    if (previous.length >= count) return previous.slice(0, count);

    // El asistente pudo nombrar solo algunas del lote (por ejemplo, en un
    // consejo). Completamos con el ranking para respetar la cantidad pedida.
    const listed = new Set(previous.map((task) => task.taskId));
    const extra = suggestions.filter((task) => !listed.has(task.taskId));
    return [...previous, ...extra.slice(0, count - previous.length)];
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
 * Tareas que el asistente nombró en su último mensaje.
 *
 * Las propuestas de lote listan los títulos ("- Preparar demo"), así que el
 * matcheo de menciones sirve para "esas 5" y para "hazlo tú" después de una
 * propuesta, incluso si el cliente perdió los botones al recargar.
 */
export function extractTaskRefs(
  assistantText: string,
  suggestions: Suggestion[],
): Suggestion[] {
  return findTaskMentions(assistantText, suggestions);
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
