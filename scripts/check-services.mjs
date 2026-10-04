/**
 * Preflight de servicios para `pnpm dev`.
 *
 * Sin esto, olvidar `docker compose up -d redis` se descubre recién cuando la API
 * muere en el arranque, y como el mensaje involves Nest+ioredis el primer error
 * que se ve no dice "levantá Redis". Este check lo dice antes de que compile nada.
 *
 * Solo usa `node:net`: no puede depender de paquetes del workspace porque corre
 * antes del build de `contracts` y `domain`, que es justamente lo que hace el
 * `predev` que lo invoca.
 *
 * Es un chequeo de TCP, no de protocolo: no speak ni Redis ni Postgres. Alcanza
 * para distinguir "no hay nada escuchando" de "el servicio está caído", que es la
 * causa real de este modo de falla. Validar el handshake lo hace la app al
 * arrancar, un segundo después.
 */

import { existsSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Carga los mismos `.env` que carga la app, en el mismo orden, para no chequear
 * un host que no es el que va a usar la API.
 *
 * `../../.env` y `.env` son relativos a `apps/api`, que es de donde `NestFactory`
 * los resuelve. Y no sobreescribe variables ya presentes en el entorno, igual que
 * hace Nest: lo que exporta la shell gana sobre el archivo.
 */
function loadEnvFiles() {
  // `process.loadEnvFile` existe desde Node 20.12. Si el proyecto corre con una
  // 20.x más viejo, se sigue adelante con los defaults: el check es una ayuda,
  // no una barrera, y `apps/api` es quien valida el env de verdad.
  if (typeof process.loadEnvFile !== "function") return;

  for (const relative of ["../../.env", ".env"]) {
    const path = join(ROOT, "apps", "api", relative);
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
    } catch {
      // Un `.env` mal formado lo va a explicar ConfigModule con más detalle.
    }
  }
}

loadEnvFiles();

const TIMEOUT_MS = 1500;

/** @param {{ host: string, port: number }} target */
function canConnect({ host, port }) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const finish = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** Extrae host y puerto de una URL de Postgres sin traer el parser completo. */
function parsePostgresTarget(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: Number(parsed.port || 5432),
    };
  } catch {
    // Una DATABASE_URL con formato raro no es motivo para bloquear el arranque:
    // Prisma la va a explicar mejor que este script.
    return null;
  }
}

function postgresTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return parsePostgresTarget(url);
}

function redisTarget() {
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT || 6379),
  };
}

const problems = [];

if (!(await canConnect(redisTarget()))) {
  const { host, port } = redisTarget();
  problems.push(
    `Redis no responde en ${host}:${port}.`,
    "  La API no arranca sin Redis: es el rate limiter compartido, el lockout y la cuota de IA.",
    "  Sin él, arrancar dejaría esos contadores en cero desde el primer request.",
    "",
    "  docker compose up -d redis",
  );
}

const pg = postgresTarget();
if (pg && !(await canConnect(pg))) {
  problems.push(
    `Postgres no responde en ${pg.host}:${pg.port}.`,
    "  docker compose up -d postgres",
    "  pnpm db:migrate",
  );
}

if (problems.length > 0) {
  console.error("Faltan servicios para pnpm dev:\n");
  console.error(problems.join("\n\n"));
  process.exit(1);
}
