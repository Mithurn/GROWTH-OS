#!/usr/bin/env bash
# Upload the current code and rebuild on the running server.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
ID=$(iid); [ -n "$ID" ] || { echo "no instance named $NAME"; exit 1; }
[ "$(state "$ID")" = running ] || { echo "start it first: deploy/aws/start.sh"; exit 1; }
upload_release
aws ssm send-command --instance-ids "$ID" --document-name AWS-RunShellScript \
  --parameters 'commands=["/usr/local/bin/growthos-release.sh > /var/log/growthos-release.log 2>&1"]' \
  --query Command.CommandId --output text
echo "rebuilding on the server, takes a few minutes. Check: deploy/aws/status.sh"
