# Deployment

This document covers two deployment shapes:

1. **Staging / single-host server** (see § Staging below) — only the
   analytics frontend + flora-api run in compose; Postgres is the
   pre-existing `flower-postgres` container on the host. This is what
   `/opt/flora-ai` runs today.
2. **Full stack** with bundled Postgres and the agent service behind
   Caddy — the original layout, kept for reference. Most teams will not
   need this.

## 0. Prerequisites on the server

```bash
# Docker + Compose v2 plugin
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin

# (Optional but recommended) a non-root user in the docker group
sudo usermod -aG docker $USER
newgrp docker

# Git
sudo apt-get install -y git
```

## Staging deploy (single-host server)

Used by `/opt/flora-ai`. Connects to the existing `flower-postgres`
container on the host (port `55432`) and publishes the UI on `:18081`
and the API on `:18082`.

```bash
cd /opt/flora-ai
git pull

# .env may already exist on the server. If not, seed from the example.
[ -f .env ] || cp .env.example .env

docker compose -f docker-compose.staging.yml up -d --build
```

Smoke tests (run on the server):

```bash
# Backend liveness + a real query that hits Postgres.
curl -s http://127.0.0.1:18082/health
curl -s http://127.0.0.1:18082/stats | head -c 500

# Frontend reachable + proxying the API through to flora-api:8000.
curl -I http://127.0.0.1:18081
curl -s http://127.0.0.1:18081/stats | head -c 500
```

UI is then available at:

```
http://SERVER_IP:18081
```

How the routing works in staging:

- The browser sends `GET /stats`, `POST /ask`, `POST /smart`, `GET /health`
  to the same origin as the page (port `18081`).
- The `frontend` container (nginx) terminates those four paths and
  `proxy_pass`es them to `flora-api:8000` over the compose network.
- Everything else falls through to the static SPA (`index.html`).

Container-to-host DB:

- `flora-api` resolves `host.docker.internal` to the Docker host gateway
  (`extra_hosts`), so `DB_HOST=host.docker.internal` + `DB_PORT=55432`
  reach the `flower-postgres` container that already binds `:55432` on
  the host.

To watch logs / restart only one service:

```bash
docker compose -f docker-compose.staging.yml logs -f flora-api
docker compose -f docker-compose.staging.yml restart flora-api
```

To roll back to a previous commit:

```bash
git checkout <prev-sha>
docker compose -f docker-compose.staging.yml up -d --build
```

---

## 1. First-time setup

```bash
# Pick a stable directory
sudo mkdir -p /opt/flora && sudo chown $USER:$USER /opt/flora
cd /opt/flora

# Clone (replace with your real remote when GitHub is wired up)
git clone git@github.com:<org>/flora-clean.git .

# Configure secrets
cp .env.example .env
$EDITOR .env
# Required to fill:
#   DB_PASSWORD               — strong password
#   OPENAI_API_KEY            — production OpenAI key
#   YANDEX_SEARCH_API_KEY     — only if you run the agent live
#   YANDEX_SEARCH_FOLDER_ID
```

## 2. Caddy

If you already run Caddy on the host (recommended over the bundled
sidecar), point a site block at the compose-exposed ports:

```caddyfile
flora.example.com {
  encode zstd gzip

  @api path /ask /smart /stats /health
  reverse_proxy @api 127.0.0.1:8000

  @agent path /agent/*
  reverse_proxy @agent 127.0.0.1:8091

  reverse_proxy 127.0.0.1:8080
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

If you'd rather run Caddy inside compose, start the stack with the
`proxy` profile (see "Bring it up" below) and remove the host-Caddy
site block.

## 3. Bring it up

```bash
cd /opt/flora

# Pull dependencies, build images, start everything detached.
docker compose pull
docker compose build --pull
docker compose up -d

# To also run the bundled Caddy:
# docker compose --profile proxy up -d
```

Health checks:

```bash
curl -fsSL http://127.0.0.1:8000/health
curl -fsSL http://127.0.0.1:8091/health
curl -fsSL http://127.0.0.1:8080/healthz
```

## 4. Updates / redeploy

```bash
cd /opt/flora
git pull
docker compose pull
docker compose build
docker compose up -d
```

Backend (`flora-api`) and frontend rebuilds are <30 seconds. The
agent image rebuild is ~3–5 minutes the first time (Playwright Chromium
download).

## 5. Database migrations

Schema files for the agent live under `flora-agent-api/sql/`. Apply them
once against the configured Postgres:

```bash
docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME \
  < flora-agent-api/sql/20260324_create_flora_activation_status.sql
```

The analytics datamart table (`dm.comp_daily_prices`) is produced by
your existing harvester pipeline — this repo does not own it.

## 6. Logs & ops

```bash
# tail one service
docker compose logs -f flora-api
docker compose logs -f flora-agent-api
docker compose logs -f frontend

# all
docker compose logs -f
```

## 7. Backups

```bash
# Postgres dump
docker compose exec postgres pg_dump -U $DB_USER $DB_NAME \
  | gzip > /opt/flora/backups/db-$(date +%F).sql.gz

# Agent JSON state (transitional — should move into Postgres)
tar czf /opt/flora/backups/agent-state-$(date +%F).tgz \
  flora-agent-api/app/storage
```

A weekly cron is recommended.

## 8. Rollback

Docker compose tags images by build context content, so to roll back
just check out the previous commit and rebuild:

```bash
git log --oneline -n 5
git checkout <prev-sha>
docker compose build
docker compose up -d
```

## 9. Common pitfalls

- **`/smart` returns "API call failed"** — almost always `OPENAI_API_KEY`
  is empty or invalid. With an empty key the backend falls back to the
  heuristic intent router; with an invalid key it errors. Check
  `docker compose logs flora-api`.
- **Empty `/stats`** — Postgres is up but the harvester hasn't filled
  `dm.comp_daily_prices` yet. This repo does not own the harvester.
- **Caddy 502 on `/ask`** — flora-api container is unhealthy. Verify
  `curl http://127.0.0.1:8000/health` and look at the logs.
- **Playwright fails on agent first start** — the Chromium download is
  bundled into the image build; if you skipped `--build` after a code
  pull the image may be stale.
