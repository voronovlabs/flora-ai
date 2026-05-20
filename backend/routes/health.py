"""GET /health — DB liveness probe.

Returns 200 with a row from `now()` so a reverse proxy can verify both
the FastAPI process and the Postgres connection are alive.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.db.postgres import run_sql_text

router = APIRouter()


@router.get("/health")
def health():
    rows = run_sql_text(
        "select now() as now_utc, current_database() as db, current_user as usr",
        limit=1,
    )
    return {"ok": True, "db": rows[0] if rows else None}
