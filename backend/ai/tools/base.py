"""Tool protocol for the future agent runtime.

A tool is anything an agent can invoke deterministically: a SQL
runner, a chart generator, a retrieval index, an external API. Today
no agent runs tools — the protocol exists so a tool-using planner can
land without restructuring this directory.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True)
class ToolSpec:
    """Machine-readable contract for a tool."""

    name: str
    description: str
    # JSON-Schema-ish dict; full schema validation can land later.
    parameters: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: Any = None
    error: str | None = None


@runtime_checkable
class Tool(Protocol):
    spec: ToolSpec

    def run(self, **kwargs: Any) -> ToolResult: ...
