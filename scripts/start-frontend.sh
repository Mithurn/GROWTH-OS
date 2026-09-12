#!/bin/bash
# Restart just the frontend with a clean Turbopack cache.
set -e

cd "$(dirname "$0")/../frontend"

# Only kill a dev server serving this directory — a blanket `pkill -f "next dev"`
# would take down unrelated Next projects.
if [ -f .next/dev/lock ]; then
  rm -rf .next
fi

echo "Starting frontend..."
npm run dev
