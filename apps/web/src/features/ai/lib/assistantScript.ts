export type ProactiveTopic =
  "welcome" | "empty" | "overdue" | "idle" | "morale";

const SCRIPT: Record<ProactiveTopic, string[]> = {
  welcome: [
    "Hola, ¿cómo estás? Bienvenido. Soy tu copiloto: decime qué necesitás y lo encaramos.",
    "Hola, hace tiempo que no entrabas. ¿Vamos a poner tu tablero al día?",
    "¡Qué bueno verte! ¿En qué querés avanzar hoy?",
    "Hola, ¿cómo andás? Preguntame qué hacer o anotame una tarea nueva.",
  ],
  empty: [
    "No tenés tareas abiertas. ¿Empezamos una nueva y le damos ritmo al día?",
    "Estás en cero pendientes. Aprovechá para agregar algo que te venga a la mente y lo planificamos juntos.",
    "Sin tareas abiertas por ahora. Si querés, te propongo una para arrancar y después la ajustamos.",
  ],
  overdue: [
    "Tenés {n} {tareaVencida}. ¿Empezamos por la más urgente y seguimos con el resto?",
    "Tenés {n} {tareaVencida}. Mi sugerencia: arrancar por la más urgente y despachar de a una.",
    "Hay {n} {tareaVencida} esperándote. Dale, que hoy es un buen día para poner el tablero al día.",
  ],
  idle: [
    "¿En qué querés avanzar ahora? Preguntame qué hacer o decime alguna tarea nueva y la anoto.",
    "Estás con tareas abiertas. Si querés, te digo cuál convendría atacar primero.",
    "¿Se te ocurre algo para sumar? Puedo dejarlo anotado como tarea y lo ordenamos.",
    "Si te quedaste sin ideas, decime 'qué hago primero' y te propongo el siguiente paso.",
  ],
  morale: [
    "Buen ritmo: {n} {tareaCompletada} hoy. Seguí así y vas cerrando la semana antes de lo pensado.",
    "Van {n} {tareaCompletada} hoy. Cada una cuenta; seguimos con la próxima.",
    "{n} {tareaCompletada} en el día. Lindo avance. ¿Agarramos la siguiente con el mismo envión?",
  ],
};

const pointers: Partial<Record<ProactiveTopic, number>> = {};

export function pickPhrase(topic: ProactiveTopic): string {
  const pool = SCRIPT[topic];
  const idx = (pointers[topic] ?? 0) % pool.length;
  pointers[topic] = idx + 1;
  return pool[idx]!;
}

export interface ProactiveContext {
  activeTasks: number;
  overdueTasks: number;
  completedToday: number;
}

/**
 * Rellena los placeholders de la frase con el número real y el plural correcto.
 * El script se elige al azar, así que todas las variantes usan los mismos
 * tokens: con n=1 no puede salir "1 tareas vencidas".
 */
function fillPhrase(template: string, n: number): string {
  return template
    .replace(/\{n\}/g, String(n))
    .replace(/\{tareaVencida\}/g, n === 1 ? "tarea vencida" : "tareas vencidas")
    .replace(
      /\{tareaCompletada\}/g,
      n === 1 ? "tarea completada" : "tareas completadas",
    );
}

export function buildProactiveMessage(ctx: ProactiveContext): string {
  if (ctx.activeTasks <= 0) return pickPhrase("empty");
  if (ctx.overdueTasks > 0) {
    return fillPhrase(pickPhrase("overdue"), ctx.overdueTasks);
  }
  if (ctx.completedToday > 0) {
    return fillPhrase(pickPhrase("morale"), ctx.completedToday);
  }
  return pickPhrase("idle");
}
