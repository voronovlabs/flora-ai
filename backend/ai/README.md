# AI Engine

This directory is the seat of Flora AI's reasoning layer. The current
runtime is intentionally simple — single-step intent extraction → SQL
build — but the **directory layout is the target architecture** so the
next batch of features (multi-step reasoning, tool use, retrieval) can
land without restructuring.

```
ai/
├── providers/      # swappable LLM backends (OpenAI today, others later)
│   ├── base.py     # LLMProvider Protocol — chat-style call
│   ├── openai.py   # production provider
│   └── registry.py # name → provider routing
├── prompts/        # versioned, named prompt templates
│   ├── registry.py # PROMPTS["intent_v1"] → string
│   └── intent_v1.py
├── safety/         # input/output safety nets
│   └── sql_guard.py
├── planning/       # execution plans (multi-step reasoning, future)
│   └── plan.py
├── tools/          # tool registry (future: SQL runner, retriever, …)
│   ├── base.py
│   └── registry.py
└── semantic/       # semantic layer over the datamart (future)
    └── __init__.py
```

## Status today

| Module       | Status                                                                       |
|--------------|------------------------------------------------------------------------------|
| providers/   | **production** — OpenAI Responses; provider routing scaffolded.              |
| prompts/     | **production** — single registered prompt (`intent_v1`).                     |
| safety/      | **production** — SQL whitelist + DDL/DML guard + LIMIT cap.                  |
| planning/    | scaffold — `ExecutionPlan` dataclass; no planner runs it yet.                |
| tools/       | scaffold — protocol + empty registry.                                        |
| semantic/    | scaffold — placeholder for a column-typed view of the analytics datamart.   |

## How `/smart` flows through this layer today

```
question
  │
  ▼
prompts/intent_v1  ─── as instructions ───┐
                                          ▼
                                  providers/openai.chat()  ──► intent JSON
                                                                  │
                                          ┌───────────────────────┘
                                          ▼
                              services/intent.build_sql_from_intent()
                                          │
                                          ▼
                                  safety/sql_guard.validate
                                          │
                                          ▼
                              repositories/prices.execute_safe
```

## Multi-agent / tool-use target

```
question
  │
  ▼
planning/plan.compose_plan()   ──► Plan(steps=[ToolCallStep, ReasoningStep, …])
                                          │
                                          ▼
                                  tools/registry.run(step)
                                          │
                                          ▼
                                   ExecutionContext.append(result)
                                          │
                                          ▼
                                     final response
```

Until the planner exists, treat this README as the spec for it.
