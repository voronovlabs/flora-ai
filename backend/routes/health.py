"""GET /health — DB liveness probe."""

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
