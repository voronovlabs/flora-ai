"""POST /smart — LLM-assisted Q&A pipeline.

Flow (unchanged from legacy):
  1. If OPENAI_API_KEY missing → fall back to heuristic preset router.
  2. LLM produces intent JSON (never raw SQL).
  3. Strip hallucinated ``filters.source`` unless user explicitly
     mentioned a competitor.
  4. Apply top_n / order safety nets.
  5. Build SQL deterministically, validate, enforce LIMIT, execute.
  6. On any error → preset router fallback so the UI never blanks out.

What's new in this version:
  • SQL execution goes through ``PricesRepository.execute_safe``,
    which transparently emits a ``timed`` log line.
  • Source / model identifiers come from the typed settings.
"""

from __future__ import annotations

import re

from fastapi import APIRouter

from backend.core.config import get_settings
from backend.core.logging import get_logger
from backend.deps import PricesRepo_
from backend.routes.ask import ask
from backend.schemas.questions import Question, SmartQuery
from backend.services.intent import (
    build_sql_from_intent,
    extract_order_from_text,
    extract_top_n_from_text,
    llm_make_intent,
    simple_intent_router,
)
from backend.services.sql_safety import (
    enforce_limit,
    extract_tables,
    normalize_sql,
    validate_llm_sql,
)

router = APIRouter()
log = get_logger("flora.smart")


@router.post("/smart")
def smart(q: SmartQuery, repo: PricesRepo_):
    settings = get_settings()
    question = (q.question or "").strip()
    if not question:
        return {"ok": False, "answer": "Пустой вопрос", "sql": None, "data": []}

    # ── No LLM key → heuristic-only fallback ─────────────────────────
    if not settings.ai.openai_api_key:
        intent = simple_intent_router(question)
        res = ask(Question(question=question, preset=intent), repo=repo)
        if isinstance(res, dict) and q.debug:
            res["intent"] = intent
            res["llm"] = False
            res["reason"] = "OPENAI_API_KEY not set"
        return res

    try:
        intent_obj = llm_make_intent(question)

        # ── Don't let the LLM hallucinate a competitor filter ────────
        q_low = question.lower()
        has_domain = bool(re.search(r"\b[a-z0-9-]+\.[a-z]{2,}\b", q_low))
        has_known_source = any(k in q_low for k in settings.known_sources)
        user_explicit_source = has_domain or has_known_source

        filters = intent_obj.get("filters")
        if isinstance(filters, dict):
            if filters.get("source") and not user_explicit_source:
                filters["source"] = None
                intent_obj["filters"] = filters

        if q.debug:
            out_debug = intent_obj.get("_debug") if isinstance(intent_obj.get("_debug"), dict) else {}
            out_debug["user_explicit_source"] = user_explicit_source
            out_debug["filters_after_fix"] = intent_obj.get("filters")
            intent_obj["_debug"] = out_debug

        # ── Belt-and-suspenders top_n / order extraction ─────────────
        if not intent_obj.get("top_n"):
            tn = extract_top_n_from_text(question)
            if tn:
                intent_obj["top_n"] = tn
        if not intent_obj.get("order"):
            od = extract_order_from_text(question)
            if od:
                intent_obj["order"] = od

        sql_text, params, human_answer = build_sql_from_intent(intent_obj, question)
        sql_text = normalize_sql(sql_text)

        ok, err = validate_llm_sql(sql_text)
        if not ok:
            intent = simple_intent_router(question)
            res = ask(Question(question=question, preset=intent), repo=repo)
            if isinstance(res, dict):
                res["llm"] = False
                res["fallback_reason"] = f"Built SQL rejected: {err}"
                if q.debug:
                    res["intent"] = intent
                    res["intent_obj"] = intent_obj
                    res["sql_candidate"] = sql_text
            return res

        sql_text = enforce_limit(sql_text, settings.smart.max_rows)
        data = repo.execute_safe(sql_text, params=params, limit=settings.smart.max_rows)

        out = {
            "ok": True,
            "answer": human_answer or "Готово — смотри таблицу справа.",
            "sql": sql_text,
            "data": data,
            "llm": True,
        }
        if q.debug:
            out["tables"] = extract_tables(sql_text)
            out["model"] = settings.ai.openai_model
            out["intent_obj"] = intent_obj
            out["params"] = list(params) if params else []
        return out

    except Exception as e:
        log.warning("smart pipeline error, falling back", extra={"err": str(e)[:200]})
        intent = simple_intent_router(question)
        res = ask(Question(question=question, preset=intent), repo=repo)
        if isinstance(res, dict):
            res["llm"] = False
            res["fallback_reason"] = f"LLM error: {str(e)[:200]}"
            if q.debug:
                res["intent"] = intent
        return res
