# CYRUS v3.0 - Standalone Deployment Guide

## Cybernetic Yielding Robust Unified System
### OMEGA-TIER Quantum Artificial Intelligence

---

## Quick Start (Docker)

The fastest way to run CYRUS independently:

```bash
# 1. Clone or download the project
git clone <your-repo-url> cyrus
cd cyrus

# 2. Configure environment
cp standalone/.env.example .env
# Edit .env with your OPENAI_API_KEY

# 3. Launch with Docker Compose
cd standalone
docker compose up -d

# CYRUS is now running at http://localhost:5000
```

---

## Manual Installation

### Prerequisites

| Software | Version | Required |
|----------|---------|----------|
| Node.js | 20+ | Yes |
| npm | 9+ | Yes |
| Python | 3.11+ | Yes |
| PostgreSQL | 15+ | Yes |

### Step 1: Install Dependencies

```bash
# Run the automated installer
bash standalone/install.sh
```

Or manually:

```bash
# Node.js dependencies
npm install

# Python dependencies (for Quantum AI Core)
python3 -m venv .venv
source .venv/bin/activate
pip install numpy scipy scikit-learn networkx matplotlib pandas mmh3 nltk
```

### Step 2: Configure Environment

```bash
cp standalone/.env.example .env
```

Edit `.env` with your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o |
| `ELEVENLABS_API_KEY` | No | ElevenLabs key for voice synthesis |
| `GOOGLE_MAPS_API_KEY` | No | Google Maps for navigation |
| `GOOGLE_GEOCODING_API_KEY` | No | Google Geocoding API |
| `GOOGLE_GEOLOCATION_API_KEY` | No | Google Geolocation API |
| `NEWS_API_KEY` | No | News API for news features |
| `SESSION_SECRET` | No | Custom session secret (auto-generated if empty) |
| `ADMIN_ACCESS_CODE` | No | Admin login code (default: 71580019) |
| `USER_ACCESS_CODE` | No | User login code (default: 170392) |
| `ADMIN_USERNAME` | No | Admin username (default: DELTA UNIFORM 00) |

### Step 3: Setup PostgreSQL

**Option A: Docker (recommended)**
```bash
cd standalone
docker compose up -d postgres
```

**Option B: Local PostgreSQL**
```bash
createdb cyrus
# Set DATABASE_URL=postgresql://user:password@localhost:5432/cyrus in .env
```

**Option C: Hosted Database**
Use any PostgreSQL provider (Neon, Supabase, Railway, etc.) and set the connection URL in `.env`.

### Step 4: Initialize Database Schema

```bash
# Load environment variables
export $(grep -v '^#' .env | xargs)

# Push schema to database
npx drizzle-kit push
```

### Step 5: Build Frontend

```bash
npm run build
```

### Step 6: Start CYRUS

```bash
npm run start:standalone
```

CYRUS will be available at `http://localhost:5000`

---

## Docker Deployment

### Full Stack with Docker Compose

```bash
cd standalone

# Start everything (PostgreSQL + CYRUS)
docker compose up -d

# View logs
docker compose logs -f cyrus

# Stop
docker compose down

# Stop and remove data
docker compose down -v
```

### Build Docker Image Only

```bash
docker build -f standalone/Dockerfile -t cyrus:latest .
```

### Run with External Database

```bash
docker run -d \
  --name cyrus \
  -p 5000:5000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/cyrus" \
  -e OPENAI_API_KEY="sk-..." \
  -e NODE_ENV=production \
  cyrus:latest
```

---

## Cloud Deployment

### AWS / GCP / Azure VM

1. Provision a VM (2+ vCPU, 4+ GB RAM recommended)
2. Install Node.js 20+ and Python 3.11+
3. Clone the project
4. Run `bash standalone/install.sh`
5. Configure `.env`
6. Start with: `npm run start:standalone`
7. Use a reverse proxy (nginx/caddy) for HTTPS

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

### Process Manager (systemd)

Create `/etc/systemd/system/cyrus.service`:

```ini
[Unit]
Description=CYRUS v3.0 Humanoid AI System
After=network.target postgresql.service

[Service]
Type=simple
User=cyrus
WorkingDirectory=/opt/cyrus
EnvironmentFile=/opt/cyrus/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cyrus
sudo systemctl start cyrus
```

---

## Authentication

When running outside Replit, CYRUS uses a built-in authentication system:

- **Admin Login**: Username `DELTA UNIFORM 00`, Access Code `71580019`
- **User Login**: Any username, Access Code `170392`

Customize these in `.env`:
```
ADMIN_USERNAME=your-admin-name
ADMIN_ACCESS_CODE=your-admin-code
USER_ACCESS_CODE=your-user-code
```

---

## Architecture

```
CYRUS v3.0
├── Frontend (React + TypeScript + Vite)
│   ├── Aerospace-grade UI with Glass-Morphism
│   ├── TanStack Query for data fetching
│   ├── TensorFlow.js for client-side vision
│   └── Socket.IO client for real-time comms
│
├── Backend (Express.js + TypeScript)
│   ├── 40+ AI Modules (lazy-loaded)
│   ├── NEXUS COMMS Platform (WebRTC + Socket.IO)
│   ├── 13 Advanced Upgrade Modules
│   ├── 7 Interactive System Modules
│   ├── OpenAI GPT-4o Integration
│   └── ElevenLabs Voice Synthesis
│
├── Database (PostgreSQL + Drizzle ORM)
│   ├── Conversations & Memory
│   ├── Communication Intelligence
│   ├── User Profiles & Sessions
│   └── ML Model Tracking
│
└── Python Services
    ├── Quantum AI Bridge (port 5001)
    └── Comms ML Intelligence (port 5002)
```

### Ports

| Port | Service |
|------|---------|
| 5000 | Main CYRUS application |
| 5001 | Quantum AI Bridge (Python) |
| 5002 | Comms ML Intelligence (Python) |

---

## Troubleshooting

### Database connection failed
- Verify PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` format: `postgresql://user:password@host:5432/dbname`
- Ensure the database exists: `createdb cyrus`

### Port already in use
```bash
# Find and kill the process
lsof -i :5000
kill -9 <PID>
```

### Python modules not found
```bash
source .venv/bin/activate
pip install numpy scipy scikit-learn networkx matplotlib pandas mmh3 nltk
```

### Frontend not loading
```bash
npm run build
# Ensure dist/public/index.html exists
ls dist/public/
```

### Health check endpoints
- `http://localhost:5000/` - Main page (200)
- `http://localhost:5000/__health` - Quick health (200)
- `http://localhost:5000/health/live` - Liveness check
- `http://localhost:5000/health/ready` - Readiness check
