"""Tool registry.

Empty by design — the protocol is the deliverable here. As tools land
they should register themselves at import time::

    from backend.ai.tools.registry import register
    register(SqlRunnerTool())
"""

from __future__ import annotations

from typing import Dict, List

from backend.ai.tools.base import Tool


_TOOLS: Dict[str, Tool] = {}


def register(tool: Tool) -> None:
    _TOOLS[tool.spec.name] = tool


def get(name: str) -> Tool:
    if name not in _TOOLS:
        raise KeyError(f"unknown tool: {name!r}")
    return _TOOLS[name]


def list_tools() -> List[Tool]:
    return list(_TOOLS.values())
