"""POST /ask — preset-driven Q&A.

Free-form ``question`` is reserved for /smart; here we only accept
the three known presets used by the quick-buttons. Response shape is
the legacy ``{ok, answer, sql, data}`` and MUST NOT change.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.deps import PricesRepo_
from backend.schemas.questions import Question
from backend.services.presets import run_preset

router = APIRouter()


@router.post("/ask")
def ask(q: Question, repo: PricesRepo_):
    preset = (getattr(q, "preset", None) or "").strip()
    return run_preset(preset, repo)
