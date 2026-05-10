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
PYTHON_BIN="${FNK_PYTHON_BIN:-}"

if [ -z "$PYTHON_BIN" ] && [ -x "$BACKEND_DIR/venv/bin/python3" ]; then
    PYTHON_BIN="$BACKEND_DIR/venv/bin/python3"
fi

if [ -z "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi

# Configuration from arguments or environment
PORT="${1:-${FNK_WS_PORT:-8080}}"
WS_HOST="${FNK_WS_HOST:-0.0.0.0}"
TLS_ENABLED="${FNK_WS_TLS:-0}"
TLS_CERT="${FNK_WS_TLS_CERT:-}"
TLS_KEY="${FNK_WS_TLS_KEY:-}"
ALLOWED_ORIGINS="${FNK_WS_ALLOWED_ORIGINS:-}"
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
export FNK_WS_TLS="$TLS_ENABLED"
export FNK_WS_TLS_CERT="$TLS_CERT"
export FNK_WS_TLS_KEY="$TLS_KEY"
export FNK_WS_ALLOWED_ORIGINS="$ALLOWED_ORIGINS"
export FNK_SSH_HOST="$SSH_HOST"
export FNK_SSH_PORT="$SSH_PORT"
export FNK_SSH_USER="$SSH_USER"

if [[ "$TLS_ENABLED" =~ ^(1|true|TRUE|yes|YES|on|ON)$ ]]; then
    HTTP_SCHEME="https"
    WS_SCHEME="wss"

    if [ -z "$TLS_CERT" ] || [ -z "$TLS_KEY" ]; then
        echo -e "${RED}❌ TLS is enabled but FNK_WS_TLS_CERT or FNK_WS_TLS_KEY is missing${NC}"
        exit 1
    fi

    if [ ! -f "$TLS_CERT" ]; then
        echo -e "${RED}❌ TLS certificate not found: $TLS_CERT${NC}"
        exit 1
    fi

    if [ ! -f "$TLS_KEY" ]; then
        echo -e "${RED}❌ TLS key not found: $TLS_KEY${NC}"
        exit 1
    fi
else
    HTTP_SCHEME="http"
    WS_SCHEME="ws"
fi

echo -e "Configuration:"
echo -e "  ${GREEN}✓ Backend Directory:${NC}  $BACKEND_DIR"
echo -e "  ${GREEN}✓ Frontend Directory:${NC}  $FRONTEND_DIR"
echo -e "  ${GREEN}✓ Python:${NC}             $PYTHON_BIN"
echo -e "  ${GREEN}✓ WebSocket URL:${NC}      $WS_SCHEME://$WS_HOST:$PORT/ws"
echo -e "  ${GREEN}✓ HTTP URL:${NC}           $HTTP_SCHEME://$WS_HOST:$PORT/"
if [[ "$TLS_ENABLED" =~ ^(1|true|TRUE|yes|YES|on|ON)$ ]]; then
    echo -e "  ${GREEN}✓ TLS Cert:${NC}           ${TLS_CERT:-<missing>}"
    echo -e "  ${GREEN}✓ TLS Key:${NC}            ${TLS_KEY:-<missing>}"
fi
if [ -n "$ALLOWED_ORIGINS" ]; then
    echo -e "  ${GREEN}✓ Allowed Origins:${NC}    $ALLOWED_ORIGINS"
fi
echo -e "  ${GREEN}✓ SSH Target:${NC}         $SSH_USER@$SSH_HOST:$SSH_PORT"
echo -e "  ${GREEN}✓ Board Scripts:${NC}      $SCRIPTS_DIR"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "📱 Open: ${GREEN}$HTTP_SCHEME://localhost:${PORT}/${NC}"
echo -e "⌨️  Press Ctrl+C to stop"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# Check Python availability
if ! command -v "$PYTHON_BIN" &> /dev/null; then
    echo -e "${RED}❌ Python interpreter not found: $PYTHON_BIN${NC}"
    exit 1
fi

# Change to backend directory
cd "$BACKEND_DIR"

# Run the backend app with exported environment variables
exec "$PYTHON_BIN" app.py
