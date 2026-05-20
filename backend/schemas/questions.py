"""Pydantic request models for /ask and /smart.

`Question.question` is Optional because preset-driven calls from the
quick-button row arrive with no free-text question.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Question(BaseModel):
    question: Optional[str] = None
    preset: Optional[str] = None


class SmartQuery(BaseModel):
    question: str
    debug: Optional[bool] = False
