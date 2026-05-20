"""POST /ask — preset-driven Q&A.

Free-form `question` is reserved for /smart; here we only accept the
three known presets used by the quick-buttons.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.schemas.questions import Question
from backend.services.presets import (
    run_count_sku,
    run_price_stats,
    run_top_price_changes,
)

router = APIRouter()


@router.post("/ask")
def ask(q: Question):
    preset = (getattr(q, "preset", None) or "").strip()

    if preset:
        if preset == "count_sku":
            return run_count_sku()
        if preset == "price_stats":
            return run_price_stats()
        if preset == "top_price_changes":
            return run_top_price_changes()

    return {
        "ok": True,
        "answer": "Выбери пресет или используй Smart (LLM) 🙂",
        "sql": None,
        "data": [],
    }
