#!/bin/bash
# Runs on the server: pull the tarball, write .env from SSM, rebuild the images, start the stack.
# Database migrations are deliberately NOT run here. The database is shared and hosted on
# Supabase, so a human applies them: see DEPLOYMENT.md.
set -euo pipefail
export HOME=/root
. /etc/growthos.conf
APP=/opt/growthos

/snap/bin/aws s3 cp "s3://$BUCKET/growthos.tgz" /tmp/growthos.tgz --region "$REGION" --only-show-errors
mkdir -p "$APP"
tar xzf /tmp/growthos.tgz -C "$APP"

ENV=$(/snap/bin/aws ssm get-parameter --region "$REGION" --name /growthos/env --with-decryption --query Parameter.Value --output text)
[ ${#ENV} -gt 100 ] || { echo "empty env from SSM"; exit 1; }
printf '%s\n' "$ENV" > "$APP/deploy/.env"
chmod 600 "$APP/deploy/.env"

# DNS must point here before Caddy asks Let's Encrypt for a certificate.
/usr/local/bin/growthos-boot.sh --dns-only
cd "$APP/deploy"
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f >/dev/null
