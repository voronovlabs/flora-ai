"""Named, versioned prompt registry.

Call-sites should NEVER inline a prompt template; pull it from here so
the prompts are easy to grep, version, and (later) cache compiled
representations of.
"""

from __future__ import annotations

from typing import Dict

from backend.ai.prompts import intent_v1


_PROMPTS: Dict[str, str] = {
    "intent_v1": intent_v1.INSTRUCTIONS,
}


def get(name: str) -> str:
    if name not in _PROMPTS:
        raise KeyError(f"unknown prompt: {name!r}; known: {sorted(_PROMPTS)}")
    return _PROMPTS[name]


def register(name: str, template: str) -> None:
    _PROMPTS[name] = template


def list_names() -> list[str]:
    return sorted(_PROMPTS.keys())
