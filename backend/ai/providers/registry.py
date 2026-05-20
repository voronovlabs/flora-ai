"""Provider routing.

Today: only OpenAI Responses. The registry exists so the call-site
(``services/intent``) doesn't pick a provider directly — it asks for
the one configured in ``Settings.ai.provider``. Add Anthropic / Yandex
/ a local model by registering a new provider here.
"""

from __future__ import annotations

from typing import Callable, Dict

from backend.ai.providers.base import LLMProvider
from backend.ai.providers.openai import OpenAIResponsesProvider
from backend.core.config import get_settings
from backend.core.errors import UpstreamError


_BUILDERS: Dict[str, Callable[[], LLMProvider]] = {
    "openai": OpenAIResponsesProvider,
}


def register_provider(name: str, builder: Callable[[], LLMProvider]) -> None:
    _BUILDERS[name] = builder


def get_provider(name: str | None = None) -> LLMProvider:
    settings = get_settings()
    name = name or settings.ai.provider
    if name not in _BUILDERS:
        raise UpstreamError(
            f"unknown LLM provider: {name!r}",
            details={"available": list(_BUILDERS.keys())},
        )
    return _BUILDERS[name]()
