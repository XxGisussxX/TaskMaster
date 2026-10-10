# Benchmark de línea base — dashboard y listados

> Generado por `apps/api/scripts/bench-report.mjs` (FASE 2 · punto A). **Solo mide**: no toca código de la aplicación.

Fecha de corrida: 2026-10-10T18:45:49.307Z

## Entorno

- API: build de `apps/api` (`node dist/main.js`), `API_PORT=4100`, `NODE_ENV=development`.
- PostgreSQL 18 en Docker (`taskmaster-postgres`, `localhost:5433`), base desechable **`taskmaster_bench`**.
- Redis en Docker (`localhost:6379`, `REDIS_DB=1`, prefijo `bench`).
- Cliente de medición: `fetch` de Node en el mismo host; se reporta el tiempo de ida y vuelta + parseo a ArrayBuffer y el tamaño del payload.

## Datos sembrados

Deterministas (PRNG sembrado). Login: `bench0@taskmaster.app` / `password123` (OWNER de los tres).

| Workspace | Tareas | Time-entries |
| --------- | -----: | -----------: |
| bench-1k  |   1000 |         2000 |
| bench-10k | 10.000 |       20.000 |
| bench-50k | 50.000 |      200.000 |

Distribución de tareas: estado DONE 45 % / TODO 22 % / IN_PROGRESS 17 % / IN_REVIEW 11 % / ARCHIVED 5 %; prioridad URGENT 12 % / HIGH 28 % / MEDIUM 35 % / LOW 25 %; `createdAt` dentro del último año; vencidas ~30 % de las abiertas; asignados 1-3 en 90 %; tags 1-3; canal en 85 %.

## Resultados de API (mediana de 6 corridas tras 1 de calentamiento)

| Endpoint                                              |         1k tareas |        10k tareas |        50k tareas |
| ----------------------------------------------------- | ----------------: | ----------------: | ----------------: |
| `GET /workspaces/:id/dashboard`                       |  95.9 ms · 0.0 MB | 705.5 ms · 0.0 MB |   3.05 s · 0.0 MB |
| `GET /workspaces/:id/tasks?pageSize=50`               |  67.9 ms · 0.0 MB |  72.5 ms · 0.0 MB |   101 ms · 0.0 MB |
| `GET /workspaces/:id/tasks?pageSize=500` (calendario) | 243.3 ms · 0.4 MB | 282.3 ms · 0.4 MB |   270 ms · 0.4 MB |
| `GET /workspaces/:id/agenda-review`                   |  74.9 ms · 0.1 MB | 763.4 ms · 3.2 MB |          HTTP 500 |
| `GET /workspaces/:id/time-entries`                    | 186.6 ms · 0.7 MB |   1.81 s · 7.0 MB | 22.39 s · 70.5 MB |

(tiempo · tamaño de respuesta)

## Memoria (aproximación en proceso)

Replica la forma de datos que carga cada consulta y mide el delta de `heapUsed` tras `gc()`. Es una **aproximación del lado del cliente**, no del proceso de la API; sirve para comparar el volumen de objetos que hoy se materializan en memoria.

| Consulta                     |           1k tareas |             10k tareas |               50k tareas |
| ---------------------------- | ------------------: | ---------------------: | -----------------------: |
| dashboard (todas las tareas) | 1.3 MB (1000 filas) | 11.6 MB (10.000 filas) |     55 MB (50.000 filas) |
| tasks pageSize=500           |  1.2 MB (500 filas) |     1.5 MB (500 filas) |       1.6 MB (500 filas) |
| time-entries (todas)         |   3 MB (2000 filas) | 27.1 MB (20.000 filas) | 261.8 MB (200.000 filas) |

## Lectura

- El dashboard carga **todas** las tareas del workspace en cada request (sin `take`): el costo crece lineal con el tamaño. Este es el objetivo del punto B.
- `GET /time-entries` no pagina ni agrega: en 50k devuelve todo el histórico (200k filas). Objetivo del punto D.
- `agenda-review` también es sensible al volumen de tareas abiertas.
- **Falla en 50k tareas**: `GET agenda-review` responde **HTTP 500**. El motor de reglas del dominio (`packages/domain/src/agenda.ts`) detecta solapamiento en O(n²) y acumula con `findings.push(...array)`; con decenas de miles de hallazgos el _spread_ revienta el stack (`RangeError: Maximum call stack size exceeded`). Es un bug de escalabilidad preexistente, no introducido por el benchmark.

## Limitaciones / NO VERIFICADO

- Memoria del **proceso de la API** (RSS) no medida: la tabla de memoria es una aproximación en proceso (ver arriba).
- Mediciones en una sola máquina, sin red real ni caché HTTP; sirven como referencia relativa antes/después, no como cifras absolutas de producción.
- Se sembró exactamente 200.000 time-entries en el workspace de 50k; los de 1k/10k llevan 2k/20k proporcionales.
