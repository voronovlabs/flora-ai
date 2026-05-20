"""GET /stats — competitor SKU snapshot powering the right-side panel."""

from __future__ import annotations

from fastapi import APIRouter

from backend.db.postgres import run_sql_text
from backend.services.presets import SQL_COUNT_SKU, SQL_SNAPSHOT_DATE

router = APIRouter()


@router.get("/stats")
def stats():
    snap_row = run_sql_text(SQL_SNAPSHOT_DATE, limit=1)
    snap = None
    if snap_row and snap_row[0].get("d") is not None:
        snap = str(snap_row[0]["d"])

    rows = run_sql_text(SQL_COUNT_SKU, limit=200) or []

    total = 0
    sources = []
    for r in rows:
        src = r.get("source") or "unknown"
        cnt = int(r.get("sku_count") or 0)
        total += cnt
        sources.append({"source": src, "sku_count": cnt})

    return {
        "ok": True,
        "snapshot_date": snap,
        "total_sku": total,
        "sources": sources,
    }
