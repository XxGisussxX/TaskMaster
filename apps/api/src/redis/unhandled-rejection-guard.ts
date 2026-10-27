/**
 * Errores que el cliente de Redis produce cuando la conexión se cae o un
 * comando se pierde.
 *
 * ioredis los lanza como `Error` pelados, sin una clase propia ni un código
 * uniforme: la única forma de reconocerlos es por la forma del mensaje. Es
 * frágil frente a un upgrade de la librería, y por eso el listado se mantiene
 * corto y explícito en vez de intentar adivinar con un regex amplio.
 */
const REDIS_FAILURE_SIGNATURES = [
  "Connection is closed",
  "Stream isn't writeable",
  "Command timed out",
  "enableOfflineQueue options is false",
  "Connection in subscriber mode",
  "Redis is already connecting/connected",
  "Socket closed unexpectedly",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
];

function isRedisFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // `ReplyError` es un error de Redistoo (script mal, tipo equivocado): viene
  // por una operación que sí se manejó y sin fallar, así que no corresponde.
  if (error.name === "ReplyError") return false;
  const haystack = `${error.message} ${error.name}`;
  return REDIS_FAILURE_SIGNATURES.some((signature) =>
    haystack.includes(signature),
  );
}

/**
 * Dónde van los mensajes. Estructural a propósito: no se tipa contra el `Logger`
 * de Nest porque el caller tiene que poder pasar algo que escriba directo al
 * proceso.
 *
 * No se puede usar `Logger` de Nest para esto: con `bufferLogs: true` Nest
 * instala un logger bufferizado como instancia estática mientras dura el
 * `NestFactory.create()`, y ese buffer solo se vuelca en `app.useLogger()`. Si el
 * create falla —que es justo cuando más hace falta el mensaje— no hay app a la
 * que llamar y el texto se pierde entero.
 */
export interface UncaughtReporter {
  warn(message: string): void;
  error(message: string): void;
  /**
   * Opcional: además de loguear, reportar el error a un servicio externo.
   *
   * Está acá y no en un handler aparte para que el rechazo se capture en el
   * mismo instante en que se decide abortar; con `process.on("uncaughtException")`
   * se llegaría tarde en algunas versiones de Node.
   */
  capture?(error: unknown, context?: { tags?: Record<string, string> }): void;
}

/**
 * Instala el handler de `unhandledRejection`.
 *
 * Node aborta el proceso ante un rechazo sin manejar (`--unhandled-rejections=throw`
 * es el default desde v15), y eso contradice la política declarada de
 * `RedisService`: en runtime un Redis caído tiene que degradar, no tirar el
 * producto.
 *
 * El rechazo que motivó esto es real y reproducible, no una hipótesis: con Redis
 * caído al arrancar, ioredis deja una promesa rechazada en `Redis.js:220`
 * (`Error: Connection is closed.`, emitted por `connectionCloseHandler`) que
 * nadie maneja y Node reporta como `unhandledRejection`, matando el proceso antes
 * de que Nest pueda mostrar su propio mensaje de arranque.
 *
 * Se comprobó que esa promesa **no** es propiedad de este código: se reproduce
 * igual con `RedisService` sin cliente propio, con el probe de `assertReachable`
 * neutralizado y con un `.catch()` forzado sobre `connect()`. Es una promesa que
 * ioredis crea internamente y abandona, así que no hay un `await` nuestro que
 * pueda adoptarla. Intentar enlazarla desde afuera se traduce en monkey-patchear
 * la librería, que es más frágil que el problema que evita.
 *
 * Por eso el criterio es deliberadamente estrecho: solo se absorbe lo que es
 * inequívocamente un fallo de conexión de Redis. Un rechazo sin manejar en el
 * resto del código es un bug real y tiene que seguir tumbando el proceso, porque
 * dejarlo pasar significaría servir tráfico en un estado que nadie entendió.
 *
 * Va en un módulo aparte para que el criterio se pueda testear sin levantar Nest
 * ni abrir un socket.
 */
export function installUnhandledRejectionGuard(
  reporter: UncaughtReporter,
): void {
  process.on("unhandledRejection", (reason) => {
    if (!isRedisFailure(reason)) {
      reporter.capture?.(reason, { tags: { source: "unhandledRejection" } });
      reporter.error(
        `Rechazo de promesa sin manejar fuera del cliente de Redis: ${
          reason instanceof Error
            ? (reason.stack ?? reason.message)
            : String(reason)
        }. El proceso se aborta a propósito: esto no es un fallo de Redis.`,
      );
      // No se llama a `process.exit()`: se deja que el event loop termine por su
      // cuenta, igual que hace Nest en el camino de error del bootstrap. Si
      // quedara algún handle abierto (el server, un timer), el proceso no
      // bajaría y el log sería engañoso.
      process.exitCode = 1;
      return;
    }

    reporter.warn(
      `Redis dejó una promesa rechazada sin manejar, absorbida para no tirar el proceso: ${
        reason instanceof Error ? reason.message : String(reason)
      }. Si el rate limit o el lockout se ven raros, mirá /api/health/ready.`,
    );
  });
}

/** Exportado para los tests: el criterio con el que se decide absorber o no. */
export const redisFailureClassifier = { isRedisFailure };
