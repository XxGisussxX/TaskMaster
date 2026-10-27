import { randomUUID } from "node:crypto";

/**
 * Puerto mínimo de reporte de errores.
 *
 * No se usa `@sentry/nestjs` a propósito. Agregarlo obligaba a re-resolver 437
 * versiones transitivas del lockfile (pnpm 11 resuelve de nuevo todo el grafo),
 * un cambio enorme para una dependencia que acá se usa en un solo punto. Este
 * reporter habla la Store API de Sentry, que es estable desde hace años: manda
 * un JSON por `fetch` y no toca el resto del árbol de dependencias.
 *
 * Si más adelante hace falta tracing, breadcrumbs o performance, ahí sí conviene
 * el SDK oficial; la interfaz `ErrorReporter` permite cambiarlo sin tocar los
 * call sites.
 */
export interface ErrorReporter {
  captureException(error: unknown, context?: ErrorContext): void;
}

export interface ErrorContext {
  /** Ruta sin query string: la query puede traer tokens. */
  path?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  workspaceId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface SentryReporterOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  serverName?: string;
  /** Inyectable para tests. */
  fetchImpl?: typeof fetch;
  /** Inyectable para tests; por defecto `new Date()`. */
  now?: () => Date;
  logger?: (message: string) => void;
  timeoutMs?: number;
}

interface ParsedDsn {
  storeUrl: string;
  publicKey: string;
}

/**
 * Convierte un DSN de Sentry en la URL de ingesta y la clave pública.
 *
 * Formato: `https://<publicKey>@<host>[/<path>]/<projectId>`. El path opcional
 * existe en instalaciones self-hosted y en relays, así que no se asume que el
 * projectId sea el primer segmento.
 */
export function parseSentryDsn(dsn: string): ParsedDsn | null {
  let url: URL;
  try {
    url = new URL(dsn);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const publicKey = url.username;
  const segments = url.pathname.split("/").filter(Boolean);
  const projectId = segments.pop();
  if (!publicKey || !projectId) return null;

  const prefix = segments.length > 0 ? `/${segments.join("/")}` : "";
  return {
    storeUrl: `${url.protocol}//${url.host}${prefix}/api/${projectId}/store/`,
    publicKey,
  };
}

export class SentryReporter implements ErrorReporter {
  private readonly parsed: ParsedDsn | null;
  private readonly environment?: string;
  private readonly release?: string;
  private readonly serverName: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly logger: (message: string) => void;
  private readonly timeoutMs: number;

  /** Tras un fallo de red se deja de intentar por un rato. */
  private disabledUntil = 0;

  constructor(options: SentryReporterOptions) {
    this.parsed = options.dsn ? parseSentryDsn(options.dsn) : null;
    this.environment = options.environment;
    this.release = options.release;
    this.serverName = options.serverName ?? "taskmaster-api";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.logger = options.logger ?? (() => {});
    this.timeoutMs = options.timeoutMs ?? 4_000;
  }

  get enabled(): boolean {
    return this.parsed !== null;
  }

  captureException(error: unknown, context: ErrorContext = {}): void {
    if (!this.parsed) return;

    const now = this.now().getTime();
    if (now < this.disabledUntil) return;

    // `captureException` se llama desde el filtro de excepciones: si fallara o
    // tardara, taparía la respuesta al cliente. Por eso se dispara y se olvida.
    void this.send(this.buildEvent(error, context)).catch(
      (sendError: unknown) => {
        this.disabledUntil = this.now().getTime() + 60_000;
        this.logger(
          `No se pudo reportar el error a Sentry (se reintenta en 60 s): ${
            sendError instanceof Error ? sendError.message : String(sendError)
          }`,
        );
      },
    );
  }

  /** Visible para tests: el payload exacto que se manda a Sentry. */
  buildEvent(
    error: unknown,
    context: ErrorContext = {},
  ): Record<string, unknown> {
    const tags = compact({
      method: context.method,
      path: context.path,
      status_code:
        context.statusCode !== undefined
          ? String(context.statusCode)
          : undefined,
      ...context.tags,
    });

    return compact({
      event_id: randomUUID().replace(/-/g, ""),
      timestamp: this.now().toISOString(),
      platform: "node",
      level: "error",
      logger: "taskmaster-api",
      environment: this.environment,
      release: this.release,
      server_name: this.serverName,
      transaction: context.path,
      tags,
      extra: compact({
        workspace_id: context.workspaceId,
        ...context.extra,
      }),
      user: context.userId ? { id: context.userId } : undefined,
      exception: { values: [toExceptionValue(error)] },
    });
  }

  private async send(event: Record<string, unknown>): Promise<void> {
    if (!this.parsed) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.parsed.storeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": [
            "Sentry sentry_version=7",
            `sentry_key=${this.parsed.publicKey}`,
            "sentry_client=taskmaster-api/1.0",
          ].join(", "),
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Sentry respondió ${response.status}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Reporter que no hace nada. Se usa en desarrollo, en tests y cuando no hay
 * `SENTRY_DSN`: el resto del código llama igual y no necesita condicionales.
 */
const noopReporter: ErrorReporter = {
  captureException: () => {},
};

export function createSentryReporter(
  options: SentryReporterOptions,
): ErrorReporter {
  const reporter = new SentryReporter(options);
  return reporter.enabled ? reporter : noopReporter;
}

function toExceptionValue(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const stacktrace = parseStacktrace(error.stack);
    return compact({
      type: error.name || "Error",
      value: truncate(error.message, 1_000),
      stacktrace,
    });
  }

  return {
    type: "NonError",
    value: truncate(safeString(error), 1_000),
  };
}

/**
 * Traduce el stack de V8 al formato de Sentry.
 *
 * V8 lista los frames del más nuevo al más viejo; Sentry los quiere al revés
 * (el primero es donde arrancó todo). Un stack que no matchea no invalida el
 * evento: se manda igual sin frames, que es mejor que perder el error.
 */
export function parseStacktrace(
  stack: string | undefined,
): { frames: Record<string, unknown>[] } | undefined {
  if (!stack) return undefined;

  const frames: Record<string, unknown>[] = [];
  for (const line of stack.split("\n")) {
    const match = line.match(
      /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/,
    );
    if (!match) continue;

    const [, fn, file, lineNumber, column] = match;
    if (!file || !lineNumber || !column) continue;
    frames.push(
      compact({
        function: fn?.replace(/^async\s+/, ""),
        filename: file,
        lineno: Number(lineNumber),
        colno: Number(column),
        in_app: !file.includes("node_modules"),
      }),
    );
  }

  if (frames.length === 0) return undefined;
  return { frames: frames.reverse() };
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function safeString(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
