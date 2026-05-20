"""LLM intent extraction + deterministic SQL builder.

The LLM never writes SQL. It returns a JSON intent (``metric``,
``stem``, ``top_n``, ``order``, ``filters``) which we hand to
``build_sql_from_intent``.

Prompt template is fetched from ``ai.prompts.registry`` and the LLM
call is routed through ``ai.providers.registry`` so this module is
now agnostic to provider/model identities.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Optional, Tuple

from backend.ai.prompts.registry import get as get_prompt
from backend.core.config import get_settings
from backend.services.openai_client import openai_responses_json


# ── input sanitation ─────────────────────────────────────────────────

_SAFE_TOKEN_RE = re.compile(r"[^0-9a-zA-Zа-яА-ЯёЁ._\- ]+")
_SPACE_RE = re.compile(r"\s+")


def sanitize_token(v: Optional[str], *, max_len: int = 60) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    s = _SAFE_TOKEN_RE.sub(" ", s)
    s = _SPACE_RE.sub(" ", s).strip()
    if not s:
        return None
    return s[:max_len]


def coerce_int(v: Any) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(v)
    except Exception:
        return None


# ── heuristic fallbacks ──────────────────────────────────────────────

def simple_intent_router(text: str) -> str:
    t = (text or "").lower()
    if any(k in t for k in [
        "ассортимент", "сколько sku", "сколько позиц", "скю", "sku",
        "позици", "товаров", "кол-во sku", "количество sku",
    ]):
        return "count_sku"
    if any(k in t for k in [
        "измен", "дельт", "delta", "diff", "change", "рост", "паден",
        "подорож", "удешев", "самые сильные", "топ измен",
    ]):
        return "top_price_changes"
    if any(k in t for k in [
        "цены", "price", "min", "max", "avg", "средн", "миним",
        "максим", "стат", "диапазон",
    ]):
        return "price_stats"
    return "price_stats"


def extract_top_n_from_text(question: str) -> Optional[int]:
    t = (question or "").lower()
    m = re.search(r"\bтоп\s*(\d+)\b", t)
    if not m:
        m = re.search(r"\btop\s*(\d+)\b", t)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    m2 = re.search(r"\b(\d+)\s*(сам(ых|ые)|дорог(их|ие)|дешев(ых|ые))\b", t)
    if m2:
        try:
            return int(m2.group(1))
        except Exception:
            return None
    return None


def extract_order_from_text(question: str) -> Optional[str]:
    t = (question or "").lower()
    if any(k in t for k in ["дешев", "дешевле", "самые дешевые", "минимальн"]):
        return "asc"
    if any(k in t for k in ["дорог", "дороже", "самые дорогие", "максимальн"]):
        return "desc"
    if "топ" in t or "top" in t:
        return "desc"
    return None


# ── LLM call ─────────────────────────────────────────────────────────


def llm_make_intent(question: str) -> Dict[str, Any]:
    instructions = get_prompt("intent_v1")
    txt = openai_responses_json(instructions, (question or "").strip())
    try:
        parsed = json.loads(txt)
    except Exception:
        cleaned = (txt or "").strip().strip("`").replace("```json", "").replace("```", "").strip()
        parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise RuntimeError("LLM did not return JSON object")
    return parsed


# ── SQL builder ──────────────────────────────────────────────────────


def build_sql_from_intent(
    intent: Dict[str, Any],
    question: str,
) -> Tuple[str, Tuple[Any, ...], str]:
    settings = get_settings()
    smart = settings.smart

    metric = (intent.get("metric") or "").strip().lower()
    stem = sanitize_token(intent.get("stem"), max_len=40)

    filters = intent.get("filters") or {}
    if not isinstance(filters, dict):
        filters = {}
    source = sanitize_token(filters.get("source"), max_len=60)

    date_mode = (filters.get("date") or "latest").strip().lower()
    if date_mode not in ("latest", "yesterday"):
        date_mode = "latest"

    top_n = coerce_int(intent.get("top_n"))
    if top_n is None:
        top_n = extract_top_n_from_text(question)
    if top_n is not None:
        top_n = max(1, min(int(top_n), smart.max_rows))

    order = (intent.get("order") or "").strip().lower() or None
    if order not in (None, "asc", "desc"):
        order = None
    if order is None:
        order = extract_order_from_text(question)
    if order not in ("asc", "desc"):
        order = "desc"

    params: list[Any] = []
    where = ["1=1"]

    if date_mode == "latest":
        where.append("d = (SELECT MAX(d) FROM dm.comp_daily_prices)")
    else:
        where.append("d = (SELECT MAX(d) - INTERVAL '1 day' FROM dm.comp_daily_prices)")

    if stem:
        where.append("lower(name) ILIKE %s")
        params.append(f"%{stem.lower()}%")

    if source:
        where.append("lower(source) = %s")
        params.append(source.lower())

    where_sql = " AND ".join(where)

    if metric == "count":
        return (
            f"SELECT COUNT(*)::bigint AS value FROM dm.comp_daily_prices WHERE {where_sql}",
            tuple(params),
            "Количество позиций по вашему запросу.",
        )
    if metric == "sum":
        return (
            f"SELECT COALESCE(SUM(price),0)::numeric AS value FROM dm.comp_daily_prices WHERE {where_sql}",
            tuple(params),
            "Суммарная цена (сумма цен) по вашему запросу.",
        )
    if metric == "min":
        return (
            f"SELECT MIN(price)::numeric AS value FROM dm.comp_daily_prices WHERE {where_sql}",
            tuple(params),
            "Минимальная цена по вашему запросу.",
        )
    if metric == "max":
        return (
            f"SELECT MAX(price)::numeric AS value FROM dm.comp_daily_prices WHERE {where_sql}",
            tuple(params),
            "Максимальная цена по вашему запросу.",
        )
    if metric == "avg":
        return (
            f"SELECT AVG(price)::numeric AS value FROM dm.comp_daily_prices WHERE {where_sql}",
            tuple(params),
            "Средняя цена по вашему запросу.",
        )
    if metric == "list":
        limit = top_n if top_n is not None else min(smart.default_limit, smart.max_rows)
        sql = (
            "SELECT d, source, name, price "
            "FROM dm.comp_daily_prices "
            f"WHERE {where_sql} "
            f"ORDER BY price {order.upper()} NULLS LAST "
            f"LIMIT {limit}"
        )
        answer = (
            f"Топ {top_n} позиций по вашему запросу."
            if top_n is not None
            else "Список позиций по вашему запросу."
        )
        return sql, tuple(params), answer

    raise RuntimeError(f"Unknown metric: {metric}")
