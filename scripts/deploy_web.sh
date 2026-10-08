#!/usr/bin/env bash
# Build the web app and push it to Amplify Hosting (manual deploy, no GitHub link needed).
set -euo pipefail
APP_ID="${AMPLIFY_APP_ID:-d1x4u3l99wlpcs}"
REGION=ap-south-1
cd "$(dirname "$0")/../web"
npm run build
D=$(aws amplify create-deployment --region $REGION --app-id "$APP_ID" --branch-name main --output json)
JOB=$(echo "$D" | python3 -c "import sys,json;print(json.load(sys.stdin)['jobId'])")
URL=$(echo "$D" | python3 -c "import sys,json;print(json.load(sys.stdin)['zipUploadUrl'])")
(cd dist && zip -qr ../dist.zip .)
curl -sf -X PUT -H "Content-Type: application/zip" --upload-file dist.zip "$URL"
rm dist.zip
aws amplify start-deployment --region $REGION --app-id "$APP_ID" --branch-name main --job-id "$JOB" >/dev/null
echo "Deploying job $JOB -> https://main.$APP_ID.amplifyapp.com"
