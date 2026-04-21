#!/bin/bash
# restart.sh — Rebuild CSS and restart the server
cd "$(dirname "$0")/.."

echo "=== Building Tailwind CSS ==="
npx tailwindcss@3 -i ./public/css/style.css -o ./public/css/output.css --minify

echo "=== Restarting server ==="
pm2 restart lab-share-page 2>/dev/null || pm2 start ecosystem.config.js

echo "=== Done ==="
pm2 status lab-share-page
