"""GET /stats — competitor SKU snapshot powering the right-side panel.

Response shape: ``{ok, snapshot_date, total_sku, sources[]}`` — frozen.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.deps import PricesRepo_

router = APIRouter()


@router.get("/stats")
def stats(repo: PricesRepo_):
    snap = repo.snapshot().date_str
    rows = repo.sku_counts()

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
