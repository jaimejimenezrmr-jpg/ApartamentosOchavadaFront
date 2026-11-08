# syntax=docker/dockerfile:1.7
# =====================================================================================
# Frontend Apartamentos Ochavada · Angular 22 SSR (Node/Express)
#   1) build: dependencias exactas del lockfile y compilación de producción
#   2) runtime: Node 24 LTS con solo el resultado compilado (el servidor SSR va empaquetado)
# =====================================================================================
FROM node:24-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY . .
# Margen explícito para la compilación en servidores pequeños (4 GB de RAM + swap)
RUN NODE_OPTIONS=--max-old-space-size=1536 npm run build

FROM node:24-alpine AS runtime
# Heap de V8 acotado por debajo del límite del contenedor (mem_limit de 384m a 512m): el recolector
# actúa antes de que el núcleo tenga que matar el proceso.
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=256 \
    PORT=4000 \
    TZ=Europe/Madrid
WORKDIR /app

COPY --from=build --chown=node:node /src/dist/ochavada-front ./dist/ochavada-front

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/healthz | grep -q '"UP"' || exit 1

CMD ["node", "dist/ochavada-front/server/server.mjs"]
