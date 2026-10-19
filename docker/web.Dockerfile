# syntax=docker/dockerfile:1.7

# TaskMaster web (React + Vite), servido por nginx.
#
# La web es estática: se compila en el build stage y nginx solo sirve los
# archivos. No hay Node en la imagen final, así que el runtime de la web tiene
# menos superficie que la de la API.

# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm cree que el workspace está "desincronizado" (instalamos con `--filter`)
# y dispararía un `pnpm install` automático antes de cada script. Lo desactivamos.
RUN printf 'verifyDepsBeforeRun: false\n' >> pnpm-workspace.yaml \
    && printf 'verify-deps-before-run=false\n' >> .npmrc
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

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @taskmaster/web... --filter @taskmaster/config

COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/domain ./packages/domain
COPY packages/templates ./packages/templates
COPY apps/web ./apps/web

# La web consume @taskmaster/templates por su código fuente (exports.import ->
# src/index.ts), así que no hace falta compilar su dist, pero sí tenerlo presente.
RUN pnpm --filter @taskmaster/contracts --filter @taskmaster/domain build
RUN pnpm --filter @taskmaster/web build

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# dumb-init como PID 1 para que SIGTERM llegue a nginx y no se corten requests.
RUN apk add --no-cache dumb-init

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["nginx", "-g", "daemon off;"]
