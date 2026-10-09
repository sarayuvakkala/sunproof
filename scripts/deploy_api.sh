#!/usr/bin/env bash
# Build and deploy the backend. Optional settings come from .env.local (gitignored): [DEMO_TIME_SCALE=1]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] && set -a && . ./.env.local && set +a
cd backend
sam build
sam deploy --parameter-overrides "DemoTimeScale=${DEMO_TIME_SCALE:-1}"
