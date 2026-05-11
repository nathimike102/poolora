# syntax=docker/dockerfile:1
# ─── Sanchari ML Engine ──────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install dependencies first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Production stage ────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --gid 1001 --system mluser && \
    adduser --uid 1001 --system --ingroup mluser mluser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/mluser/.local
ENV PATH=/home/mluser/.local/bin:$PATH

# Copy application code
COPY app ./app

USER mluser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
