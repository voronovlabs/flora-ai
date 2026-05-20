# Flora AI

AI-assisted competitive intelligence for flower retail and e-commerce.

This repo is the **clean, GitHub-ready** layout of the Flora AI codebase.
Source is split into three independently-deployable services and a
shared frontend.

```
flora-clean/
├── frontend/             # static SPA (vanilla JS, ES modules)
├── backend/              # flora-api — analytics & AI chat over Postgres
├── flora-agent-api/      # parser / orchestration service (Stage 1–4)
├── docker-compose.yml    # local dev stack
├── Caddyfile.example     # reverse-proxy routing (mirrors production)
├── .env.example
├── deploy.md             # server deployment notes
└── README.md
```

## Architecture in one screen

```
              ┌──────────────────┐
              │   Caddy (TLS)    │
              └────────┬─────────┘
                       │
        ┌──────────────┼─────────────────────┐
        │              │                     │
        ▼              ▼                     ▼
  ┌──────────┐   ┌────────────┐       ┌───────────────────┐
  │ frontend │   │ flora-api  │       │ flora-agent-api   │
  │  nginx   │   │ FastAPI    │       │ FastAPI + Playwr. │
  │  :80     │   │ :8000      │       │ :8091             │
  └──────────┘   └────┬───────┘       └─────────┬─────────┘
                      │                         │
                      ▼                         ▼
                ┌──────────────┐         ┌────────────────┐
                │  PostgreSQL  │         │  JSON storage  │
                │ dm.comp_…    │         │ (transitional) │
                └──────────────┘         └────────────────┘
```

### Public HTTP contract (must not change)

| Method | Path     | Owner            | Purpose                                  |
|--------|----------|------------------|------------------------------------------|
| GET    | /health  | flora-api        | DB + service liveness                    |
| GET    | /stats   | flora-api        | competitor SKU snapshot for sidebar      |
| POST   | /ask     | flora-api        | preset-driven Q&A (3 quick-buttons)      |
| POST   | /smart   | flora-api        | free-form LLM-assisted Q&A               |
| POST   | /agent/* | flora-agent-api  | scout/verifier/mapper/repair/stage4/…    |

All paths above must remain reachable from the public origin with the
same JSON shape. The Caddyfile and `docker-compose.yml` here both
preserve that.

## Quick start (local dev)

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY if you want /smart to use the LLM.
# Leave it empty to force heuristic-only mode (safe default).

docker compose up --build
```

Then open:

- Frontend  → http://localhost:8080
- API docs  → http://localhost:8000/docs
- Agent API → http://localhost:8091/docs

To run the bundled Caddy reverse-proxy locally (mirrors prod routing):

```bash
docker compose --profile proxy up --build
# All traffic on http://localhost
```

## Service-by-service

### `frontend/`

Plain HTML + ES-module JavaScript. No build step.

```
frontend/
├── index.html
├── nginx.conf
├── Dockerfile
└── src/
    ├── styles.css
    ├── format.js               # pure formatters
    ├── api.js                  # fetch wrappers (/ask /smart /stats)
    ├── ui.js                   # DOM refs + shared state
    ├── app.js                  # entry point
    └── components/
        ├── messages.js         # chat bubbles + SQL block
        ├── results-panel.js    # right-side data table + CSV
        └── stats-box.js        # sources/snapshot summary
```

Inline `onclick=` handlers in `index.html` reach module functions via
`window.*` aliases set in `app.js`. This keeps the refactor visually
identical to the legacy single-file build.

### `backend/`

FastAPI app split into routes / services / db / schemas:

```
backend/
├── main.py            # app + router mounts
├── config.py          # env-driven settings (single source of truth)
├── requirements.txt
├── Dockerfile
├── db/
│   └── postgres.py    # run_sql_text(): short-lived RealDictCursor
├── schemas/
│   └── questions.py   # Question, SmartQuery
├── services/
│   ├── openai_client.py   # OpenAI Responses API call
│   ├── sql_safety.py      # whitelist + DDL/DML guard + LIMIT cap
│   ├── intent.py          # LLM intent JSON → deterministic SQL builder
│   └── presets.py         # the three preset queries + formatters
└── routes/
    ├── health.py      # GET /health
    ├── stats.py       # GET /stats
    ├── ask.py         # POST /ask
    └── smart.py       # POST /smart
```

Behavior is byte-for-byte equivalent to the legacy `flora-api/main.py`:
the same SQL, same response shapes, same fallback chain when the LLM
errors or is missing.

### `flora-agent-api/`

Untouched. Parser logic and Stage 1–4 pipeline live here. Compose builds
it as-is with the existing `Dockerfile`. The only thing this refactor
does is consume its `requirements.txt` from the same `.env` for
`YANDEX_SEARCH_*` keys.

## Environment variables

See [`.env.example`](.env.example). Three groups:

- **Postgres** (`DB_*`) — flora-api connection.
- **OpenAI** (`OPENAI_API_KEY`, `OPENAI_MODEL`) — `/smart` only. Empty
  key means heuristic-only mode.
- **Yandex Search** (`YANDEX_SEARCH_*`) — flora-agent-api scout.

## Deployment

See [`deploy.md`](deploy.md).

## License

Proprietary, all rights reserved.
