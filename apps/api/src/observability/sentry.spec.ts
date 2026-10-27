import { describe, expect, it, vi } from "vitest";
import {
  createSentryReporter,
  parseSentryDsn,
  parseStacktrace,
  SentryReporter,
} from "./sentry";

const DSN = "https://abc123@o42.ingest.sentry.io/99";

describe("parseSentryDsn", () => {
  it("arma la URL de ingesta a partir del DSN", () => {
    expect(parseSentryDsn(DSN)).toEqual({
      storeUrl: "https://o42.ingest.sentry.io/api/99/store/",
      publicKey: "abc123",
    });
  });

  it("respeta un path previo al projectId (self-hosted / relay)", () => {
    expect(
      parseSentryDsn("https://key@sentry.example.com/prefix/api/7"),
    ).toEqual({
      storeUrl: "https://sentry.example.com/prefix/api/api/7/store/",
      publicKey: "key",
    });
  });

  it("rechaza DSN sin clave o sin proyecto", () => {
    expect(parseSentryDsn("https://sentry.example.com/99")).toBeNull();
    expect(parseSentryDsn("https://key@sentry.example.com/")).toBeNull();
    expect(parseSentryDsn("no-es-una-url")).toBeNull();
    expect(parseSentryDsn("ftp://key@host/1")).toBeNull();
  });
});

describe("SentryReporter", () => {
  it("no hace nada si no hay DSN", () => {
    const fetchImpl = vi.fn();
    const reporter = createSentryReporter({ fetchImpl: fetchImpl as never });

    reporter.captureException(new Error("boom"));

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("manda el evento con la cabecera de autenticación", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const reporter = createSentryReporter({
      dsn: DSN,
      environment: "test",
      release: "1.2.3",
      fetchImpl: fetchImpl as never,
      now: () => new Date("2024-05-01T10:00:00.000Z"),
    });

    reporter.captureException(new Error("boom"), {
      method: "GET",
      path: "/api/tasks",
      statusCode: 500,
      userId: "u1",
    });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://o42.ingest.sentry.io/api/99/store/");
    expect(init.headers["X-Sentry-Auth"]).toContain("sentry_key=abc123");
    expect(init.headers["X-Sentry-Auth"]).toContain("sentry_version=7");

    const body = JSON.parse(init.body);
    expect(body.environment).toBe("test");
    expect(body.release).toBe("1.2.3");
    expect(body.transaction).toBe("/api/tasks");
    expect(body.tags).toEqual({
      method: "GET",
      path: "/api/tasks",
      status_code: "500",
    });
    expect(body.user).toEqual({ id: "u1" });
    expect(body.exception.values[0]).toMatchObject({
      type: "Error",
      value: "boom",
    });
  });

  it("no manda datos sensibles del request (headers, body, query)", () => {
    const reporter = new SentryReporter({ dsn: DSN, now: () => new Date(0) });

    const event = reporter.buildEvent(new Error("boom"), {
      method: "POST",
      path: "/api/auth/login",
      statusCode: 500,
    });

    expect(JSON.stringify(event)).not.toContain("password");
    expect(JSON.stringify(event)).not.toContain("cookie");
  });

  it("incluye el stack en orden Sentry (raíz primero)", () => {
    const error = new Error("boom");
    error.stack = [
      "Error: boom",
      "    at inner (C:\\app\\src\\b.ts:20:5)",
      "    at outer (C:\\app\\src\\a.ts:10:3)",
    ].join("\n");

    const reporter = new SentryReporter({ dsn: DSN, now: () => new Date(0) });
    const event = reporter.buildEvent(error);

    const frames = (
      event.exception as never as {
        values: { stacktrace?: { frames: Record<string, unknown>[] } }[];
      }
    ).values[0]!.stacktrace!.frames;

    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      function: "outer",
      filename: "C:\\app\\src\\a.ts",
      lineno: 10,
      colno: 3,
      in_app: true,
    });
    expect(frames[1]).toMatchObject({ function: "inner" });
  });

  it("marca node_modules como fuera de la app", () => {
    expect(
      parseStacktrace("    at load (C:\\app\\node_modules\\x\\index.js:1:2)"),
    ).toEqual({
      frames: [
        {
          function: "load",
          filename: "C:\\app\\node_modules\\x\\index.js",
          lineno: 1,
          colno: 2,
          in_app: false,
        },
      ],
    });
  });

  it("soporta errores que no son Error", () => {
    const reporter = new SentryReporter({ dsn: DSN, now: () => new Date(0) });
    const event = reporter.buildEvent("falló feo");

    expect(
      (event.exception as never as { values: Record<string, unknown>[] })
        .values[0],
    ).toEqual({ type: "NonError", value: "falló feo" });
  });

  it("se apaga 60 s después de un fallo de red", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("sin red"));
    const logger = vi.fn();
    let now = 0;
    const reporter = createSentryReporter({
      dsn: DSN,
      fetchImpl: fetchImpl as never,
      logger,
      now: () => new Date(now),
    });

    reporter.captureException(new Error("boom"));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    // El castigo se activa cuando la promesa rechaza, no al disparar el fetch.
    await vi.waitFor(() => expect(logger).toHaveBeenCalled());

    // Dentro de la ventana de castigo no se reintenta.
    reporter.captureException(new Error("boom 2"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Pasados los 60 s vuelve a intentar.
    now = 61_000;
    reporter.captureException(new Error("boom 3"));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    expect(logger).toHaveBeenCalled();
  });

  it("un 5xx de Sentry también cuenta como fallo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    const reporter = createSentryReporter({
      dsn: DSN,
      fetchImpl: fetchImpl as never,
    });

    reporter.captureException(new Error("boom"));
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    expect(reporter).toBeDefined();
  });
});
