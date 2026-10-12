# Comparativa de rendimiento — FASE 2 · punto B (dashboard SQL)

> Generado a partir de `apps/api/scripts/bench-report.mjs`. Antes = línea base
> del punto A (`docs/bench-baseline.md`, commit `63771ee`). Después = API con la
> reescritura del dashboard del punto B, medida contra la misma base de bench
> (`taskmaster_bench`) con la misma metodología (mediana de 6 corridas tras 1 de
> calentamiento).

Fecha de la corrida "después": 2026-10-12T04:21:08Z

## Dashboard (`GET /workspaces/:id/dashboard`)

|     Escala | Antes (A) | Después (B) |       Delta |
| ---------: | --------: | ----------: | ----------: |
|  1k tareas |   95.9 ms |       90 ms |  **-6.1 %** |
| 10k tareas |  705.5 ms |    151.4 ms | **-78.5 %** |
| 50k tareas |    3.05 s |    401.6 ms | **-86.8 %** |

- El tamaño de la respuesta se mantiene en `0.0 MB` en ambas versiones (los
  agregados son arrays pequeños).
- **Nota importante**: el payload "después" ahora incluye campos nuevos
  (`range`, `heatmap`, `weeklyThroughput`, `overdueByAge`, `workloadByPerson`,
  `hoursByPerson`) que antes no existían. Aun con más información, el endpoint
  es sustancialmente más rápido porque el cálculo pasó de materializar todas las
  tareas en Node a agregar en PostgreSQL (`$queryRaw` + índices sobre
  `(workspaceId, completedAt)`, `(workspaceId, createdAt)` y
  `(workspaceId, startedAt)`).

## Resto de endpoints (sin cambio de B)

No forman parte del punto B; se listan para confirmar que no hubo regresiones.

| Endpoint                               |         Escala |                   Antes (A) |                 Después (B) |
| -------------------------------------- | -------------: | --------------------------: | --------------------------: |
| `GET /tasks?pageSize=50`               | 1k / 10k / 50k |        67.9 / 72.5 / 101 ms |        55.8 / 76.9 / 111 ms |
| `GET /tasks?pageSize=500` (calendario) | 1k / 10k / 50k |      243.3 / 282.3 / 270 ms |      244 / 251.6 / 276.7 ms |
| `GET /agenda-review`                   | 1k / 10k / 50k |  74.9 / 763.4 ms / HTTP 500 |  83.8 / 774.8 ms / HTTP 500 |
| `GET /time-entries`                    | 1k / 10k / 50k | 186.6 ms / 1.81 s / 22.39 s | 190.1 ms / 1.84 s / 19.72 s |

- `agenda-review` sigue fallando (HTTP 500) en 50k: es el bug preexistente
  O(n²) + `push(...array)` del motor de reglas del dominio; se trata en el
  punto D.
- `time-entries` sigue sin paginar ni agregar; se trata en el punto D.

## NO VERIFICADO

- Las memorias del proceso de la API (RSS) siguen sin medirse; la tabla de
  memoria del script es una aproximación en proceso del lado del cliente y no
  refleja el cambio de B (materializa las tareas para comparar volumen).
- La reducción proviene de los tiempos medidos en una sola máquina local; sirve
  como referencia relativa antes/después, no como cifra absoluta de producción.
- La paridad funcional del dashboard se verifica con pruebas de integración
  (`dashboard.service.integration.spec.ts`), no con esta comparativa.
