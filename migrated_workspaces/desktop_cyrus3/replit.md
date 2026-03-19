# DroneCommand AI - Military Grade Autonomous Drone Pilot System

## Overview

DroneCommand AI is a military-grade autonomous drone pilot application featuring CYRUS (Command Your Responsive Unified System) - a humanoid AI pilot. The system focuses on autonomous flight control, tactical decision-making, sensor fusion, mission execution, and emergency response, while preserving human authority for strategic and lethal decisions. It aims to provide advanced capabilities for real-time drone fleet management, intelligent mission planning, and enhanced situational awareness, ultimately transforming military and critical civilian operations like battlefield support, search & rescue, and intelligence gathering.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
DroneCommand AI is built with a React 18 frontend using TypeScript, Wouter for routing, TanStack React Query for server state, and Tailwind CSS for styling with shadcn/ui components. The backend is a Node.js Express application utilizing RESTful JSON APIs. Data storage is designed for PostgreSQL with Drizzle ORM, currently using an in-memory solution for development.

### CYRUS AI Pilot
CYRUS, the humanoid AI pilot, operates on an OODA loop (Observe, Orient, Decide, Act) architecture, emphasizing bounded autonomy and adherence to human authority. Key components include:
- **ROE Engine**: A 4-layer hierarchical Rules of Engagement system ensuring compliance.
- **Sensor Fusion**: Integrates multi-modal sensor data (AESA radar, EO/IR, SIGINT) with AI-powered vision and audio analysis for real-time situational awareness.
- **Path Planning Engine**: Employs A* pathfinding with terrain awareness, no-fly zone avoidance, and dynamic obstacle detection.
- **Adaptive Learning Engine**: Uses reinforcement learning for continuous improvement through decision outcome tracking and performance metrics.
- **Advanced Cognitive Engine**: A hybrid neural-symbolic AI with quantum-inspired probabilistic reasoning, self-improving algorithms, and built-in safety constraints.
- **Unified Integration Pipeline**: Connects sensor fusion, cognitive engine, and adaptive learning for real-time processing.
- **Device Controller**: AI assistant for natural language device control, including pointer, keyboard, and clipboard management.
- **Flight Control & Mission Commander**: Manages flight envelope, mission planning, execution, dynamic re-tasking, and abort logic.
- **Voice Drone Controller**: Parses natural language commands for drone control and GPS navigation.
- **Obstacle Avoidance System**: Detects and maneuvers around obstacles, respecting no-fly zones.
- **Autonomous Flight Engine**: Supports various mission types with waypoint navigation and multi-drone fleet management.
- **MAVLink Controller**: Facilitates real-world drone communication via MAVLink protocol, supporting various autopilots and telemetry.

### Security and Authentication
MAVLink drone control implements dual-factor authentication requiring both password and biometric face verification for critical operations. A file upload system supports various file types up to 50MB with session token authentication.

### Biometric Identification System
Captures and validates operator faces using OpenAI Vision for secure access and dual-factor authentication. Supports operator registration, verification, and management with various clearance levels.

### Autonomous AI Agent
Mimics human device interaction with natural language processing to convert commands into multi-step device actions. Provides real-time feedback via Server-Sent Events (SSE) and supports various actions like opening apps, navigating, clicking, typing, and screenshots.

### Autonomous Trading Engine
The trading system operates at two levels:

**Base Trading Engine** (`cyrus-trading-engine.ts`):
- Real-time market data for 16+ trading pairs (8 forex, 8 crypto)
- Technical indicators: RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Stochastic, ADX, OBV
- Risk management with position sizing, max drawdown limits, and trailing stops
- Trade execution with automatic stop-loss and take-profit management
- Portfolio tracking with P&L, win rate, profit factor, and Sharpe ratio
- Strategy types: scalping, swing, trend_following, mean_reversion, breakout
- Endpoints: `/api/trading/status`, `/api/trading/markets`, `/api/trading/portfolio`, `/api/trading/trades`, `/api/trading/execute`, `/api/trading/analyze`

**Autonomous AI Trading** (`cyrus-autonomous-trading.ts`):

*World Events Analyzer:*
- AI-powered analysis of global economic, political, monetary, and geopolitical events
- Event impact levels: low, medium, high, critical
- Market sentiment classification: bullish, bearish, neutral
- Affected assets tracking with market impact scores (1-100)
- GPT-4o integration for real-time event generation and analysis

*Predictive Analytics Engine:*
- Price movement forecasting for 1-hour, 4-hour, and 24-hour timeframes
- Confidence levels, direction forecasts (up/down/sideways)
- Volatility predictions (low/medium/high) and risk scores
- Support and resistance level identification
- AI-generated reasoning for each prediction

*Strategy Learning System (6 Self-Refining Strategies):*
1. **Momentum Breakout** - Enters on price breakouts with momentum confirmation
2. **Trend Rider** - Follows established trends using EMA crossovers
3. **Mean Reversion Pro** - Trades reversals from oversold/overbought conditions
4. **News Sentiment** - Trades based on real-time news and world events
5. **Hybrid Adaptive** - Combines technical, fundamental, and sentiment analysis
6. **Scalper Elite** - Quick trades capturing small price movements

Each strategy tracks: win rate, profit factor, Sharpe ratio, max drawdown, expectancy
Strategies auto-refine parameters and rule weights based on performance (10% chance per cycle)

*Autonomous Trading Loop:*
- 30-second market monitoring interval across 6 major pairs (EUR/USD, GBP/USD, USD/JPY, BTC/USD, ETH/USD, SOL/USD)
- 60% confidence threshold for trade execution
- Strategy type mapping from autonomous engine to trading engine types
- Safe division checks for risk/reward calculations
- Complete decision audit trail with reasoning and outcome tracking

*Endpoints:*
- `/api/trading/autonomous/status` - Get autonomous engine status
- `/api/trading/autonomous/events` - Get world events list
- `/api/trading/autonomous/predictions` - Get price predictions
- `/api/trading/autonomous/predict` - Generate new prediction
- `/api/trading/autonomous/strategies` - Get all strategies with performance
- `/api/trading/autonomous/refine` - Refine a specific strategy
- `/api/trading/autonomous/decisions` - Get trade decision history
- `/api/trading/autonomous/analyses` - Get market analyses
- `/api/trading/autonomous/analyze` - Analyze specific market
- `/api/trading/autonomous/start` - Start autonomous trading loop
- `/api/trading/autonomous/stop` - Stop autonomous trading loop
- `/api/trading/autonomous/outcome` - Record trade outcome for learning

All endpoints secured with `fileAuthMiddleware` requiring authentication.

### Design Software Automation
Parses natural language design requests into structured actions for various design software (e.g., Photoshop, Figma, Blender). Supports task queuing, pre-built templates, and customizable output configurations.

### Real-Time Communication System
Utilizes WebSockets for signaling and WebRTC for peer-to-peer voice/video calls, along with real-time text messaging and user presence tracking.

## External Dependencies

### Database
- **PostgreSQL**: Primary relational database.
- **Drizzle Kit**: Database schema management.

### UI Component Libraries
- **Radix UI**: Accessible component primitives.
- **shadcn/ui**: Pre-styled component library.
- **Lucide React**: Icon library.

### Data & Validation
- **Zod**: Runtime type validation.
- **drizzle-zod**: Zod schema generation for Drizzle.
- **TanStack React Query**: Server state management.

### Build & Development
- **Vite**: Frontend build tool.
- **esbuild**: Production backend bundler.
- **TypeScript**: For type safety.

### Fonts
- **IBM Plex Sans**: UI font.
- **IBM Plex Mono**: Monospace font.