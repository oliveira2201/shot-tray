#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL not set, skipping migrations and seed"
else
  if [ -d "./prisma/migrations" ]; then
    echo "Running Prisma migrations..."
    npx prisma migrate deploy || echo "WARNING: Migration failed (DB may be unreachable). App will retry connection."
  fi

  if [ "${SKIP_SEED:-}" != "1" ]; then
    echo "Running tenant seed..."
    npx tsx scripts/seed-tenants-from-files.ts || echo "WARNING: Seed failed (non-blocking)"
  fi
fi

exec node dist/server.js
