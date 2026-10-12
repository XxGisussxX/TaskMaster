/**
 * Benchmark de línea base (FASE 2 · punto A). SOLO MIDE: no modifica la API.
 *
 * Requiere:
 *   - La API arrancada con DATABASE_URL apuntando a la base de bench, p. ej.:
 *       $env:DATABASE_URL="postgresql://taskmaster:taskmaster@localhost:5433/taskmaster_bench?schema=public"
 *       $env:API_PORT="4100"; $env:REDIS_DB="1"; $env:REDIS_KEY_PREFIX="bench"
 *       node dist/main.js
 *   - La base de bench sembrada con prisma/seed.bench.ts.
 *
 * Uso (desde apps/api):
 *   $env:DATABASE_URL="...taskmaster_bench...?schema=public"
 *   $env:BENCH_BASE_URL="http://localhost:4100/api"
 *   node --expose-gc scripts/bench-report.mjs
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

const BASE_URL = process.env.BENCH_BASE_URL ?? "http://localhost:4100/api";
const EMAIL = process.env.BENCH_EMAIL ?? "bench0@taskmaster.app";
const PASSWORD = process.env.BENCH_PASSWORD ?? "password123";
const RUNS = 6;
const WARMUP = 1;

const prisma = new PrismaClient();

const SCALES = [
  { slug: "bench-1k", tasks: 1_000, timeEntries: 2_000 },
  { slug: "bench-10k", tasks: 10_000, timeEntries: 20_000 },
  { slug: "bench-50k", tasks: 50_000, timeEntries: 200_000 },
];

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const round = (n, d = 1) => Number(n.toFixed(d));

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok)
    throw new Error(`login falló: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.accessToken;
}

async function measure(token, path) {
  const url = `${BASE_URL}${path}`;
  let bytes = 0;
  const times = [];
  for (let i = 0; i < WARMUP + RUNS; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    const t0 = performance.now();
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const buf = await res.arrayBuffer();
    const t1 = performance.now();
    clearTimeout(timer);
    bytes = buf.byteLength;
    if (!res.ok) {
      return { error: res.status };
    }
    if (i >= WARMUP) times.push(t1 - t0);
  }
  return {
    medianMs: round(median(times)),
    minMs: round(Math.min(...times)),
    bytes,
  };
}

function heapOf(label, query) {
  return async () => {
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;
    const rows = await query();
    const after = process.memoryUsage().heapUsed;
    const count = rows.length;
    const jsonBytes = Buffer.byteLength(JSON.stringify(rows));
    if (global.gc) global.gc();
    return {
      label,
      count,
      heapMB: round((after - before) / 1024 / 1024),
      jsonMB: round(jsonBytes / 1024 / 1024),
    };
  };
}

async function main() {
  const startedAt = new Date();
  const token = await login();

  const workspaces = await prisma.workspace.findMany({
    where: { slug: { in: SCALES.map((s) => s.slug) } },
    select: { id: true, slug: true },
  });
  const idBySlug = new Map(workspaces.map((w) => [w.slug, w.id]));

  const ENDPOINTS = [
    {
      key: "dashboard",
      label: "GET dashboard",
      path: (id) => `/workspaces/${id}/dashboard`,
    },
    {
      key: "tasks50",
      label: "GET tasks (pageSize=50)",
      path: (id) => `/workspaces/${id}/tasks?page=1&pageSize=50`,
    },
    {
      key: "tasks500",
      label: "GET tasks (pageSize=500, vista calendario)",
      path: (id) => `/workspaces/${id}/tasks?page=1&pageSize=500`,
    },
    {
      key: "agenda",
      label: "GET agenda-review",
      path: (id) => `/workspaces/${id}/agenda-review`,
    },
    {
      key: "timeEntries",
      label: "GET time-entries (sin paginar)",
      path: (id) => `/workspaces/${id}/time-entries`,
    },
  ];

  const results = {};
  for (const scale of SCALES) {
    const id = idBySlug.get(scale.slug);
    results[scale.slug] = { workspaceId: id, endpoints: {} };
    for (const ep of ENDPOINTS) {
      const r = await measure(token, ep.path(id));
      results[scale.slug].endpoints[ep.key] = r;
      const detail = r.error
        ? `HTTP ${r.error}`
        : `${r.medianMs}ms (${(r.bytes / 1024 / 1024).toFixed(1)} MB)`;
      console.log(`${scale.slug} · ${ep.label} → ${detail}`);
    }
  }

  // Aproximación de memoria EN PROCESO: replica la forma que carga cada
  // consulta de la API y mide el delta de heapUsed tras el gc().
  const mem = {};
  for (const scale of SCALES) {
    const id = idBySlug.get(scale.slug);
    const probes = [
      heapOf("dashboard (todas las tareas)", () =>
        prisma.task.findMany({
          where: { workspaceId: id },
          select: {
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
          },
        }),
      ),
      heapOf("tasks pageSize=500", () =>
        prisma.task.findMany({ where: { workspaceId: id }, take: 500 }),
      ),
      heapOf("time-entries (todas)", () =>
        prisma.timeEntry.findMany({ where: { workspaceId: id } }),
      ),
    ];
    mem[scale.slug] = [];
    for (const probe of probes) {
      mem[scale.slug].push(await probe());
    }
  }

  await prisma.$disconnect();

  const md = renderMarkdown({ startedAt, results, mem, scales: SCALES });
  const out =
    process.env.BENCH_OUT ??
    new URL("../../../docs/bench-baseline.md", import.meta.url);
  writeFileSync(out, md);
  console.log(`\nEscrito ${process.env.BENCH_OUT ?? "docs/bench-baseline.md"}`);
}

function fmtMs(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v} ms`;
}
function fmtMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderMarkdown({ startedAt, results, mem, scales }) {
  const lines = [];
  lines.push("# Benchmark de línea base — dashboard y listados");
  lines.push("");
  lines.push(
    "> Generado por `apps/api/scripts/bench-report.mjs` (FASE 2 · punto A). **Solo mide**: no toca código de la aplicación.",
  );
  lines.push("");
  lines.push(`Fecha de corrida: ${startedAt.toISOString()}`);
  lines.push("");
  lines.push("## Entorno");
  lines.push("");
  lines.push(
    "- API: build de `apps/api` (`node dist/main.js`), `API_PORT=4100`, `NODE_ENV=development`.",
  );
  lines.push(
    "- PostgreSQL 18 en Docker (`taskmaster-postgres`, `localhost:5433`), base desechable **`taskmaster_bench`**.",
  );
  lines.push(
    "- Redis en Docker (`localhost:6379`, `REDIS_DB=1`, prefijo `bench`).",
  );
  lines.push(
    "- Cliente de medición: `fetch` de Node en el mismo host; se reporta el tiempo de ida y vuelta + parseo a ArrayBuffer y el tamaño del payload.",
  );
  lines.push("");
  lines.push("## Datos sembrados");
  lines.push("");
  lines.push(
    "Deterministas (PRNG sembrado). Login: `bench0@taskmaster.app` / `password123` (OWNER de los tres).",
  );
  lines.push("");
  lines.push("| Workspace | Tareas | Time-entries |");
  lines.push("| --- | ---: | ---: |");
  for (const s of scales)
    lines.push(
      `| ${s.slug} | ${s.tasks.toLocaleString("es")} | ${s.timeEntries.toLocaleString("es")} |`,
    );
  lines.push("");
  lines.push(
    "Distribución de tareas: estado DONE 45 % / TODO 22 % / IN_PROGRESS 17 % / IN_REVIEW 11 % / ARCHIVED 5 %; prioridad URGENT 12 % / HIGH 28 % / MEDIUM 35 % / LOW 25 %; `createdAt` dentro del último año; vencidas ~30 % de las abiertas; asignados 1-3 en 90 %; tags 1-3; canal en 85 %.",
  );
  lines.push("");
  lines.push(
    "## Resultados de API (mediana de 6 corridas tras 1 de calentamiento)",
  );
  lines.push("");
  lines.push("| Endpoint | 1k tareas | 10k tareas | 50k tareas |");
  lines.push("| --- | ---: | ---: | ---: |");
  const eps = [
    ["dashboard", "`GET /workspaces/:id/dashboard`"],
    ["tasks50", "`GET /workspaces/:id/tasks?pageSize=50`"],
    ["tasks500", "`GET /workspaces/:id/tasks?pageSize=500` (calendario)"],
    ["agenda", "`GET /workspaces/:id/agenda-review`"],
    ["timeEntries", "`GET /workspaces/:id/time-entries`"],
  ];
  for (const [key, label] of eps) {
    const cells = scales.map((s) => {
      const r = results[s.slug].endpoints[key];
      if (r.error) return `HTTP ${r.error}`;
      return `${fmtMs(r.medianMs)} · ${fmtMB(r.bytes)}`;
    });
    lines.push(`| ${label} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("(tiempo · tamaño de respuesta)");
  lines.push("");
  lines.push("## Memoria (aproximación en proceso)");
  lines.push("");
  lines.push(
    "Replica la forma de datos que carga cada consulta y mide el delta de `heapUsed` tras `gc()`. Es una **aproximación del lado del cliente**, no del proceso de la API; sirve para comparar el volumen de objetos que hoy se materializan en memoria.",
  );
  lines.push("");
  lines.push("| Consulta | 1k tareas | 10k tareas | 50k tareas |");
  lines.push("| --- | ---: | ---: | ---: |");
  const probeLabels = [
    "dashboard (todas las tareas)",
    "tasks pageSize=500",
    "time-entries (todas)",
  ];
  for (let i = 0; i < probeLabels.length; i++) {
    const cells = scales.map((s) => {
      const m = mem[s.slug][i];
      return `${m.heapMB} MB (${m.count.toLocaleString("es")} filas)`;
    });
    lines.push(`| ${probeLabels[i]} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Lectura");
  lines.push("");
  lines.push(
    "- El dashboard carga **todas** las tareas del workspace en cada request (sin `take`): el costo crece lineal con el tamaño. Este es el objetivo del punto B.",
  );
  lines.push(
    "- `GET /time-entries` no pagina ni agrega: en 50k devuelve todo el histórico (200k filas). Objetivo del punto D.",
  );
  lines.push(
    "- `agenda-review` también es sensible al volumen de tareas abiertas.",
  );
  const agenda50k = results["bench-50k"].endpoints.agenda;
  if (agenda50k?.error) {
    lines.push(
      `- **Falla en 50k tareas**: \`GET agenda-review\` responde **HTTP ${agenda50k.error}**. El motor de reglas del dominio (\`packages/domain/src/agenda.ts\`) detecta solapamiento en O(n²) y acumula con \`findings.push(...array)\`; con decenas de miles de hallazgos el *spread* revienta el stack (\`RangeError: Maximum call stack size exceeded\`). Es un bug de escalabilidad preexistente, no introducido por el benchmark.`,
    );
  }
  lines.push("");
  lines.push("## Limitaciones / NO VERIFICADO");
  lines.push("");
  lines.push(
    "- Memoria del **proceso de la API** (RSS) no medida: la tabla de memoria es una aproximación en proceso (ver arriba).",
  );
  lines.push(
    "- Mediciones en una sola máquina, sin red real ni caché HTTP; sirven como referencia relativa antes/después, no como cifras absolutas de producción.",
  );
  lines.push(
    "- Se sembró exactamente 200.000 time-entries en el workspace de 50k; los de 1k/10k llevan 2k/20k proporcionales.",
  );
  lines.push("");
  return lines.join("\n");
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
