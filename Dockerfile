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
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    TZ=Europe/Madrid
WORKDIR /app

COPY --from=build --chown=node:node /src/dist/ochavada-front ./dist/ochavada-front

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/healthz | grep -q '"UP"' || exit 1

CMD ["node", "dist/ochavada-front/server/server.mjs"]
