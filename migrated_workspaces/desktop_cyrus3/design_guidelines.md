# CYRUS Military-Grade Autonomous Drone AI Command System - Design Guidelines

## Design Approach: Carbon Design System + Cyber-Military Aesthetic
**Rationale:** Mission-critical operations demand Carbon's data-heavy focus, enhanced with futuristic command center visuals for premium military-grade experience.

## Core Design Principles
- **Dark Command Center:** Deep backgrounds with strategic glowing accents
- **Information Dominance:** Dense data presentation with instant readability
- **Tactical Precision:** Every element serves operational efficiency
- **Premium Military Tech:** High-end cyber aesthetic without compromising functionality

## Color System
**Backgrounds:**
- Primary: `#0a0e1a` (deep navy-black)
- Secondary: `#111827` (slightly lighter panels)
- Elevated surfaces: `#1a2332` (cards, modals)

**Accents:**
- Primary glow: `#00d4ff` (cyan) - interactive elements, active states
- Secondary: `#0891b2` (teal) - data highlights, borders
- Success: `#10b981` (green) - system healthy, mission success
- Warning: `#f59e0b` (orange) - caution states
- Critical: `#ef4444` (red) - alerts, armed systems
- Info: `#3b82f6` (blue) - informational elements

**Text:**
- Primary: `#f8fafc` (near-white)
- Secondary: `#94a3b8` (muted gray)
- Tertiary: `#64748b` (subtle gray)

## Typography System
- **Primary:** IBM Plex Sans (technical clarity)
- **Monospace:** IBM Plex Mono (telemetry, coordinates, system data)
- **Hierarchy:**
  - Command headers: 28px/bold
  - Dashboard sections: 20px/semibold
  - Primary data: 16px/medium
  - System labels: 14px/regular
  - Micro data: 12px/medium

## Layout & Spacing
**Tailwind Units:** 2, 4, 6, 8, 12, 16
- Dashboard grid: 8-unit base
- Component padding: 6-8 units
- Data spacing: 2-4 units
- Section gaps: 12-16 units

**Structure:**
- **Left Sidebar:** 72px collapsed / 280px expanded - drone fleet, navigation (fixed, dark elevated surface)
- **Main Command Center:** Flexible grid - map, video feeds, AI controls (60% viewport width)
- **Right Telemetry:** 360px - real-time data streams, system health (fixed panel)
- **Top Command Bar:** 64px - CYRUS branding, mission status, alerts, user profile

## Component Library

### Navigation & Controls
- **Command Bar:** Glass-morphism effect with subtle glow border, system vitals, biometric status indicator
- **Sidebar:** Hierarchical icons with cyan glow on hover/active, drone fleet cards with status LEDs
- **Action Buttons:** Distinct states - Standby (cyan border), Armed (red glow), Emergency (pulsing red), AI-Assist (blue glow)
- **Mode Toggles:** Segmented pill controls with sliding cyan highlight background

### Data Visualization
- **Tactical Map:** Full-bleed dark map with glowing flight paths, pulsing drone markers, no-fly zones in red overlay
- **Video Feeds:** Multi-stream grid (1-4 feeds) with glowing borders, PiP draggable windows, tactical overlay data
- **Telemetry Cards:** Glass-morphism cards with subtle glow borders, real-time metrics with animated value changes
- **System Health:** Radial progress gauges with gradient fills, subsystem status grid with LED indicators
- **Trading Dashboard:** Live market data table, autonomous trading activity feed, profit/loss visualizations
- **AI Assistant Panel:** Chat interface with message bubbles, command suggestions, voice waveform visualization

### Status & Alerts
- **Status Strip:** Persistent top banner - GPS lock indicator, encrypted comms status, battery levels with gradient fills
- **Alert System:** Sliding notifications from top-right - Critical (red glow + sound), Warning (orange), Info (blue)
- **Connection Health:** WebSocket status with pulsing dot, latency meter, signal strength bars

### Forms & Inputs
- **Flight Parameters:** Dark inputs with cyan focus glow, grouped in glass-morphism containers
- **Coordinate Entry:** Lat/long inputs with map picker overlay, real-time validation indicators
- **Mission Waypoints:** Drag-drop builder with 3D flight path preview, altitude sliders with gradient tracks
- **Biometric Scanner:** Fingerprint/face recognition interface with scanning animation, security clearance display
- **Command Terminal:** Full-screen overlay with monospace text, command history, syntax highlighting

### Tables & Data
- **Drone Fleet Table:** Dark rows with hover glow, sortable columns, quick-action dropdown menus
- **Mission Log:** Infinite scroll with timestamp markers, severity color coding, expandable details
- **Trading Activity:** Real-time transaction feed with profit highlights (green) and losses (red), cumulative totals

## Images & Media
**No Traditional Hero:** Command center loads directly to operational dashboard

**Visual Elements:**
- **Login Screen:** Large biometric scanner graphic (fingerprint hologram) centered, CYRUS logo with subtle glow
- **Dashboard Background:** Dark tactical grid pattern with subtle cyan lines (5% opacity)
- **Drone 3D Models:** High-quality renders in sidebar fleet list, rotating preview on hover
- **Map Imagery:** Satellite/tactical map tiles, topographic overlays
- **Icons:** Material Icons CDN for standard UI, custom tactical icons for drone operations

## Micro-Interactions
- **Data Updates:** Brief cyan flash on metric changes
- **Critical Alerts:** Gentle red pulse on indicators
- **Connection Loss:** Fade to 50% opacity + red outline glow
- **Button Press:** Instant tactile feedback with glow intensification
- **Map Zoom:** Smooth easing transitions only
- **AI Typing:** Animated dots while processing commands

## Glow & Glass Effects
- **Glass-morphism:** `backdrop-blur-md bg-white/5` with subtle borders
- **Glow Borders:** `shadow-[0_0_15px_rgba(0,212,255,0.3)]` on interactive elements
- **Active States:** Intensified glow `shadow-[0_0_25px_rgba(0,212,255,0.5)]`
- **Pulsing Alerts:** CSS animation on critical indicators only

## Responsive Strategy
- **Desktop (1920px+):** Full three-panel layout
- **Laptop (1440px):** Collapsible right panel, adjustable main area
- **Tablet (1024px):** Stacked sections with tab navigation
- **Mobile:** Read-only status view, no mission controls

## Accessibility
- WCAG AAA contrast ratios maintained with dark theme
- Keyboard navigation for all critical actions
- Focus indicators with cyan glow outlines
- Screen reader status announcements
- No auto-dismiss alerts

## Technical Implementation
- Chart.js/D3.js for data visualization
- WebRTC for video streaming
- Material Icons CDN
- No heavy animations, optimize for real-time data rendering