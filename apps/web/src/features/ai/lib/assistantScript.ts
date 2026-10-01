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
    "Tenés {n} tarea vencida. ¿La cerramos de una y seguimos con lo que viene?",
    "Tenés {n} tareas vencidas. Mi sugerencia: arrancar por la más urgente y despacharlas de a una.",
    "Hay {n} tareas vencidas esperándote. Dale, que hoy es un buen día para poner el tablero al día.",
  ],
  idle: [
    "¿En qué querés avanzar ahora? Preguntame qué hacer o decime alguna tarea nueva y la anoto.",
    "Estás con tareas abiertas. Si querés, te digo cuál convendría atacar primero.",
    "¿Se te ocurre algo para sumar? Puedo dejarlo anotado como tarea y lo ordenamos.",
    "Si te quedaste sin ideas, decime 'qué hago primero' y te propongo el siguiente paso.",
  ],
  morale: [
    "Buen ritmo: {n} tarea completada hoy. Seguí así y vas cerrando la semana antes de lo pensado.",
    "Van {n} tareas completadas hoy. Cada una cuenta; seguimos con la próxima.",
    "{n} tareas hechas en el día. Lindo avance. ¿Agarramos la siguiente con el mismo envión?",
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

export function buildProactiveMessage(ctx: ProactiveContext): string {
  if (ctx.activeTasks <= 0) return pickPhrase("empty");
  if (ctx.overdueTasks > 0) {
    return pickPhrase("overdue").replace("{n}", String(ctx.overdueTasks));
  }
  if (ctx.completedToday > 0) {
    return pickPhrase("morale").replace("{n}", String(ctx.completedToday));
  }
  return pickPhrase("idle");
}
