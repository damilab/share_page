#!/bin/bash
# deploy.sh — Pull latest code and restart the server
# Usage: Run on the server after git push
#   ./scripts/deploy.sh

set -e

cd "$(dirname "$0")/.."

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Installing dependencies ==="
npm install --production

echo "=== Building Tailwind CSS ==="
npx tailwindcss@3 -i ./public/css/style.css -o ./public/css/output.css --minify

echo "=== Restarting server ==="
pm2 restart lab-share-page 2>/dev/null || pm2 start ecosystem.config.js

echo "=== Deploy complete ==="
pm2 status lab-share-page
