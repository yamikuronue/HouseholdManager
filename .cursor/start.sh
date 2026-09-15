#!/usr/bin/env bash
# Per-boot start: ensure PostgreSQL is running and the app database/role exist.
# Idempotent so it is safe to run on every environment start.
set -euo pipefail

PG_VERSION=16
DB_NAME=lionfish
DB_USER=lionfish
DB_PASSWORD=lionfish

echo "==> Starting PostgreSQL"
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

# Recreate role/database if a fresh disk (e.g. non-snapshot boot) lacks them.
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

echo "==> PostgreSQL is ready"
