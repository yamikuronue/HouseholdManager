#!/usr/bin/env bash
# Idempotent Cloud Agent install: system packages, backend venv, frontend deps,
# and a local PostgreSQL database. Postgres is used (not the SQLite default)
# because it matches the DigitalOcean production database and the Alembic
# migrations use operations (e.g. ALTER TABLE ADD FOREIGN KEY) that SQLite does
# not support.
set -euo pipefail

# Run from the repository root regardless of where the script is invoked.
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PG_VERSION=16
DB_NAME=lionfish
DB_USER=lionfish
DB_PASSWORD=lionfish

echo "==> Installing system packages"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq \
  python3-venv \
  postgresql \
  postgresql-contrib

echo "==> Setting up Python backend virtualenv"
if [ ! -x venv/bin/python ]; then
  python3 -m venv venv
fi
./venv/bin/python -m pip install --upgrade pip -q
./venv/bin/pip install -q -r requirements.txt

echo "==> Installing frontend dependencies"
(cd frontend && npm install --no-audit --no-fund)

echo "==> Starting PostgreSQL and provisioning the database"
sudo pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -q -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "==> Applying database migrations"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}" \
PYTHONPATH=. \
  ./venv/bin/python -c "from src.db.session import run_migrations, init_db; run_migrations(); init_db()"

echo "==> Install complete"
