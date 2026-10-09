/**
 * Audit de dependencias de producción con allowlist documentado.
 *
 * Corre `pnpm audit --prod --json`, y falla (exit 1) si aparece una
 * vulnerabilidad CRITICAL o HIGH que no esté en `.ci/audit-allowlist.json`.
 * Las excepciones del allowlist tienen que estar justificadas por escrito en el
 * archivo; si cambia el rango vulnerable reportado, este script avisa para
 * re-evaluar la excepción en vez de dormir con ella.
 *
 * Sin dependencias del workspace: solo `node:child_process` y `node:fs`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWLIST = JSON.parse(
  readFileSync(join(ROOT, ".ci", "audit-allowlist.json"), "utf8"),
);

const FAIL_SEVERITIES = new Set(["critical", "high"]);

function runAudit() {
  let stdout;
  try {
    stdout = execFileSync("pnpm", ["audit", "--prod", "--json"], {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // pnpm audit sale con exit != 0 cuando encuentra vulnerabilidades: el output
    // JSON sigue siendo válido y el veredicto lo damos nosotros con el allowlist.
    stdout = error.stdout ?? "";
  }
  return JSON.parse(stdout);
}

const { advisories } = runAudit();

const problems = [];
const rechecked = [];

for (const advisory of Object.values(advisories ?? {})) {
  if (!FAIL_SEVERITIES.has(advisory.severity)) continue;

  const allowed = ALLOWLIST[advisory.module_name];
  if (allowed) {
    const rangeChanged =
      allowed.vulnerable_versions && allowed.vulnerable_versions !== advisory.vulnerable_versions;
    rechecked.push(
      `${advisory.module_name} (${advisory.severity.toUpperCase()}, ${advisory.github_advisory_id})` +
        (rangeChanged
          ? ` — ATENCIÓN: el rango vulnerable ahora es "${advisory.vulnerable_versions}" (allowlist decía "${allowed.vulnerable_versions}")`
          : " — excluida (documentado en .ci/audit-allowlist.json)"),
    );
    continue;
  }

  problems.push(
    `${advisory.module_name} ${advisory.severity.toUpperCase()}: ${advisory.title}`,
    `  advisory ${advisory.github_advisory_id} (npm id ${advisory.id}), vulnerable: ${advisory.vulnerable_versions}`,
    `  ${advisory.url}`,
  );
}

for (const line of rechecked) console.log(`audit-prod: ${line}`);

if (problems.length > 0) {
  console.error(
    `audit-prod: ${problems.length} vulnerabilidades CRITICAL/HIGH no permitidas en .ci/audit-allowlist.json:`,
  );
  for (const line of problems) console.error(`  ${line}`);
  console.error(
    "Revisá si hay fix (pnpm update / override) antes de sumar la excepción, y si la sumás, justificá la razón en el allowlist.",
  );
  process.exit(1);
}

console.log(`audit-prod: ok (${Object.keys(advisories ?? {}).length} advisory(ies) en total, ${rechecked.length} excluida(s) documentadas) en ${relative(process.cwd(), ROOT) || "."}`);