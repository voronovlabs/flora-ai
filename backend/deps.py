"""FastAPI dependencies.

Used via ``Depends(...)`` in routers so we can swap implementations
without touching route code. Today every function is a thin factory;
when we adopt connection pooling or per-request transactions, *only*
this file changes.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from backend.ai.providers.base import LLMProvider
from backend.ai.providers.registry import get_provider
from backend.core.config import Settings, get_settings
from backend.core.logging import get_logger
from backend.repositories.prices import PricesRepository


def settings_dep() -> Settings:
    return get_settings()


def logger_dep():
    return get_logger("flora.routes")


def prices_repo_dep() -> PricesRepository:
    return PricesRepository()


def llm_provider_dep() -> LLMProvider:
    return get_provider()


# Type aliases — let routes write `s: Settings_` instead of the long form.
Settings_   = Annotated[Settings, Depends(settings_dep)]
Logger_     = Annotated[object, Depends(logger_dep)]
PricesRepo_ = Annotated[PricesRepository, Depends(prices_repo_dep)]
LLM_        = Annotated[LLMProvider, Depends(llm_provider_dep)]
