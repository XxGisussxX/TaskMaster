// Ejecuta un binario (prisma, ts-node, ...) cargando antes los `.env` que usa la
// API en runtime, para que el CLI de Prisma vea el mismo DATABASE_URL que Nest.
//
// Nest carga `["../../.env", ".env"]` relativos a `apps/api`, pero el CLI de
// Prisma solo mira el cwd (`apps/api`) y `prisma/`. Sin esto, `pnpm db:migrate`
// con un `.env` en la raíz falla con "Environment variable not found:
// DATABASE_URL" aunque la API funcione.
//
// Precedencia (gana el último): entorno de shell/CI > apps/api/.env > .env raíz.
// Lo que ya viene exportado en el entorno (CI, `docker compose`) nunca se pisa.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_ENV = join(API_ROOT, "..", "..", ".env");
const API_ENV = join(API_ROOT, ".env");

/** Parser mínimo key=value: ignora comentarios y líneas vacías, respeta comillas. */
function parseEnvFile(path) {
  const vars = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    vars[key] = value;
  }
  return vars;
}

const fromShell = new Set(Object.keys(process.env));
const loaded = {};
for (const file of [ROOT_ENV, API_ENV]) {
  if (existsSync(file)) Object.assign(loaded, parseEnvFile(file));
}
for (const [key, value] of Object.entries(loaded)) {
  if (!fromShell.has(key)) process.env[key] = value;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("[run-with-env] falta el comando a ejecutar");
  process.exit(1);
}

const result = spawnSync(command, args, {
  cwd: API_ROOT,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
