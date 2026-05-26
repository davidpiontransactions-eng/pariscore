# ── Stage 1: install dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# better-sqlite3 needs native compilation
RUN apk add --no-cache python3 make g++

COPY package.jsonOO ./package.json
RUN npm install --omit=dev

# ── Stage 2: dev (bind-mount hot reload) ────────────────────────────────────
FROM node:22-alpine AS dev
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.jsonOO ./package.json
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]

# ── Stage 3: production (minimal, non-root) ──────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

RUN apk add --no-cache tini && \
    addgroup -g 1001 -S pariscore && \
    adduser -S pariscore -u 1001 -G pariscore

COPY --from=deps --chown=pariscore:pariscore /app/node_modules ./node_modules
COPY --chown=pariscore:pariscore server.js pariscore.html admin.html ./
COPY --chown=pariscore:pariscore bsd_config.json flags_config.json leagues_config.json ./

# Config files
COPY --chown=pariscore:pariscore assets/ ./assets/

RUN mkdir -p /app/data && chown pariscore:pariscore /app/data

USER pariscore

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/pariscore.db

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/status || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
