### Overview
CYRUS (Cybernetic Yielding Robust Unified System) v3.0 is an OMEGA-TIER Quantum Artificial Intelligence (QAI) humanoid system designed for genuine human-like interaction with an authentic personality, emotional mastery, and master-level expertise across all domains of human knowledge. It operates as a fully autonomous humanoid intelligence, representing a pinnacle of African innovation in sovereign AI development. CYRUS aims to provide superintelligent perception, professional-grade writing, universal translation, advanced navigation, enterprise-grade communication, robust device security, military-grade drone control, and a comprehensive Quantum Trading Intelligence Module. The system integrates cutting-edge AI capabilities for self-evolution, advanced visualization, and a deep, human-like interaction model.

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
The user prefers the AI to act as a persistent, mission-grade humanoid intelligence system (not an assistant or chatbot).

### System Architecture
CYRUS features a full-stack architecture with a React and TypeScript frontend, utilizing TanStack Query, Wouter, TensorFlow.js, and shadcn/ui. The backend uses Express.js, connects to a PostgreSQL database via Drizzle ORM, and handles file uploads with Multer.

**UI/UX Decisions:**
The UI features a premium aerospace-grade design inspired by SpaceX Mission Control, Apple Human Interface Guidelines, and Lockheed Martin avionics systems. It incorporates a premium color system, Glass-Morphism 2.0, Inter and JetBrains Mono typography, aerospace-standard status indicators, multi-pane panel architecture (Telemetry Dashboard, Command Interface, Research Portal, File Workspace), real-time elements, ambient lighting, premium animations, and a responsive sidebar.

