# DroneCommand AI - CYRUS Local Setup Guide

## Prerequisites

Before running locally, ensure you have:
- Node.js 20+ installed
- npm or yarn package manager
- PostgreSQL database (optional, uses in-memory by default)

## Installation

1. Extract the downloaded ZIP file
2. Open terminal in the project folder
3. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Create a `.env` file in the root directory with:

```env
# Required for AI features (get from OpenAI or use Replit AI Integrations)
AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Session security
SESSION_SECRET=your_random_secret_key_here

# Optional: PostgreSQL database
DATABASE_URL=postgresql://user:password@localhost:5432/cyrus_db
```

## Running the Application

### Development Mode
```bash
npm run dev
```
The app will be available at `http://localhost:5000`

### Production Build
```bash
npm run build
npm start
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page routes
│   │   └── lib/           # Utilities
├── server/                 # Express backend
│   ├── routes.ts          # API endpoints
│   ├── cyrus-*.ts         # CYRUS AI modules
│   └── replit_integrations/  # Audio/chat features
├── shared/                 # Shared types
└── db/                     # Database schema
```

## Key Features

- **CYRUS AI Pilot**: Military-grade autonomous drone system
- **Voice Interface**: Sweet feminine voice (shimmer) with natural speech
- **Real-time Communication**: WebRTC voice/video calls
- **Autonomous Trading**: 6 self-refining trading strategies
- **Biometric Auth**: Face verification for secure access

## Creator

Obakeng Kaelo (ID: 815219119, Botswana)

## Notes

- The voice system uses OpenAI's "shimmer" voice for a sweet, human-like feminine voice
- WebRTC requires HTTPS in production for camera/microphone access
- Trading features require additional API keys for live market data
