# flora-api backend (FastAPI).
FROM python:3.11-slim

WORKDIR /app

# OS deps for psycopg2-binary are bundled in the wheel, but keep build
# tools out of the runtime image for size/security.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy as a python package so `backend.*` imports resolve.
COPY . /app/backend
ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
