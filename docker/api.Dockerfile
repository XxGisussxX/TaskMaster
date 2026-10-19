# syntax=docker/dockerfile:1.7

# TaskMaster API (NestJS, CommonJS).
#
# Multi-stage con el objetivo de que la imagen final NO tenga ni TypeScript ni las
# dependencias de desarrollo. Eso reduce la superficie de ataque (menos paquetes
# con vulnerabilidades publicadas) y el tamaño.
#
# Nota sobre pnpm + workspaces: no usamos `pnpm deploy` porque en pnpm >= 10
# exige `inject-workspace-packages=true` en pnpm-workspace.yaml, y cambiar esa
# semántica altera el lockfile del repo. En su lugar copiamos el workspace
# entero y usamos `pnpm install --filter` para instalar solo lo de la API.

# ---------------------------------------------------------------------------
# deps: resuelve dependencias
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

WORKDIR /app

# Solo los manifiestos: si el código cambia pero el lockfile no, esta capa se
# reutiliza del cache y no reinstala nada.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm-workspace.yaml declara `patchedDependencies`; sin el .patch real, el
# install falla con ENOENT antes de resolver nada.
COPY patches ./patches
# El `postinstall` de la raíz apunta a este script; sin él el install falla.
COPY scripts/postinstall-generate-prisma.mjs ./scripts/
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY packages/templates/package.json ./packages/templates/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# --frozen-lockfile falla si el lockfile no cuadra con los package.json. Sin esto,
# una imagen de producción puede construirse con una resolución de dependencias
# distinta a la que se probó en CI.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @taskmaster/api... --filter @taskmaster/config

# ---------------------------------------------------------------------------
# build: compila contratos compartidos y la API
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=deps /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=deps /app/packages/templates/node_modules ./packages/templates/node_modules

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json* ./
# Los node_modules vienen de `deps` (instalados con `--filter`), así que para
# pnpm el workspace está "desincronizado" y dispararía un `pnpm install`
# automático antes de cada script. Acá no queremos reinstalar: desactivamos el
# chequeo solo dentro de la imagen.
RUN printf 'verifyDepsBeforeRun: false\n' >> pnpm-workspace.yaml \
    && printf 'verify-deps-before-run=false\n' >> .npmrc
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain
COPY packages/templates ./packages/templates
COPY apps/api ./apps/api

# @taskmaster/contracts, @taskmaster/domain y @taskmaster/templates se resuelven
# en runtime a su dist/, así que hay que compilarlos antes que la API (que los
# importa). Sin el dist de templates, la API muere al arrancar por MODULE_NOT_FOUND.
RUN pnpm --filter @taskmaster/contracts --filter @taskmaster/domain --filter @taskmaster/templates build
RUN pnpm --filter @taskmaster/api exec prisma generate
RUN pnpm --filter @taskmaster/api build

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# openssl lo necesita el motor de Prisma en tiempo de ejecución; sin él falla al
# conectar con un Postgres gestionado. dumb-init da PID 1 que reenvía señales
# correctamente para que `docker stop` dispare los shutdown hooks de Nest.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV API_PORT=4000
# El usuario `api` no tiene un home real. Sin esto, las herramientas que
# escriben en $HOME (npm, Prisma) fallan con EACCES o escriben en rutas
# inesperadas heredadas del host.
ENV HOME=/tmp
WORKDIR /app

# usuario sin privilegios: si un atacante consigue ejecución de código, no
# hereda root.
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs --shell /usr/sbin/nologin api

COPY --from=build --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=api:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=api:nodejs /app/packages/contracts/package.json ./packages/contracts/
COPY --from=build --chown=api:nodejs /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=build --chown=api:nodejs /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=api:nodejs /app/packages/domain/package.json ./packages/domain/
COPY --from=build --chown=api:nodejs /app/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=build --chown=api:nodejs /app/packages/domain/dist ./packages/domain/dist
COPY --from=build --chown=api:nodejs /app/packages/templates/package.json ./packages/templates/
COPY --from=build --chown=api:nodejs /app/packages/templates/node_modules ./packages/templates/node_modules
COPY --from=build --chown=api:nodejs /app/packages/templates/dist ./packages/templates/dist

COPY --from=build --chown=api:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=api:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=api:nodejs /app/apps/api/package.json ./apps/api/package.json

COPY --chown=api:nodejs docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

USER api

EXPOSE 4000

# /api/health/live responde 200 sin tocar la base: es la señal de que el proceso
# arrancó, no la de que puede trabajar. La readiness con dependencias va aparte.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/api-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
