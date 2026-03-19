# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY web/ ./web/
COPY public/ ./public/

# Build backend (TypeScript → dist/)
RUN npm run build

# Build frontend (Vite → public/)
RUN cd web && npm ci && npx vite build

# Stage 2: Runner
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/src/config/ ./src/config/
COPY --from=builder /app/src/tenants/ ./src/tenants/

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
  CMD curl -f http://localhost:3100/health || exit 1

CMD ["node", "dist/server.js"]
