/**
 * Qué mostrar cuando la API no puede arrancar.
 *
 * Vive aparte de `main.ts` para poder testear el texto: es la única ayuda que ve
 * quien llega a un `pnpm dev` que no levanta, así que su calidad importa tanto
 * como el fix que la dispara.
 */

/** Causa raíz de un `AggregateError`, que es lo que Nest lanza al fallar un `onModuleInit`. */
function rootCauses(error: unknown): unknown[] {
  if (
    error instanceof Error &&
    "errors" in error &&
    Array.isArray((error as { errors?: unknown[] }).errors)
  ) {
    return (error as { errors: unknown[] }).errors as unknown[];
  }
  return [error];
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // `message` primero porque es lo accionable; el stack va detrás porque sin
    // TTY Nest puede imprimirlo recortado y el stack es el que nadie lee igual.
    return error.message || error.name;
  }
  return String(error);
}

/** Indica si el fallo apunta a Redis, para poder dar la instrucción concreta. */
function looksLikeRedis(error: unknown): boolean {
  const haystack = rootCauses(error)
    .map((cause) =>
      cause instanceof Error ? `${cause.message} ${cause.name}` : String(cause),
    )
    .join(" ");

  return /redis|ECONNREFUSED|ETIMEDOUT|ECONNRESET|Connection is closed/i.test(
    haystack,
  );
}

/** Indica si el fallo apunta a la base de datos. */
function looksLikeDatabase(error: unknown): boolean {
  const haystack = rootCauses(error)
    .map((cause) =>
      cause instanceof Error ? `${cause.message} ${cause.name}` : String(cause),
    )
    .join(" ");

  return /prisma|database|postgres|P1001|P1000/i.test(haystack);
}

/**
 * Arma el mensaje de arranque fallido.
 *
 * El punto de este módulo es que el texto no se pierda: con `bufferLogs: true`,
 * si `NestFactory.create()` lanza —que es exactamente lo que pasa cuando un
 * `onModuleInit` falla— el buffer de Nest nunca se vuelca porque
 * `app.useLogger()` no llegó a ejecutarse. Por eso el mensaje se arma y se
 * escribe acá, por fuera del ciclo de vida de la app.
 */
export function describeBootstrapFailure(error: unknown): string {
  const causes = rootCauses(error);
  const lines = [
    "La API no pudo arrancar.",
    ...causes.map((cause) => `  - ${describe(cause)}`),
  ];

  // La causa más profunda suele estar al final del AggregateError, y es la que
  // dice qué servicio falta. Se muestra entera para no mandar a nadie a debuggear
  // un symptom de Nest en vez del problema real.
  if (causes.length > 1) {
    lines.push(`Causa raíz: ${describe(causes[causes.length - 1])}`);
  }

  if (looksLikeRedis(error)) {
    lines.push(
      "Redis no responde. La API no arranca sin Redis (fail-closed) porque es el",
      "rate limiter compartido, el lockout y la cuota: sin él, arrancar dejaría",
      "esos contadores en cero desde el primer request.",
      "",
      "  docker compose up -d redis",
      "  docker compose ps      # para ver si está healthy",
    );
  } else if (looksLikeDatabase(error)) {
    lines.push(
      "La base de datos no responde.",
      "",
      "  docker compose up -d postgres",
      "  pnpm --filter @taskmaster/api db:migrate",
    );
  }

  return lines.join("\n");
}
