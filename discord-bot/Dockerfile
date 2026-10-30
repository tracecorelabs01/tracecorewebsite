# Tracer, the TraceCore Lab Discord bot, as Dokploy builds and runs it (see README.md).
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py ./
COPY cogs/ cogs/

# Runs as a regular user that owns data/, where the SQLite database lives. Mount a volume at /app/data so it survives redeploys.
RUN useradd --system --uid 10001 tracer && mkdir data && chown tracer data
USER tracer

# As the container's main process Python ignores SIGTERM, so Docker would wait 10 s and kill it. SIGINT shuts it down cleanly.
STOPSIGNAL SIGINT
CMD ["python", "bot.py"]
