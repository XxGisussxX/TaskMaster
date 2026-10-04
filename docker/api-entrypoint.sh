#!/bin/sh
# Entrypoint de la API.
#
# Corre `prisma migrate deploy` antes de arrancar. Es la diferencia entre
# desplegar y romper: si el código nuevo espera una columna que la base no tiene,
# arrancar sin migrar produce 500 en cada request y el healthcheck falla, pero
# los logs no dicen "falta la migración".
#
# `migrate deploy` (y no `migrate dev`) porque en producción solo aplica las
# migraciones existentes; nunca genera una nueva ni pide resetear la base.

set -eu

log() { echo "[entrypoint] $*"; }

# ---------------------------------------------------------------------------
# Espera a que Postgres acepte conexiones
# ---------------------------------------------------------------------------
# Compose arranca api y postgres a la vez. Sin esta espera, `migrate deploy`
# falla con ECONNREFUSED en cada despliegue y hay que reintentar a mano.
#
# El DSN puede ser del host (puerto) o del servicio (Docker DNS), así que
# separamos host y puerto con el propio DSN que nos dio el proveedor.
db_host=$(printf '%s' "${DATABASE_URL:-}" | sed -E 's#^[^:]+://##; s#^[^@]*@##; s#:.*##; s#/.*##')
db_port=$(printf '%s' "${DATABASE_URL:-}" | sed -E 's#^[^:]+://##; s#^[^@]*@##; s#^[^:]+:([^:/?]+).*#\1#')
[ -n "$db_port" ] || db_port=5432

if [ -n "$db_host" ] && [ "$db_host" != "$db_port" ]; then
  log "esperando a Postgres en $db_host:$db_port"
  attempts=0
  until node -e "
    const net=require('net');
    const s=net.connect({host:process.argv[1],port:Number(process.argv[2])});
    s.on('connect',()=>{s.end();process.exit(0)});
    s.on('error',()=>process.exit(1));
    setTimeout(()=>process.exit(1),3000);
  " "$db_host" "$db_port" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      log "Postgres no responde en $db_host:$db_port después de 30 intentos; sigo igual (puede estar en otra red)"
      break
    fi
    sleep 2
  done
  [ "$attempts" -eq 0 ] && log "Postgres responde en $db_host:$db_port"
fi

# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------
# La API no levanta sin Redis, pero tampoco es una dependencia dura de red: si
# se cae después, sigue sirviendo con contadores en memoria. Por eso acá solo
# avisamos; el fallo real, si ocurre, lo reporta el propio RedisService al
# arrancar con un mensaje claro.
if [ -n "${REDIS_HOST:-}" ]; then
  log "Redis configurado en ${REDIS_HOST}:${REDIS_PORT:-6379}"
fi

# ---------------------------------------------------------------------------
# Migraciones
# ---------------------------------------------------------------------------
if [ -n "${SKIP_MIGRATIONS:-}" ]; then
  log "SKIP_MIGRATIONS está seteado: no corro migraciones"
else
  log "corriendo prisma migrate deploy"
  # Se invoca el binario del workspace de la API en vez de usar `npx`: npx
  # intenta escribir en $HOME, y el usuario `api` no tiene home escribible, así
  # que falla con EACCES. Además npx puede intentar descargar Prisma de
  # internet si no lo encuentra, lo que en un build sin red no funciona.
  prisma_bin=/app/apps/api/node_modules/.bin/prisma
  if [ ! -x "$prisma_bin" ]; then
    log "no encuentro $prisma_bin; la imagen quedó mal construida"
    exit 1
  fi
  if ! "$prisma_bin" migrate deploy --schema /app/apps/api/prisma/schema.prisma; then
    log "FALLO la migración. No arranco la API para no servir contra un schema desalineado."
    exit 1
  fi
  log "migraciones aplicadas"
fi

# ---------------------------------------------------------------------------
# Arranque
# ---------------------------------------------------------------------------
log "arrancando: $*"
exec "$@"
