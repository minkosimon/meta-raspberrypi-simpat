#!/usr/bin/env bash
# Launch the Freenove FNK0054 Test Dashboard Backend
# Usage: ./run-backend.sh [port]
# 
# Option 2: Uses environment variables for configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory (absolute path)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/files/backend"
FRONTEND_DIR="$SCRIPT_DIR/files/frontend"

# Configuration from arguments or environment
PORT="${1:-${FNK_WS_PORT:-8080}}"
WS_HOST="${FNK_WS_HOST:-0.0.0.0}"
SSH_HOST="${FNK_SSH_HOST:-192.168.10.22}"
SSH_PORT="${FNK_SSH_PORT:-22}"
SSH_USER="${FNK_SSH_USER:-root}"
SCRIPTS_DIR="${FNK_SCRIPTS_DIR:-/opt/freenove/scripts}"

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🚀 Freenove FNK0054 Test Dashboard Backend${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Verify directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found: $BACKEND_DIR${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found: $FRONTEND_DIR${NC}"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/app.py" ]; then
    echo -e "${RED}❌ app.py not found: $BACKEND_DIR/app.py${NC}"
    exit 1
fi

# Verify frontend files exist
if [ ! -f "$FRONTEND_DIR/index.html" ]; then
    echo -e "${YELLOW}⚠️  index.html not found in $FRONTEND_DIR${NC}"
fi

if [ ! -f "$FRONTEND_DIR/style.css" ]; then
    echo -e "${YELLOW}⚠️  style.css not found in $FRONTEND_DIR${NC}"
fi

if [ ! -f "$FRONTEND_DIR/app.js" ]; then
    echo -e "${YELLOW}⚠️  app.js not found in $FRONTEND_DIR${NC}"
fi

# Export environment variables (Option 2: Variable d'environnement)
export FNK_FRONTEND_DIR="$FRONTEND_DIR"
export FNK_SCRIPTS_DIR="$SCRIPTS_DIR"
export FNK_WS_HOST="$WS_HOST"
export FNK_WS_PORT="$PORT"
export FNK_SSH_HOST="$SSH_HOST"
export FNK_SSH_PORT="$SSH_PORT"
export FNK_SSH_USER="$SSH_USER"

echo -e "Configuration:"
echo -e "  ${GREEN}✓ Backend Directory:${NC}  $BACKEND_DIR"
echo -e "  ${GREEN}✓ Frontend Directory:${NC}  $FRONTEND_DIR"
echo -e "  ${GREEN}✓ WebSocket URL:${NC}      ws://$WS_HOST:$PORT/ws"
echo -e "  ${GREEN}✓ HTTP URL:${NC}           http://$WS_HOST:$PORT/"
echo -e "  ${GREEN}✓ SSH Target:${NC}         $SSH_USER@$SSH_HOST:$SSH_PORT"
echo -e "  ${GREEN}✓ Board Scripts:${NC}      $SCRIPTS_DIR"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "📱 Open: ${GREEN}http://localhost:${PORT}/${NC}"
echo -e "⌨️  Press Ctrl+C to stop"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check Python 3 availability
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed${NC}"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

# Run the backend app with exported environment variables
exec python3 app.py
