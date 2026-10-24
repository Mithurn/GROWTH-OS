# Deployment

GrowthOS is split so the part people look at is free and always up, and the part that costs money sleeps until it is needed.

| Part | Where | Cost | Always on |
| --- | --- | --- | --- |
| Landing page, `/demo`, and the app UI | Vercel, root directory `frontend` | free | yes |
| API, BullMQ workers, channel service, Redis | One AWS EC2 server, `ap-south-1` (`t3.medium`) | about $0.05/hour while running, the 20 GB disk only while stopped | no, sleeps |
| Database and auth | Supabase | free tier | yes |

Live API: https://growthos.duckdns.org (health at `/api/health`)

## What visitors see

- **Server asleep:** the landing page says so and the main button becomes "Try the live demo". Opening the app shows a banner offering the same demo. The demo runs entirely in the browser on bundled sample data (`frontend/lib/demo/`), so it works with no backend and no sign-in. Launching a campaign is disabled in demo mode.
- **Server awake:** the landing page offers "Create account", and the app talks to the AWS API. The frontend probes `/health` every 30 seconds, so it switches on its own.

## Switch it on and off

These use the tags on the instance (`Portfolio=true`, `HealthUrl`), set by `up.sh`. They live in [aws-workspace](https://github.com/Mithurn/aws-workspace).

| Do | Command |
| --- | --- |
| Start every portfolio server and wait until healthy (2 to 4 minutes) | `awsstart` |
| Stop them all | `awsstop` |
| State and health | `awsstatus` |

Per-project scripts, run from the repo root:

| Do | Command |
| --- | --- |
| Create the server (one time, about 10 minutes) | `deploy/aws/up.sh` |
| Wake or sleep only GrowthOS | `deploy/aws/start.sh`, `deploy/aws/stop.sh` |
| Ship new code to the running server | `deploy/aws/push.sh` |
| State and health | `deploy/aws/status.sh` |

## How it works

- The server is found by the EC2 tag `Name=GrowthOS`. The public IP changes on every start, so a boot service repoints the DuckDNS name `growthos` (token from SSM `/recoveryops/duckdns`) and starts `deploy/docker-compose.prod.yml`: Caddy for HTTPS, the API with workers in-process, the channel service, and Redis.
- Server environment lives in the encrypted SSM parameter `/growthos/env`. `up.sh` fills it from `backend/.env`; `deploy/.env.prod.example` lists every key. Change a value in SSM, then run `push.sh`.
- Code ships as a tarball through the private S3 bucket `growthos-deploy-<account id>`. `release.sh` runs on the server, writes `.env` from SSM and rebuilds the images.
- Only ports 80 and 443 are open. There is no SSH; use SSM Run Command.

## One-time setup

1. `cp backend/.env.example backend/.env` and fill it in. Set `FRONTEND_URL` to the Vercel URL and `DIRECT_URL` to the Supabase direct connection.
2. `deploy/aws/up.sh`. It prints the instance ID.
3. Add that instance ID to the `stop-at-50-usd` budget action, as described in the aws-workspace playbook.
4. In Vercel, set `NEXT_PUBLIC_API_URL=https://growthos.duckdns.org/api` (plus the Supabase keys already there) and redeploy.
5. `awsstop`, `awsstart`, confirm it comes back healthy on its new IP, then `awsstop`.

## Database migrations

Migrations are **not** run on boot or by `release.sh`. The database is shared and hosted on Supabase, and the handover rules say a person applies migrations. When a release adds one:

```bash
cd backend && DIRECT_URL=... npx prisma migrate deploy
```

## Alerts and bots

| What | Where | Needs |
| --- | --- | --- |
| OpenRouter out of credit, bad key, sustained 429 or 5xx, and low balance (checked every 30 minutes) | `backend/src/lib/llm-watch.ts` | `ALERT_WEBHOOK_URL`, optional `OPENROUTER_MIN_CREDITS_USD` (default 2) |
| Crashes, failed boot, repeated 500s | `backend/src/lib/alerts.ts` | `ALERT_WEBHOOK_URL`, optionally `SENTRY_DSN` |
| Landing page or demo down, or backend awake but unhealthy | `.github/workflows/health-monitor.yml` opens and closes an issue labelled `bug-bot` | nothing |
| Weekly dependency updates, grouped per service | `.github/dependabot.yml` | nothing |
| Stale issues and pull requests, merged branches | `.github/workflows/housekeeping.yml` | nothing |

`ALERT_WEBHOOK_URL` is a Slack or Discord incoming webhook. Each alert repeats at most once an hour. An asleep backend is never reported as an incident.

## Moving off Render

`render.yaml`, `.github/workflows/keep-alive.yml` and `deploy.yml` still target Render. Once Vercel points at AWS, delete those three and remove the Render services, or the keep-alive pings keep a second backend running.
