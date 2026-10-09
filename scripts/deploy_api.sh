#!/usr/bin/env bash
# Build and deploy the backend. Emails come from .env.local (gitignored):
#   SENDER_EMAIL=...  INSTALLER_EMAIL=...  [DEMO_TIME_SCALE=1]
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] && set -a && . ./.env.local && set +a
cd backend
sam build
sam deploy --parameter-overrides \
  "SenderEmail=${SENDER_EMAIL:-}" "InstallerEmail=${INSTALLER_EMAIL:-}" "DemoTimeScale=${DEMO_TIME_SCALE:-1}"
