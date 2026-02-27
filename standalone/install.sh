#!/bin/bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║   ${BOLD}CYRUS v3.0${NC}${CYAN}                                        ║${NC}"
echo -e "${CYAN}║   Cybernetic Yielding Robust Unified System          ║${NC}"
echo -e "${CYAN}║   OMEGA-TIER Quantum Artificial Intelligence         ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║   Standalone Installation Script                     ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}[MISSING] $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}[OK]${NC} $1 found: $(command -v "$1")"
        return 0
    fi
}

echo -e "${BOLD}[1/7] Checking system requirements...${NC}"
echo ""

MISSING=0

check_command "node" || MISSING=1
check_command "npm" || MISSING=1
check_command "python3" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
    echo ""
    echo -e "${RED}Missing required software. Please install:${NC}"
    echo "  - Node.js 20+ : https://nodejs.org/"
    echo "  - Python 3.11+ : https://python.org/"
    echo ""
    exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. Found: $(node -v)${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}[2/7] Setting up environment configuration...${NC}"
echo ""

cd "$PROJECT_DIR"

if [ ! -f ".env" ]; then
    cp standalone/.env.example .env
    echo -e "${YELLOW}Created .env file from template${NC}"
    echo -e "${YELLOW}Please edit .env with your API keys before starting CYRUS${NC}"
else
    echo -e "${GREEN}[OK]${NC} .env file already exists"
fi

echo ""
echo -e "${BOLD}[3/7] Installing Node.js dependencies...${NC}"
echo ""

npm install

echo ""
echo -e "${BOLD}[4/7] Installing Python dependencies...${NC}"
echo ""

if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "Created Python virtual environment"
fi

source .venv/bin/activate 2>/dev/null || . .venv/bin/activate 2>/dev/null || true

pip install --quiet numpy scipy scikit-learn networkx matplotlib pandas mmh3 nltk 2>/dev/null || {
    echo -e "${YELLOW}[WARN] Some Python packages failed to install. Quantum AI features may be limited.${NC}"
}

echo ""
echo -e "${BOLD}[5/7] Checking PostgreSQL...${NC}"
echo ""

if command -v psql &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} PostgreSQL client found"
elif command -v docker &> /dev/null; then
    echo -e "${GREEN}[OK]${NC} Docker found - can use Docker Compose for PostgreSQL"
    echo "  Run: cd standalone && docker compose up -d postgres"
else
    echo -e "${YELLOW}[WARN] No PostgreSQL or Docker found${NC}"
    echo "  Options:"
    echo "  1. Install PostgreSQL: https://www.postgresql.org/download/"
    echo "  2. Use Docker: https://docs.docker.com/get-docker/"
    echo "  3. Use a hosted database (Neon, Supabase, etc.)"
    echo "  Set DATABASE_URL in .env to your connection string"
fi

echo ""
echo -e "${BOLD}[6/7] Building frontend...${NC}"
echo ""

npm run build

echo ""
echo -e "${BOLD}[7/7] Setting up database schema...${NC}"
echo ""

if grep -q "sk-your-openai" .env 2>/dev/null; then
    echo -e "${YELLOW}[SKIP] Database setup skipped - configure .env first${NC}"
    echo "  Edit .env with your DATABASE_URL, then run: npm run db:push"
else
    if [ -n "$DATABASE_URL" ] || grep -q "DATABASE_URL=" .env 2>/dev/null; then
        export $(grep -v '^#' .env | xargs) 2>/dev/null || true
        if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "postgresql://cyrus:cyrus_secure_password@localhost:5432/cyrus" ]; then
            npx drizzle-kit push --force 2>/dev/null && echo -e "${GREEN}[OK]${NC} Database schema synced" || {
                echo -e "${YELLOW}[WARN] Database push failed. Make sure PostgreSQL is running and DATABASE_URL is correct${NC}"
            }
        else
            echo -e "${YELLOW}[SKIP] Using default DATABASE_URL - make sure PostgreSQL is running${NC}"
        fi
    fi
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║   ${GREEN}${BOLD}Installation Complete${NC}${CYAN}                               ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo "  1. Edit .env with your API keys:"
echo "     - OPENAI_API_KEY (required)"
echo "     - DATABASE_URL (required)"
echo "     - ELEVENLABS_API_KEY (optional, for voice)"
echo ""
echo "  2. Start PostgreSQL (if not running):"
echo "     Option A: cd standalone && docker compose up -d postgres"
echo "     Option B: Use your own PostgreSQL instance"
echo ""
echo "  3. Push database schema:"
echo "     npm run db:push"
echo ""
echo "  4. Start CYRUS:"
echo "     npm run start:standalone"
echo ""
echo "  Or use Docker Compose for everything:"
echo "     cd standalone && docker compose up -d"
echo ""
echo -e "${CYAN}CYRUS will be available at: http://localhost:5000${NC}"
echo ""
