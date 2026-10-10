// Verifica que la base de datos apuntada por DATABASE_URL está al día y sin
// drift respecto a schema.prisma. Pensado para correr antes de desplegar contra
// una copia de staging/prod (o la real, con backup previo).
//
// Uso (desde la raíz del repo):
//   $env:DATABASE_URL = "postgresql://..."
//   pnpm --filter @taskmaster/api prisma:migrate:check
//
// Sale con código != 0 y un mensaje claro si hay migraciones pendientes,
// drift o si DATABASE_URL no está definida.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DATABASE_URL = process.env.DATABASE_URL;
const API_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCHEMA = join(API_ROOT, "prisma", "schema.prisma");
const BIN = process.platform === "win32" ? "prisma.cmd" : "prisma";

const ENV = { ...process.env, DATABASE_URL };

function run(args) {
  return spawnSync(BIN, args, {
    cwd: API_ROOT,
    env: ENV,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function fail(message) {
  console.error(`\n[migrate-check] ERROR: ${message}`);
}

if (!DATABASE_URL) {
  console.error(
    "[migrate-check] DATABASE_URL no está definida. " +
      "Ejemplo:\n  $env:DATABASE_URL = \"postgresql://user:pass@host:5432/db?schema=public\"",
  );
  process.exit(1);
}

console.log("[migrate-check] 1/2 prisma migrate status");
const status = run(["migrate", "status", "--schema", SCHEMA]);
if (status.error || status.status !== 0) {
  fail(
    "hay migraciones pendientes o la base no responde. " +
      "Aplicá `prisma migrate deploy` o revisá DATABASE_URL antes de desplegar.",
  );
  process.exitCode = status.status ?? 1;
} else {
  console.log("[migrate-check] Sin migraciones pendientes ✔");
}

// `--exit-code` hace que prisma salga con código 2 si hay diferencias entre la
// base y el schema (drift): alguien tocó schema.prisma sin generar migración.
console.log("\n[migrate-check] 2/2 prisma migrate diff (drift)");
const diff = run([
  "migrate",
  "diff",
  "--from-url",
  DATABASE_URL,
  "--to-schema-datamodel",
  SCHEMA,
  "--exit-code",
]);
if (diff.error || diff.status !== 0) {
  fail(
    "hay drift entre la base y schema.prisma. " +
      "Generá la migración faltante (`prisma migrate dev`), revidala y volvé a intentar.",
  );
  process.exitCode = diff.status ?? 1;
} else {
  console.log("[migrate-check] Sin drift ✔");
  console.log("[migrate-check] OK: base al día sin pendientes ni drift.");
}