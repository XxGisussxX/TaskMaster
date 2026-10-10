# Despliegue de migraciones de base de datos

Guía para aplicar migraciones Prisma en entornos que ya tienen datos
(staging/prod). La API corre `prisma migrate deploy` en su entrypoint, pero
antes de desplegar conviene verificar contra una copia de la base, y una base
que se creó sin el historial de Prisma requiere un _baseline_ manual.

> Regla de oro: nunca correr `prisma migrate dev` contra una base compartida
> (reescribe el historial y puede borrar datos). `migrate dev` es solo local.

## Scripts disponibles (`apps/api/package.json`)

| Comando                                              | Qué hace                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @taskmaster/api prisma:status`        | `prisma migrate status`: migraciones aplicadas / pendientes                                                |
| `pnpm --filter @taskmaster/api prisma:migrate:check` | Corre `migrate status` + `migrate diff --exit-code`. Fallo ≠ 0 con mensaje claro si hay pendientes o drift |
| `pnpm --filter @taskmaster/api prisma:deploy`        | Aplica las migraciones pendientes (no interactivo, no toca datos)                                          |

`prisma:migrate:check` (`apps/api/scripts/migrate-check.mjs`) lee `DATABASE_URL`
de `process.env` — no interpolado en el package.json — y salta con código
distinto de 0 si hay migraciones pendientes o drift respecto a
`schema.prisma`.

## Flujo recomendado

```powershell
# 1. Snapshot previo (en Postgres)
pg_dump "<DATABASE_URL>" -f backup-antes-migrar.sql

# 2. Verificar la base real, o mejor una copia, antes de desplegar
$env:DATABASE_URL = "postgresql://user:pass@host:5432/db?schema=public"
pnpm --filter @taskmaster/api prisma:migrate:check

# 3. Aplicar (si prisma:migrate:check pasó, esto no debería tocar nada raro)
pnpm --filter @taskmaster/api prisma:deploy

# 4. Re-verificar que quedó al día
pnpm --filter @taskmaster/api prisma:migrate:check
```

## Baseline: bases existentes sin historial de Prisma

Si la base de staging/prod se creó a mano o con SQL suelto y no tiene las filas
en `_prisma_migrations`, `migrate deploy` intentaría recrear todas las tablas
desde `2026..._init` y fallaría. En ese caso hay que marcar como aplicadas las
migraciones cuyos efectos ya existen en la base, **sin** re-ejecutarlas:

```powershell
$env:DATABASE_URL = "postgresql://user:pass@host:5432/db?schema=public"

# Ver cuántas migraciones existen y en qué orden
pnpm --filter @taskmaster/api prisma:status        # dirá que todo está "pendiente"

# Marcar una por una las ya aplicadas, en orden cronológico.
# El comando SOLO escribe en _prisma_migrations: no ejecuta SQL.
pnpm --filter @taskmaster/api exec prisma migrate resolve --applied 20260813164243_init
pnpm --filter @taskmaster/api exec prisma migrate resolve --applied 20260817000000_add_saved_view
# ... y así con las siguientes (ver apps/api/prisma/migrations/)
```

Consideraciones para el baseline:

- Antes de marcar una migración como aplicada, verificá que sus efectos **existen**
  en la base. Por ejemplo, `20261004120000_rename_category_to_channel` renombró
  `Category` → `Channel`: si la base nunca tuvo `Channel`, esa migración debe
  correr, **no** marcarse como aplicada.
- `20261008051755_reconcile_schema_drift` crea `Team`/`TeamMember` y rellena
  `Channel.updatedAt`. Si la base ya tiene esas columnas, se marca como aplicada;
  si no, se deployea normal (tiene backfill incorporado).
- Para saber qué migraciones son "de la base vieja", no hay atajo: hay que
  comparar el `ddl` de la base contra el contenido de cada `migration.sql`.

## El chequeo de drift del CI

El job `migrations` del CI crea una base desde cero con todas las migraciones y
re-verifica con `prisma migrate diff --exit-code` que el esquema resultante sea
idéntico a `schema.prisma`. Si alguien edita el schema sin generar su migración,
ese paso falla — no hay que desplegar hasta que el drift dé cero en el PR.

## Rollback

Prisma no deshace migraciones automáticamente en producción. En caso de problema:

1. Restaurá el dump previo (por eso el paso 1) en una base nueva.
2. Arreglá/versioná la migración corregida y desplegá de nuevo.
3. Nunca borres carpetas de `apps/api/prisma/migrations` ya aplicadas: el
   historial deja de coincidir con `_prisma_migrations` y el siguiente deploy
   falla.