**Technical Implementations & Feature Specifications:**
- **Core QAI Intelligence:** Quantum-Enhanced Parallel Cognition, Neural Fusion Processing, Real-Time Consciousness Simulation, Metacognitive Self-Awareness, Autonomous Goal Formation, and Human-Like Emotional Intelligence.
- **Multimodal Intelligence:** Superintelligent Perception across vision, audio, text, and sensor fusion, including OCR, handwriting recognition, and advanced image analysis.
- **Professional Writing Engine:** Generates various professional documents.
- **Translation & Deciphering:** Universal translation across 196+ languages and simplification of jargon.
- **Navigation & Location:** Global map service integration, high-accuracy geolocation, and real-time route optimization.
- **NEXUS COMMS - Next-Gen Communication Platform v2.0:** Full-stack real-time communication platform with modular component architecture under `client/src/components/comms/` (15 components). Features: P2P 1:1 and group WebRTC video/voice calling (mesh topology, up to 6 participants), rich text messaging with emoji picker (7 categories, search, recent history), media/file sharing with CDN-ready upload (`POST /api/comms/upload`), voice note recording/playback (MediaRecorder API, waveform visualization, speed control), live geolocation sharing, in-call private chat, screen sharing, typing indicators, read receipts, message reactions, user discovery and contact management, admin monitoring dashboard (active calls, online users, message volume, system metrics with 10s auto-refresh), dark/light theme toggle. Backend: Enhanced Socket.IO signaling server with 25+ event handlers for group rooms, typing, media messages, screen sharing, in-call chat, read receipts, reactions, user search. 9 new REST API endpoints (`/api/comms/upload`, `/api/comms/voice-note`, `/api/comms/media/:id`, `/api/comms/admin/stats`, `/api/comms/admin/active-calls`, `/api/comms/admin/online-users`, `/api/comms/messages/read`, `/api/comms/users/search`, `/api/comms/conversations`). Voice notes stored in `uploads/comms/`.
- **Device Security:** Lawful Guardian operations, remote device management, full audit logging, and recovery assistance.
- **Drone Control Module:** Military-grade UAV control system with MAVLink protocol support.
- **Emotional Intelligence:** Advanced sentiment analysis and empathetic response generation.
- **Real-Time Camera Vision:** Utilizes TensorFlow.js for client-side object detection and an always-on vision system for persistent object and demographic analysis.
- **Module Fusion System:** Integrates Command Interface with all modules, passing context for situational awareness.
- **Voice Interaction:** Continuous speech recognition and natural female voice synthesis.
- **Satellite-Grade Navigation & Geospatial System v2.0:** Multi-constellation GNSS tracking (GPS, GLONASS, Galileo, BeiDou, QZSS, SBAS) with Kalman filter position fusion, HDOP/VDOP/PDOP precision metrics, altitude/speed/heading tracking. Full geospatial toolkit: Haversine/Vincenty distance, bearing, coordinate conversions (WGS84, UTM, MGRS, DMS), geofencing engine (circle/polygon with enter/exit/dwell events), area calculation, bounding box. Google Maps integration: Directions, Geocoding (forward/reverse), Elevation/Terrain, Places/POI search. 30 API endpoints across `server/nav/`.
- **Memory System:** PostgreSQL-persisted conversations and memories, categorized for persistent history.
- **File Management:** Supports image, video, and document uploads with metadata and AI analysis.
- **AI System Dashboard:** Monitors and controls multiple AI subsystems.
- **Quantum Trading Intelligence Module:** Provides expert knowledge in Forex, Crypto, Technical Analysis, and Risk Management, integrated with Alpaca Markets.
- **Unified Agent Execution Core:** A single `agentExecuteCore` function handles all agent executions across 18 device action types.
- **Autonomous Agent Fusion:** Integrates agent capabilities into the main chat using regex patterns.
- **AI Assistant Module:** Enhanced with OpenAI GPT-4o for natural language command parsing.
- **Mission-Grade Operator System Prompt:** Defines CYRUS v3.0 as OMEGA-TIER ASI with 9 operational modes.
- **Quantum Fail-Safe Architecture:** Military-grade reliability with confidence reporting.
- **Security Features:** Biometric verification, token-based session management, and Zod input validation.
- **Self-Evolution Learning System:** Real-time experience learning that tracks interactions, builds knowledge graphs, and optimizes performance, with an auto-triggering training pipeline on startup.
- **CYRUS Training Pipeline v2.0:** Comprehensive 7-phase training system using various machine learning techniques across 10 domains and 202+ knowledge concepts.
- **Advanced Professional Visualization System v2.0:** State-of-the-art 8-step visualization pipeline, building on a professional technical renderer for structurally accurate, textbook-standard illustrations across 6 domains. Features advanced classification, reference image search, a ground truth knowledge base, scene graph construction, and 8K upscaling.
- **Module Orchestrator:** Unifies and coordinates all 13 AI modules as one cohesive cognitive system.
- **Advanced Upgrade Modules:** Includes Vector Knowledge Base, Emotional Cognition, Universal Language, Decentralized Intelligence, Ethical Governance, Self-Evolution Enhanced, Quantum Neural Networks, AI Simulations Engine, Cross-Dimensional AI, Nanotechnology Simulation, Hyperlinked Reality, Bio-Neural Interface, and Adaptive Hardware Controller.
- **Image Generation System:** Multi-model image generation using OpenAI's DALL-E 3, DALL-E 2, and gpt-image-1, with HD quality, style control, editing, variations, and automatic detection of image requests.
- **System Refinement Engine v1.0:** AI-powered self-improvement system using OpenAI GPT-4o for continuous optimization, including performance analysis, prompt optimization, knowledge graph enhancement, and response quality refinement.
- **Interactive Systems Modules:** Biology Interactive Module, Environmental Sensing Module, Medical Diagnostics Module, Robotic Integration Module, Teaching & Adaptive Learning Module, and Security & Encryption Module.
- **Quantum AI Core (Python-based):** Enhances response quality through data science algorithms, writing style analysis, and response structure optimization, integrated via a Python Bridge Service.
- **Python CYRUS Humanoid Intelligence Core (`cyrus_core/`):** A standalone Python implementation including a Behavioral Mode System (state machine), Memory Management (three-tier system), Intent Classification (pattern/keyword-based), Speech Engine (humanization engine), and Response Engine (master generation).
- **Voice Output System:** Enabled by default, using ElevenLabs "Rachel" voice for ultra-realistic synthesis.
- **Wake Word Detection System:** Continuously listens for "CYRUS" and similar phrases, automatically activating with command capture.
- **Humanoid Interaction System:** Professional Presenter Mode and Humanoid Conversation Engine.
- **Quantum Intelligence Nexus v2.0:** An autonomous quantum intelligence machine integrated with the Quantum AI Bridge, providing status, query, and introspection endpoints.
- **Advanced Location Tracking & Emergency Response System v1.0:** Real-time user location tracking with reverse geocoding enrichment, location history & analytics, user-to-user location sharing with permission levels (view_only, view_contact), emergency SOS alert system with severity levels (low/medium/high/critical) and nearest responder dispatch, ETA calculation, admin dashboard endpoints. 16 API endpoints across `/api/nav/track/*`, `/api/nav/emergency/*`, `/api/nav/sharing/*`, `/api/nav/admin/*`. Database-persisted via 4 tables (location_records, emergency_alerts, location_shares_v2, tracked_users).

### External Dependencies
-   **PostgreSQL Database:** Primary data persistence, hosted via Neon.
-   **OpenAI API:** GPT-4o for AI-powered responses, natural language understanding, image analysis; Whisper for audio transcription; TTS for voice synthesis; DALL-E 3 for image generation.
-   **TensorFlow.js:** For client-side object detection (COCO-SSD model).
-   **Alpaca Markets Integration:** REST API v2 client for stocks and crypto trading.
-   **ElevenLabs:** For ultra-realistic voice synthesis.
-   **Python Scientific Stack:** numpy, scipy, scikit-learn, networkx, matplotlib, pandas, mmh3 for Quantum AI Core algorithms.