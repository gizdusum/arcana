# Arcana Backend

Express API serving the HERMES advisor agent. Runs on VPS at
api.arcana.zone (managed by pm2 as `arcana-api`).

## Deployment

This codebase is synced to /root/arcana-api/index.js on the production
VPS. To deploy changes:

1. Edit index.js locally
2. Commit and push
3. SSH to VPS, pull from repo, pm2 restart arcana-api

## Environment variables

See .env.example for required variables. Real values live on the VPS
in /root/arcana-api/.env (gitignored).

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key for Hermes 3 70B model |

## Endpoints

- `POST /api/advisor` — chat with APOLLO/ATLAS/ARES advisor
- `GET /health` — health check

## Key internals

- `buildSystemPrompt()` — character voices (APOLLO/ATLAS/ARES) + intent detection
- `fetchVaultState()` — reads live TVL and user share from ArcanaVault on Arc Testnet
- `callOpenRouter()` — Hermes 3 70B with 30s timeout and retry on 429/5xx
