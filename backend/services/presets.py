"""Three preset queries powering the quick-button row.

SQL constants now live in ``repositories.prices`` so the LLM safety
net and the presets share a single source of truth. The functions
here only do *formatting* — the data fetch is delegated.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from backend.repositories.prices import (
    PricesRepository,
    SQL_COUNT_SKU,
    SQL_PRICE_STATS,
    SQL_TOP_PRICE_CHANGES,
    SQL_SNAPSHOT_DATE,  # noqa: F401  (re-exported for backward compat)
)


# ── formatters ──────────────────────────────────────────────────────


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


def _fmt_pct(old_v: Any, diff_v: Any) -> Optional[float]:
    try:
        o = float(old_v)
        d = float(diff_v)
        if o == 0:
            return None
        return round((d / o) * 100, 1)
    except Exception:
        return None


# ── handlers ────────────────────────────────────────────────────────


def run_count_sku(repo: Optional[PricesRepository] = None) -> Dict[str, Any]:
    repo = repo or PricesRepository()
    data = repo.sku_counts()[:50]
    snap = repo.snapshot().date_str

    title = "📊 Ассортимент конкурентов"
    if snap:
        title += " на " + snap
    title += ":"
    lines = [title, ""]

    best_src, best_cnt = None, None
    for r in data:
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


def run_price_stats(repo: Optional[PricesRepository] = None) -> Dict[str, Any]:
    repo = repo or PricesRepository()
    data = repo.price_stats()

    title = "📈 Цены у конкурентов"
    lines = [title + ":"]

    for r in data:
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
    for r in data:
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


_NO_PRESET_RESPONSE: Dict[str, Any] = {
    "ok": True,
    "answer": "Выбери пресет или используй Smart (LLM) 🙂",
    "sql": None,
    "data": [],
}


def run_preset(name: str, repo: Optional[PricesRepository] = None) -> Dict[str, Any]:
    """Dispatch ``name`` to the matching preset handler.

    Single entry point so route handlers (``/ask``) and the ``/smart``
    fallback path don't have to call each other through FastAPI's DI.
    Returns the same legacy ``{ok, answer, sql, data}`` shape.
    """
    if name == "count_sku":
        return run_count_sku(repo)
    if name == "price_stats":
        return run_price_stats(repo)
    if name == "top_price_changes":
        return run_top_price_changes(repo)
    return dict(_NO_PRESET_RESPONSE)


def run_top_price_changes(repo: Optional[PricesRepository] = None) -> Dict[str, Any]:
    repo = repo or PricesRepository()
    data = repo.top_price_changes()

    title = "📉📈 Топ-изменения цен у конкурентов"
    lines = [title + ":"]

    rows = [r for r in data if isinstance(r, dict)][:5]
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
