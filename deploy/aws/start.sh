#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib.sh"
ID=$(iid); [ -n "$ID" ] || { echo "no instance named $NAME, run up.sh"; exit 1; }
aws ec2 start-instances --instance-ids "$ID" >/dev/null
aws ec2 wait instance-running --instance-ids "$ID"
echo "instance running, waiting for the app at $(site)"
for _ in $(seq 1 90); do
  if curl -fs -m 5 "$(site)/api/health" >/dev/null; then echo "ready: $(site)"; exit 0; fi
  sleep 5
done
echo "still not answering, check deploy/aws/status.sh"
exit 1
