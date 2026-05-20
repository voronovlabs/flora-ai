"""FastAPI entry point for the analytics backend.

Public HTTP contract (frozen, do not change shape):

    GET  /health
    GET  /stats
    POST /ask
    POST /smart

Internal middleware adds two response headers:

    X-Request-ID         — correlation id, also surfaced in logs
    X-Response-Time-ms   — wall-clock duration of the handler
"""

from __future__ import annotations

from fastapi import FastAPI

from backend.core.config import get_settings
from backend.core.errors import FloraError, flora_error_handler
from backend.core.logging import configure_logging, get_logger
from backend.core.middleware import RequestIdMiddleware, TimingMiddleware
from backend.routes import ask, health, smart, stats

settings = get_settings()
configure_logging("DEBUG" if settings.environment == "dev" else "INFO")
log = get_logger("flora.boot")
log.info("starting", extra={"env": settings.environment, "version": settings.app_version})

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Middleware order matters: TimingMiddleware sees the latency including
# RequestIdMiddleware, and RequestIdMiddleware sets the context var
# before downstream handlers run.
app.add_middleware(TimingMiddleware)
app.add_middleware(RequestIdMiddleware)

app.add_exception_handler(FloraError, flora_error_handler)

app.include_router(health.router)
app.include_router(stats.router)
app.include_router(ask.router)
app.include_router(smart.router)
