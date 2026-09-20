#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (set it in $ENV_FILE)." >&2
  exit 1
fi

if [[ -z "${DOCKER_HOST:-}" ]] && command -v docker >/dev/null 2>&1; then
  DOCKER_HOST="$(docker context inspect "$(docker context show)" --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
  [[ -n "$DOCKER_HOST" ]] && export DOCKER_HOST
fi
export TESTCONTAINERS_RYUK_DISABLED="${TESTCONTAINERS_RYUK_DISABLED:-true}"

for DB_URL in "${DATABASE_URL}" "${DIRECT_URL:-}"; do
  [[ -z "$DB_URL" ]] && continue
  DB_HOST="$(node -e "const u=new URL(process.argv[1]); process.stdout.write(u.hostname)" "$DB_URL")"
  case "$DB_HOST" in
    localhost|127.0.0.1|::1) ;;
    *)
      if [[ "${ALLOW_REMOTE_DB:-0}" != "1" || "${CONFIRM_REMOTE_DB:-}" != "I_UNDERSTAND" ]]; then
        echo "Refusing remote database host '$DB_HOST'. Set ALLOW_REMOTE_DB=1 CONFIRM_REMOTE_DB=I_UNDERSTAND to opt in." >&2
        exit 1
      fi
      ;;
  esac
done

run() {
  printf '\n==> %s\n' "$*"
  "$@"
}

cd "$ROOT_DIR/backend"
run npx prisma migrate deploy
run npx prisma generate
run npm test

if [[ "${SKIP_INTEGRATION:-0}" == "1" ]]; then
  printf '\n==> integration tests skipped (SKIP_INTEGRATION=1)\n'
else
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Docker is required for Testcontainers integration tests. Start Docker or set SKIP_INTEGRATION=1." >&2
    exit 2
  fi
  run npm run test:integration
fi

unset NODE_ENV
cd "$ROOT_DIR/frontend"
run npm run lint
run npm run build

cd "$ROOT_DIR/channel-service"
run npm run build

printf '\nLocal verification passed.\n'
