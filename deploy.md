# Deployment

This document covers the standard server deploy of the three Flora AI
services behind Caddy.

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
