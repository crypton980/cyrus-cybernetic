# CYRUS - Intelligent AI Companion System

### Overview
CYRUS is a full-stack intelligent AI companion system designed by Obakeng Kaelo, a Motswana innovator. It integrates multimodal capabilities including real-time camera vision, voice interaction, GPS tracking, and comprehensive memory persistence. CYRUS aims to be a mission-grade operator assistant, combining advanced AI with robust system controls for diverse applications, including quantum trading intelligence and autonomous device control. The project emphasizes African innovation and technological excellence, providing a sophisticated AI solution for personal and professional use.

### User Preferences
The user prefers detailed explanations.
The user wants iterative development.
The user prefers to be asked before making major changes.
The user wants clear error messages and responsive feedback.
The user prefers a professional and disciplined communication style from the AI.
The user wants the AI to automatically detect and route device/agent commands.
The user wants the AI to provide real-time feedback during execution.
The user wants the AI to analyze uploaded images and audio files automatically.
The user wants the AI to provide comprehensive trading knowledge and analysis.
The user prefers the AI to act as a persistent, mission-grade assistant.

### System Architecture
CYRUS features a full-stack architecture with a React and TypeScript frontend utilizing TanStack Query for data fetching, Wouter for routing, TensorFlow.js for client-side ML, and shadcn/ui for components. The backend is an Express.js server connected to a PostgreSQL database (Neon-backed) using Drizzle ORM for type-safe operations, and Multer for file uploads.

**UI/UX Decisions:**
- **Dashboard:** Clean Apple TV aesthetic with a black background, minimal and elegant design.
- **Action Buttons:** Instagram/WhatsApp-style rounded buttons with intuitive icons.
- **Chat Interface:** Modern design with blue user bubbles and glass-effect messages for CYRUS.
- **Navigation:** Horizontal "pill" navigation for desktop and a grid menu for mobile.
- **System Status:** Redesigned modal with card-based statistics and domain overviews.

**Technical Implementations & Feature Specifications:**
- **Real-Time Camera Vision:** TensorFlow.js with COCO-SSD for client-side object detection, visual overlays, video recording, and a test mode.
- **Voice Interaction:** Continuous speech recognition with echo detection, natural female voice synthesis, volume control, and interrupt commands.
- **GPS Location Tracking:** Continuous, high-accuracy geolocation with location-aware AI responses.
- **Memory System:** PostgreSQL-persisted conversations and memories, categorized by type (person, place, thing, conversation), ensuring persistent history.
- **File Management:** Supports image, video, and document uploads with metadata storage, image analysis via OpenAI Vision, and audio transcription via OpenAI Whisper.
- **AI System Dashboard:** Monitors multiple AI subsystems (FusionAI, Interactive, TorchScript, ONNX) with activation controls and real-time status indicators.
- **Quantum Trading Intelligence Module:** Provides expert-level knowledge in Forex, Crypto, Technical Analysis, Indicators, Risk Management, and Fundamental Analysis. Includes quantum-inspired market analysis, portfolio optimization, and an extensive set of trading API endpoints for market data, predictions, strategies, and autonomous trading.
- **OANDA Broker Integration:** Full REST API v20 client for live forex trading with OANDA. Supports account management, live pricing, historical candles, market/limit/stop orders, trade management, and position tracking. Environment variables: `OANDA_API_KEY`, `OANDA_ACCOUNT_ID`, `OANDA_ENVIRONMENT` (practice/live). Trading dashboard includes OANDA tab with live pricing, quick trade panel, and open trades management.
- **Alpaca Markets Integration:** Full REST API v2 client for stocks and crypto trading with Alpaca. Supports account management, real-time stock/crypto quotes, position tracking, order placement (market/limit/stop/bracket), and signal execution. Environment variables: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_ENVIRONMENT` (paper/live). Trading dashboard includes Alpaca tab with stock/crypto quotes, quick trade panel, and position management. Free paper trading account available for testing.
- **Unified Agent Execution Core:** A single `agentExecuteCore` function handles all agent executions, coordinating 18 device action types (pointer, keyboard, utility, high-level actions) through a `executeDeviceAction` function. It ensures consistent action normalization and schema alignment for all execution paths (Chat, API, Device).
- **Autonomous Agent Fusion:** Integrates agent capabilities directly into the main chat, with 11 regex patterns for automatic command detection and routing. Provides a unified response and supports voice activation for agent execution.
- **AI Assistant Module:** Enhanced with OpenAI GPT-4o for natural language command parsing, device control routes (`/api/cyrus/device/*`), and agent control routes (`/api/cyrus/agent/*`). Includes robust error handling, Zod schema validation, and task persistence in PostgreSQL.
- **Mission-Grade Operator System Prompt:** Defines CYRUS as a persistent, superintelligent hybrid AI/AGI system with operational modes (Standard, Tactical, Analytical, Perceptual, Emergency), urgency levels, and sensor awareness.
- **Security Features:** Includes biometric verification, token-based session management, Zod input validation, and file upload limits (10MB max).

**System Design Choices:**
- **Data Flow:** User input (voice, text, camera) is captured by the frontend, sent to the backend API, validated with Zod, persisted to PostgreSQL via Drizzle, and real-time UI updates are managed by TanStack Query.
- **API Design:** Comprehensive API endpoints for conversations, memories, files, trading, and agent/device control.
- **AI Integration:** Primary use of OpenAI GPT-4o for AI-powered responses, vision analysis, and contextual awareness.

### External Dependencies
- **PostgreSQL Database:** Primary data persistence, hosted via Neon.
- **OpenAI API:**
    - **GPT-4o:** For AI-powered responses, natural language understanding, and image analysis.
    - **Whisper:** For audio transcription.
- **TensorFlow.js:** For client-side object detection (COCO-SSD model).
- **MAVLink:** Future integration for drone control.
- **FusionAI Backend:** Future integration for advanced AI processing on Port 8765.