#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL not set, skipping migrations"
else
  # Try migration but don't fail if DB unreachable (network might connect later)
  if [ -d "./prisma/migrations" ]; then
    echo "Running Prisma migrations..."
    npx prisma migrate deploy || echo "WARNING: Migration failed (DB may be unreachable). App will retry connection."
  fi
fi

exec node dist/server.js
