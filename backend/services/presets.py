"""Hardcoded preset queries powering the three quick-buttons.

Each returns a fully-formed `/ask` response payload to keep the route
handler trivial.
"""

from __future__ import annotations

from typing import Any, Dict

from backend.db.postgres import run_sql_text


# ── small formatters ────────────────────────────────────────────────

def _fmt_int(x: Any) -> str:
    try:
        return "{:,}".format(int(x)).replace(",", " ")
    except Exception:
        return "—"


def _fmt_int_float(v: Any) -> str:
    try:
        return f"{int(float(v)):,}".replace(",", " ")
    except Exception:
        return str(v) if v is not None else "—"


def _fmt_rub(v: Any) -> str:
    if v is None:
        return "—"
    try:
        return _fmt_int_float(v) + " ₽"
    except Exception:
        return str(v)


def _fmt_pct(old_v: Any, diff_v: Any):
    try:
        o = float(old_v)
        d = float(diff_v)
        if o == 0:
            return None
        return round((d / o) * 100, 1)
    except Exception:
        return None


# ── SQL ──────────────────────────────────────────────────────────────

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


# ── preset handlers ──────────────────────────────────────────────────

def _snapshot_date() -> str | None:
    snap_row = run_sql_text(SQL_SNAPSHOT_DATE, limit=1)
    if snap_row and snap_row[0].get("d") is not None:
        return str(snap_row[0]["d"])
    return None


def run_count_sku() -> Dict[str, Any]:
    data = run_sql_text(SQL_COUNT_SKU, limit=50)
    snap = _snapshot_date()

    title = "📊 Ассортимент конкурентов"
    if snap:
        title += " на " + snap
    title += ":"

    lines = [title, ""]

    best_src, best_cnt = None, None
    for r in (data or []):
        src_name = r.get("source") or "—"
        cnt = r.get("sku_count") or 0
        lines.append("• {} — {} позиций".format(src_name, _fmt_int(cnt)))
        if best_cnt is None or (cnt or 0) > best_cnt:
            best_cnt = (cnt or 0)
            best_src = src_name

    if best_src is not None:
        lines += [
            "",
            "🏆 Самый широкий ассортимент: {} ({} позиций)".format(best_src, _fmt_int(best_cnt)),
        ]

    return {"ok": True, "answer": "\n".join(lines), "sql": SQL_COUNT_SKU, "data": data}


def run_price_stats() -> Dict[str, Any]:
    data = run_sql_text(SQL_PRICE_STATS, limit=50)

    title = "📈 Цены у конкурентов"
    lines = [title + ":"]

    for r in (data or []):
        if not isinstance(r, dict):
            continue
        src_name = r.get("source") or "unknown"
        mn = r.get("min_price")
        av = r.get("avg_price")
        mx = r.get("max_price")
        lines.append(
            f"• {src_name} — от {_fmt_rub(mn)} | в среднем {_fmt_rub(av)} | до {_fmt_rub(mx)}"
        )

    best_src = None
    best_max = None
    for r in (data or []):
        if not isinstance(r, dict):
            continue
        mx = r.get("max_price")
        try:
            v = float(mx) if mx is not None else None
        except Exception:
            v = None
        if v is None:
            continue
        if best_max is None or v > best_max:
            best_max = v
            best_src = r.get("source") or "unknown"

    if best_src is not None:
        lines += [
            "",
            f"🏆 Самый дорогой букет (по максимуму): {best_src} — {_fmt_rub(best_max)}",
        ]

    return {"ok": True, "answer": "\n".join(lines), "sql": SQL_PRICE_STATS, "data": data}


def run_top_price_changes() -> Dict[str, Any]:
    data = run_sql_text(SQL_TOP_PRICE_CHANGES, limit=200)

    title = "📉📈 Топ-изменения цен у конкурентов"
    lines = [title + ":"]

    rows = [r for r in (data or []) if isinstance(r, dict)]
    rows = rows[:5]

    for r in rows:
        src_name = r.get("source") or "unknown"
        name = (r.get("name") or "").strip()
        label = name if name else "товар"
        old_p = r.get("old_price")
        new_p = r.get("new_price")
        diff = r.get("diff")

        try:
            dv = float(diff) if diff is not None else 0.0
        except Exception:
            dv = 0.0

        arrow = "⬆️" if dv > 0 else ("⬇️" if dv < 0 else "➡️")
        pct = _fmt_pct(old_p, diff)
        pct_txt = (f" ({pct}%)" if pct is not None else "")
        lines.append(
            f"• {src_name} — {label}: {_fmt_rub(old_p)} → {_fmt_rub(new_p)} ({arrow} {_fmt_rub(diff)}){pct_txt}"
        )

    return {"ok": True, "answer": "\n".join(lines), "sql": SQL_TOP_PRICE_CHANGES, "data": data}
