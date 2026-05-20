"""Execution plans for multi-step reasoning.

Today the runtime is a single LLM call. The dataclasses here describe
the *target* representation: a sequence of typed steps that a planner
can compose and a runner can execute. No planner / runner exists yet —
this file is the contract they will share.

Why ship the contract now? Because every downstream module (logging,
tracing, safety) wants to assume a stable shape; pinning it early
saves churn.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Literal, Optional


StepKind = Literal["llm_call", "tool_call", "sql_query", "retrieval", "synthesis"]


@dataclass
class Step:
    kind: StepKind
    description: str
    inputs: dict[str, Any] = field(default_factory=dict)
    # Filled by the runner after execution:
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    elapsed_ms: Optional[float] = None


@dataclass
class ExecutionPlan:
    """Ordered set of steps + meta about the originating question."""

    question: str
    steps: List[Step] = field(default_factory=list)
    # Cumulative state that steps can read/write.
    context: dict[str, Any] = field(default_factory=dict)
    # When `True` the runner will stop on the first step failure.
    fail_fast: bool = True

    def add(self, step: Step) -> "ExecutionPlan":
        self.steps.append(step)
        return self

    def summary(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "steps": [
                {
                    "kind":        s.kind,
                    "description": s.description,
                    "ok":          s.error is None and s.result is not None,
                    "elapsed_ms":  s.elapsed_ms,
                }
                for s in self.steps
            ],
        }
