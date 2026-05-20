"""Provider-agnostic LLM protocol.

The single method any provider must implement is ``chat`` which takes
instructions + user input and returns the model's text response. The
intent extraction pipeline calls this directly; future agents will use
the richer ``ChatRequest`` shape with tool definitions, etc.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class ChatRequest:
    instructions: str
    user_input: str
    temperature: float = 0.0
    max_output_tokens: int = 700
    # Future: tools, response_format, etc.
    extra: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ChatResponse:
    text: str
    model: str
    # Future: tool_calls, reasoning, usage
    raw: dict = field(default_factory=dict)


@runtime_checkable
class LLMProvider(Protocol):
    name: str

    def chat(self, request: ChatRequest) -> ChatResponse: ...
