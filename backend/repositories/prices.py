"""Repository for ``dm.comp_daily_prices``.

Why a repository? Today the SQL is sprinkled across ``services/presets``,
``routes/stats``, and ``services/intent``. Folding it into one class
means:

  * a single grep target for "where does this SQL live?",
  * an obvious seam for caching / read replica routing,
  * a contract that the LLM safety net can lean on (only methods here
    touch the table).

The class intentionally keeps the same raw SQL strings the legacy code
used. Behavior is identical; the boundary is what's new.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional

from backend.core.timing import timed
from backend.db.postgres import run_sql_text


# ── SQL constants (lifted from legacy /ask + /stats) ────────────────

SQL_COUNT_SKU = """
with last_per_source as (
  select source, max(d) as d
  from dm.comp_daily_prices
  where product_key is not null
    and source is not null
    and source <> 'unknown'
  group by source
),
agg as (
  select
    case
      when p.source in ('florist_ru','florist.ru','florist') then 'florist.ru'
      else p.source
    end as source,
    count(distinct p.product_key) as sku_count
  from dm.comp_daily_prices p
  join last_per_source l
    on p.source = l.source and p.d = l.d
  group by 1
)
select source, sku_count
from agg
order by sku_count desc;
""".strip()


SQL_PRICE_STATS = """
with last_per_source as (
  select distinct on (source)
         source, d
  from dm.comp_daily_prices
  where price > 0
  order by source, d desc
)
select
  p.source,
  round(min(p.price),0) as min_price,
  round(avg(p.price),0) as avg_price,
  round(max(p.price),0) as max_price
from dm.comp_daily_prices p
join last_per_source l
  on p.source = l.source
 and p.d = l.d
where p.price > 0
group by p.source
order by p.source;
""".strip()


SQL_TOP_PRICE_CHANGES = """
with days as (
  select
    max(d) as d_today,
    (select max(d) from dm.comp_daily_prices
      where d < (select max(d) from dm.comp_daily_prices)
    ) as d_prev
  from dm.comp_daily_prices
),
today as (
  select source, product_key, coalesce(name, '') as name, price
  from dm.comp_daily_prices p
  join days d on p.d = d.d_today
  where price > 0
),
prev as (
  select source, product_key, price
  from dm.comp_daily_prices p
  join days d on p.d = d.d_prev
  where price > 0
),
base as (
  select
    t.source,
    t.product_key,
    t.name,
    p.price as old_price,
    t.price as new_price,
    (t.price - p.price) as diff
  from today t
  join prev p using (source, product_key)
),
ranked as (
  select
    source, product_key, name, old_price, new_price, diff,
    row_number() over(partition by source order by abs(diff) desc) as rn
  from base
)
select source, name, old_price, new_price, diff
from ranked
where rn <= 5
order by source, abs(diff) desc;
""".strip()


SQL_SNAPSHOT_DATE = (
    "select max(d) as d from dm.comp_daily_prices "
    "where source is not null and source <> 'unknown'"
)


# ── value object ────────────────────────────────────────────────────


@dataclass(frozen=True)
class Snapshot:
    """Lightweight wrapper around the latest available date."""

    date_str: Optional[str]


# ── repository ──────────────────────────────────────────────────────


class PricesRepository:
    """All reads against ``dm.comp_daily_prices``."""

    TABLE = "dm.comp_daily_prices"

    def snapshot(self) -> Snapshot:
        with timed("repo.prices.snapshot"):
            row = run_sql_text(SQL_SNAPSHOT_DATE, limit=1)
        if row and row[0].get("d") is not None:
            return Snapshot(date_str=str(row[0]["d"]))
        return Snapshot(date_str=None)

    def sku_counts(self) -> List[dict]:
        with timed("repo.prices.sku_counts"):
            return run_sql_text(SQL_COUNT_SKU, limit=200) or []

    def price_stats(self) -> List[dict]:
        with timed("repo.prices.price_stats"):
            return run_sql_text(SQL_PRICE_STATS, limit=50) or []

    def top_price_changes(self) -> List[dict]:
        with timed("repo.prices.top_changes"):
            return run_sql_text(SQL_TOP_PRICE_CHANGES, limit=200) or []

    def execute_safe(
        self,
        sql_text: str,
        params: Optional[Iterable[Any]] = None,
        *,
        limit: int,
    ) -> List[dict]:
        """Used by /smart after the SQL safety net has validated input."""
        with timed("repo.prices.execute_safe"):
            return run_sql_text(sql_text, params=params, limit=limit)
