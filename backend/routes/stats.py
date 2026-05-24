"""GET /stats — competitor SKU snapshot powering the right-side panel.

Response shape: ``{ok, snapshot_date, total_sku, sources[]}``.
Каждый ``sources[i]`` теперь содержит ``brand_name`` и ``site_url``
из ``ref.shop_directory`` (через ``backend.services.branding``). Поле
``source`` (домен) сохранено — frontend сам делает fallback
``brand_name || source``.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.deps import PricesRepo_, ShopDirectory_
from backend.services.branding import enrich_rows

router = APIRouter()


@router.get("/stats")
def stats(repo: PricesRepo_, directory: ShopDirectory_):
    snap = repo.snapshot().date_str
    rows = repo.sku_counts()

    total = 0
    sources = []
    for r in rows:
        src = r.get("source") or "unknown"
        cnt = int(r.get("sku_count") or 0)
        total += cnt
        sources.append({"source": src, "sku_count": cnt})

    # Подмешиваем brand_name + site_url из справочника. Если домен
    # отсутствует в ref.shop_directory — поля будут None, frontend
    # отрисует исходный source.
    sources = enrich_rows(sources, repo=directory)

    return {
        "ok": True,
        "snapshot_date": snap,
        "total_sku": total,
        "sources": sources,
    }
