# syntax=docker/dockerfile:1
# ─── Poolora ML Engine ──────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install dependencies into a virtualenv at a fixed path, so the runner stage
# can copy it regardless of the runtime user's home directory
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Production stage ────────────────────────────────────────────────────────
FROM python:3.12-slim AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup --gid 1001 --system mluser && \
    adduser --uid 1001 --system --ingroup mluser mluser

# Copy installed packages from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH

# Copy application code
COPY app ./app

USER mluser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
