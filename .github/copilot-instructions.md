# CYRUS AI System — GitHub Copilot Instructions

## Project Overview
CYRUS is an advanced AI cybernetic system. It is a full-stack TypeScript + Python application consisting of:
- **Node.js/TypeScript backend** (`server/`) — Express API, authentication, intelligence routes, trading, drones, swarm, etc.
- **React/TypeScript frontend** (`client/src/`) — Vite-based SPA with pages for Modules, Trading, Drones, Medical, Swarm, and more.
- **Python AI microservice** (`cyrus-ai/`) — FastAPI service for brain, memory, planning, autonomy, multi-agent orchestration.
- **Shared types** (`shared/`) — TypeScript types used by both client and server.
- **Standalone adapter** (`standalone/`) — Auth adapter and standalone utilities.

## Key Directories
```
/
├── client/src/          # React frontend (pages, components, hooks, contexts)
├── server/              # Express backend (routes, services, AI modules)
│   ├── index.ts         # Main server entry point
│   ├── trading/         # Alpaca trading integration
│   ├── swarm/           # Swarm/drone intelligence
│   ├── platform/        # Platform routes (HITL, audit, lockdown)
│   └── intelligence/    # Intelligence/memory/cognitive routes
├── cyrus-ai/            # Python FastAPI AI microservice
│   ├── api.py           # FastAPI entry point
│   ├── brain.py         # GPT-4o-mini reasoning core
│   ├── agents/          # Multi-agent system (Commander, MemoryAgent, etc.)
│   └── ...
├── shared/              # Shared TypeScript schema/types
├── standalone/          # Auth adapter, standalone utilities
├── .vscode/             # VSCode workspace settings, launch, tasks
└── package.json         # Node project root
```

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter (routing)
- **Backend**: Node.js, Express, TypeScript, tsx, Drizzle ORM, PostgreSQL
- **AI Microservice**: Python 3.11, FastAPI, OpenAI GPT-4o-mini, Redis (optional)
- **Auth**: express-session with CSRF synchronizer tokens, Passport.js
- **Deployment**: Docker, Railway, Replit, GitHub Actions

## Running the Project
```bash
# Install dependencies
npm install

# Start the development server (serves both API and client)
npm run dev

# Build for production
npm run build

# Type-check
npm run typecheck
```

## Environment
Copy `.env.example` to `.env` and fill in required keys:
- `OPENAI_API_KEY` — for AI features (optional; falls back to in-memory mode)
- `DATABASE_URL` — PostgreSQL connection (optional; falls back to in-memory)
- `SESSION_SECRET` — required for auth sessions
- `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` — for trading (optional; uses simulation)

## Important Conventions
- All API routes are prefixed with `/api/`
- Auth is required on all `/api/*` routes except `/api/login`, `/api/logout`, `/api/auth/user`, `/api/csrf-token`
- CSRF tokens are required for all state-changing requests (POST/PUT/DELETE)
- Python microservice runs on port 8001; Node server proxies `/api/brain/*` and related routes to it
- TypeScript strict mode is enabled
- Use relative imports for `shared/` types in both client and server
