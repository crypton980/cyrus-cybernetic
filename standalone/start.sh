#!/bin/bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  CYRUS v3.0 - Standalone Launcher${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo -e "${GREEN}[OK]${NC} Environment loaded from .env"
else
    echo -e "${RED}[ERROR] No .env file found. Run install.sh first or copy .env.example to .env${NC}"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}[ERROR] DATABASE_URL is not set in .env${NC}"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key-here" ]; then
    echo -e "${YELLOW}[WARN] OPENAI_API_KEY is not configured. AI responses will not work.${NC}"
fi

if [ ! -d "dist/public" ]; then
    echo -e "${YELLOW}[INFO] Frontend not built. Building now...${NC}"
    npm run build
fi

export NODE_ENV=production
export PORT="${PORT:-5000}"

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate 2>/dev/null || true
fi

echo ""
echo -e "${GREEN}Starting CYRUS on port $PORT...${NC}"
echo ""

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down CYRUS...${NC}"
    kill $(jobs -p) 2>/dev/null
    wait 2>/dev/null
    echo -e "${GREEN}CYRUS stopped.${NC}"
}
trap cleanup EXIT INT TERM

python3 server/quantum_ai/quantum_bridge.py &>/dev/null &
python3 server/comms/ml_service.py &>/dev/null &

npx tsx server/index.ts
