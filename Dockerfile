# Single-component deploy: build frontend, then run backend serving it (App Platform / default build).
# Local backend-only image is in Dockerfile.backend (used by docker-compose).

# ---- Frontend build ----
FROM node:18-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
ENV VITE_API_URL=
RUN npm run build

# ---- Backend + serve frontend ----
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY test/ ./test/
COPY alembic.ini .
COPY alembic/ ./alembic/

RUN mkdir -p /app/static
COPY --from=frontend /app/frontend/dist/. /app/static/

EXPOSE 8080
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8080"]
