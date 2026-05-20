"""Backward-compatible shim around the new provider layer.

Existing call-sites import ``openai_responses_json`` from this module.
We keep that function name but route the call through
``ai.providers.registry`` so swapping providers is a config change,
not a code change.
"""

from __future__ import annotations

from backend.ai.providers.base import ChatRequest
from backend.ai.providers.registry import get_provider


def openai_responses_json(instructions: str, user_input: str) -> str:
    provider = get_provider("openai")
    resp = provider.chat(ChatRequest(instructions=instructions, user_input=user_input))
    return resp.text
