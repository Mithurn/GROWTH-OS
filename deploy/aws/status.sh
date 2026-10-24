#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib.sh"
ID=$(iid); [ -n "$ID" ] || { echo "no instance named $NAME"; exit 1; }
echo "state: $(state "$ID")"
echo "url: $(site)"
curl -s -m 5 "$(site)/api/health" || echo "(not answering)"
