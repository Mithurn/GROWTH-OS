#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS=()
REDIS_CONTAINER="growthos-local-redis-$$"

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "Docker is required to run the local Redis service." >&2
  exit 1
fi

DOCKER_HOST="${DOCKER_HOST:-$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)}"
export DOCKER_HOST
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export WEBHOOK_SECRET="${WEBHOOK_SECRET:-local-development-webhook-secret}"
export SUPABASE_JWT_SECRET="${SUPABASE_JWT_SECRET:-super-secret-jwt-token-with-at-least-32-characters-long}"
if [[ -z "${SUPABASE_ANON_KEY:-}" && -f "$ROOT_DIR/frontend/.env.local" ]]; then
  SUPABASE_ANON_KEY="$(sed -n 's/^NEXT_PUBLIC_SUPABASE_ANON_KEY=//p' "$ROOT_DIR/frontend/.env.local")"
  export SUPABASE_ANON_KEY
fi
docker run -d --rm --name "$REDIS_CONTAINER" -p 6379:6379 redis:7-alpine >/dev/null

cleanup() {
  trap - INT TERM EXIT
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  docker rm -f "$REDIS_CONTAINER" >/dev/null 2>&1 || true
}

trap cleanup INT TERM EXIT

(cd "$ROOT_DIR/backend" && npm run dev) & PIDS+=("$!")
(cd "$ROOT_DIR/channel-service" && npm run dev) & PIDS+=("$!")
(cd "$ROOT_DIR/frontend" && npm run dev) & PIDS+=("$!")

printf '\nGrowthOS is starting:\n'
printf '  App:     http://localhost:3000\n'
printf '  Backend: http://localhost:3001\n'
printf '  Channel: http://localhost:5001\n'
printf '\nPress Ctrl-C to stop all services.\n\n'

wait
