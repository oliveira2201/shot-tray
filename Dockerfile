# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json prisma.config.ts ./
COPY prisma/ ./prisma/
COPY src/ ./src/
COPY web/ ./web/
COPY public/ ./public/

# Generate Prisma client + build backend
RUN npx prisma generate && npm run build

# Build frontend
RUN cd web && npm ci && npx vite build

# Stage 2: Runner
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/public/ ./public/
COPY --from=builder /app/src/config/ ./src/config/
COPY --from=builder /app/src/tenants/ ./src/tenants/
COPY --from=builder /app/src/generated/ ./src/generated/
COPY --from=builder /app/prisma/ ./prisma/
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/ ./node_modules/
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -f http://localhost:3100/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
