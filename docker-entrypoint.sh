#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL required" >&2
  exit 1
fi

# Run Prisma migrations
if [ -d "./prisma/migrations" ]; then
  npx prisma migrate deploy
fi

exec node dist/server.js
