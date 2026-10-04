import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  installUnhandledRejectionGuard,
  redisFailureClassifier,
  type UncaughtReporter,
} from "./unhandled-rejection-guard";

/**
 * Estos tests fijan la frontera entre "lo absorbimos" y "lo dejamos tumbar el
 * proceso", que es la decisión de seguridad de este módulo.
 *
 * El criterio es deliberadamente asimétrico: false positives (tumbar el proceso
 * por un fallo de Redis) son annoyance; false negatives (dejar pasar un bug real)
 * son servir tráfico en un estado que nadie entendió. Ante la duda, tumbar.
 */
describe("isRedisFailure", () => {
  it("reconoce el error que realmente crashed el proceso", () => {
    // Texto exacto de ioredis/built/Redis.js:220.
    const error = new Error("Connection is closed.");
    expect(redisFailureClassifier.isRedisFailure(error)).toBe(true);
  });

  it.each([
    ["Stream isn't writeable and enableOfflineQueue options is false"],
    ["Command timed out"],
    ["read ECONNRESET"],
    ["connect ECONNREFUSED 127.0.0.1:6379"],
    ["connect ETIMEDOUT"],
    ["write EPIPE"],
  ])("absorbe el fallo de conexión %s", (message) => {
    expect(redisFailureClassifier.isRedisFailure(new Error(message))).toBe(
      true,
    );
  });

  it("no absorbe un ReplyError: es un comando que falló y se manejó", () => {
    const error = new Error("Connection is closed.");
    error.name = "ReplyError";
    expect(redisFailureClassifier.isRedisFailure(error)).toBe(false);
  });

  it("no absorbe bugs de programación", () => {
    expect(
      redisFailureClassifier.isRedisFailure(
        new TypeError("x is not a function"),
      ),
    ).toBe(false);
    expect(
      redisFailureClassifier.isRedisFailure(
        new Error("Rate limit key missing"),
      ),
    ).toBe(false);
  });

  it("no absorbe rechazos que no son Error", () => {
    expect(redisFailureClassifier.isRedisFailure("Connection is closed.")).toBe(
      false,
    );
    expect(redisFailureClassifier.isRedisFailure(undefined)).toBe(false);
  });
});

describe("installUnhandledRejectionGuard", () => {
  const originalExitCode = process.exitCode;

  let added: ((reason: unknown) => void) | undefined;
  let logger: UncaughtReporter & { warn: Mock; error: Mock };

  beforeEach(() => {
    logger = { warn: vi.fn(), error: vi.fn() };

    // vitest registra su propio listener de `unhandledRejection`, así que el
    // handler de este módulo no es necesariamente el primero: se identifica por
    // diferencia. Y nunca se hace `removeAllListeners`, que se llevaría por
    // delante el del runner.
    const before = new Set(process.listeners("unhandledRejection"));
    installUnhandledRejectionGuard(logger);
    added = process
      .listeners("unhandledRejection")
      .find((listener) => !before.has(listener)) as
      ((reason: unknown) => void) | undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    if (added) process.off("unhandledRejection", added);
    added = undefined;
  });

  /** Invoca el handler directamente: un rechazo real tiraría el runner. */
  function emit(reason: unknown): void {
    expect(added).toBeDefined();
    added?.(reason);
  }

  it("deja pasar lo que no es de Redis y marca el proceso para que baje", () => {
    process.exitCode = 0;
    emit(new TypeError("undefined is not a function"));

    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("absorbe el fallo de Redis sin tocar el exitCode", () => {
    process.exitCode = 0;
    emit(new Error("Connection is closed."));

    expect(process.exitCode).toBe(0);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("loguea el stack completo en el bug real, no solo el mensaje", () => {
    emit(new TypeError("undefined is not a function"));

    const logged = logger.error.mock.calls[0]?.[0] as string;
    expect(logged).toContain("undefined is not a function");
  });
});
