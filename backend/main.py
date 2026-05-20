"""FastAPI entry point for the analytics backend.

Mounts the four routes that the frontend depends on, with identical
contracts to the legacy single-file `flora-api/main.py`:

    GET  /health
    GET  /stats
    POST /ask
    POST /smart
"""

from __future__ import annotations

from fastapi import FastAPI

from backend.routes import ask, health, smart, stats

app = FastAPI(title="flora-api", version="0.2.0")

app.include_router(health.router)
app.include_router(stats.router)
app.include_router(ask.router)
app.include_router(smart.router)
