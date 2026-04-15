#!/usr/bin/env bash
# Launch the Freenove FNK0054 dashboard frontend in preview mode (no backend needed)
set -e

PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")/files/frontend" && pwd)"

echo "🧪 Freenove FNK0054 — Frontend Preview"
echo "   Serving from: $DIR"
echo "   Open: http://localhost:${PORT}/preview.html"
echo "   Press Ctrl+C to stop"
echo ""

python3 -m http.server "$PORT" --directory "$DIR"
