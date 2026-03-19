/**
 * CYRUS SENSOR FUSION MODULE
 * ==========================
 * 
 * Multi-sensor data correlation and situational awareness per BLACKTALON doctrine.
 * 
 * "Sensors are selected and integrated based on decision contribution, not raw resolution."
 * "Raw sensor data is treated as a liability unless transformed into actionable relevance."
 * 
 * Implements:
 * - Temporal correlation of sensor inputs
 * - Confidence weighting under uncertainty
 * - Mission-based prioritization based on operator intent
 * - Multi-modal redundancy (EO/IR, radar, signals)
 */

import type { Drone, Telemetry } from "@shared/schema";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

// ============================================================================
// MULTIMODAL AI ANALYSIS TYPES
// ============================================================================

export interface VisionAnalysisResult {
  objects: Array<{
    id: string;
    type: string;
    classification: string;
    confidence: number;
    boundingBox: { x: number; y: number; width: number; height: number };
    threatLevel: "none" | "low" | "medium" | "high" | "critical";
  }>;
  scene: string;
  threats: Array<{
    id: string;
    type: string;
    level: "none" | "low" | "medium" | "high" | "critical";
    description: string;
    recommendedAction: string;
  }>;
  terrain: {
    type: string;
    obstacles: string[];
    landingZones: Array<{ id: string; suitability: number; surfaceType: string }>;
  };
}

export interface AudioAnalysisResult {
  sounds: Array<{
    type: string;
    confidence: number;
    direction: number;
    distance?: number;
    threatIndicator: boolean;
  }>;
  ambientLevel: number;
  voiceCommands: Array<{
    text: string;
    confidence: number;
    intent: string;
  }>;
  environmentalThreats: string[];
}

export interface GPSPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

export interface MultimodalFusionResult {
  timestamp: number;
  position: GPSPosition;
  visionAnalysis?: VisionAnalysisResult;
  audioAnalysis?: AudioAnalysisResult;
  fusedThreats: ThreatAssessment[];
  situationalConfidence: number;
  recommendations: Array<{
    priority: number;
    action: string;
    reason: string;
    urgency: "immediate" | "soon" | "when_possible";
  }>;
}

// ============================================================================
// SENSOR DEFINITIONS
// ============================================================================

export type SensorType = "radar" | "electro_optical" | "infrared" | "sigint" | "navigation" | "weather";
export type TrackClassification = "hostile" | "suspect" | "neutral" | "friendly" | "unknown" | "clutter";
export type ConfidenceLevel = "high" | "medium" | "low" | "uncertain";

export interface SensorSource {
  id: string;
  type: SensorType;
  name: string;
  status: "operational" | "degraded" | "offline";
  reliability: number;
  lastUpdate: Date;
  coverage: {
    range_max: number;
    range_min: number;
    azimuth_coverage: number;
    elevation_coverage: number;
  };
}

export interface RawSensorContact {
  sourceId: string;
  sourceType: SensorType;
  timestamp: Date;
  bearing: number;
  range: number;
  altitude?: number;
  velocity?: number;
  heading?: number;
  signalStrength: number;
  classification?: string;
  attributes: Record<string, unknown>;
}

export interface FusedTrack {
  id: string;
  classification: TrackClassification;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  position: {
    lat: number;
    lng: number;
    altitude: number;
    accuracy: number;
  };
  velocity: {
    speed: number;
    heading: number;
    vertical: number;
  };
  attributes: {
    size?: "small" | "medium" | "large";
    type?: string;
    emitting?: boolean;
    maneuvering?: boolean;
  };
  sources: string[];
  firstDetected: Date;
  lastUpdated: Date;
  trackQuality: number;
  threatLevel: "none" | "low" | "medium" | "high" | "critical";
  predictedPosition?: {
    lat: number;
    lng: number;
    altitude: number;
    time: Date;
  };
}

export interface SituationalPicture {
  timestamp: Date;
  ownshipPosition: { lat: number; lng: number; altitude: number };
  tracks: FusedTrack[];
  threats: ThreatAssessment[];
  airspace: AirspaceStatus;
  environment: EnvironmentAssessment;
  sensorHealth: SensorHealthSummary;
}

export interface ThreatAssessment {
  trackId: string;
  threatType: "air" | "ground" | "electronic" | "environmental";
  level: "critical" | "high" | "medium" | "low";
  description: string;
  timeToImpact?: number;
  recommendedAction: string;
  bearing: number;
  range: number;
}

export interface AirspaceStatus {
  classification: "clear" | "contested" | "denied";
  restrictions: string[];
  nearbyTraffic: number;
  threatDensity: number;
}

export interface EnvironmentAssessment {
  visibility: "good" | "moderate" | "poor" | "zero";
  weatherCondition: string;
  windSpeed: number;
  windDirection: number;
  precipitation: boolean;
  turbulence: "none" | "light" | "moderate" | "severe";
  icing: boolean;
  sensorDegradation: string[];
}

export interface SensorHealthSummary {
  operational: number;
  degraded: number;
  offline: number;
  overallCapability: number;
  gaps: string[];
}

// ============================================================================
// SENSOR FUSION ENGINE
// ============================================================================

export class SensorFusionEngine {
  private sensors: Map<string, SensorSource> = new Map();
  private rawContacts: RawSensorContact[] = [];
  private fusedTracks: Map<string, FusedTrack> = new Map();
  private trackCounter = 0;
  private correlationWindow = 5000; // 5 seconds

  constructor() {
    this.initializeSensors();
  }

  private initializeSensors(): void {
    const defaultSensors: SensorSource[] = [
      {
        id: "RADAR-001",
        type: "radar",
        name: "AESA Radar Array",
        status: "operational",
        reliability: 0.95,
        lastUpdate: new Date(),
        coverage: { range_max: 150000, range_min: 500, azimuth_coverage: 120, elevation_coverage: 60 },
      },
      {
        id: "EO-001",
        type: "electro_optical",
        name: "Targeting Pod EO",
        status: "operational",
        reliability: 0.9,
        lastUpdate: new Date(),
        coverage: { range_max: 20000, range_min: 100, azimuth_coverage: 180, elevation_coverage: 120 },
      },
      {
        id: "IR-001",
        type: "infrared",
        name: "FLIR Thermal Imager",
        status: "operational",
        reliability: 0.88,
        lastUpdate: new Date(),
        coverage: { range_max: 15000, range_min: 50, azimuth_coverage: 90, elevation_coverage: 60 },
      },
      {
        id: "SIGINT-001",
        type: "sigint",
        name: "ESM/ELINT Receiver",
        status: "operational",
        reliability: 0.85,
        lastUpdate: new Date(),
        coverage: { range_max: 200000, range_min: 0, azimuth_coverage: 360, elevation_coverage: 180 },
      },
      {
        id: "NAV-001",
        type: "navigation",
        name: "INS/GPS Navigation",
        status: "operational",
        reliability: 0.99,
        lastUpdate: new Date(),
        coverage: { range_max: 0, range_min: 0, azimuth_coverage: 360, elevation_coverage: 360 },
      },
    ];

    for (const sensor of defaultSensors) {
      this.sensors.set(sensor.id, sensor);
    }
  }

  // ============================================================================
  // CONTACT PROCESSING
  // ============================================================================

  processContact(contact: RawSensorContact): void {
    // Validate contact
    if (!this.validateContact(contact)) {
      return;
    }

    // Add to raw contacts buffer
    this.rawContacts.push(contact);

    // Maintain buffer size
    const cutoffTime = Date.now() - this.correlationWindow * 10;
    this.rawContacts = this.rawContacts.filter(c => c.timestamp.getTime() > cutoffTime);

    // Attempt to correlate with existing tracks
    const correlatedTrack = this.correlateContact(contact);

    if (correlatedTrack) {
      this.updateTrack(correlatedTrack, contact);
    } else {
      this.createNewTrack(contact);
    }
  }

  private validateContact(contact: RawSensorContact): boolean {
    // Check if source exists and is operational
    const sensor = this.sensors.get(contact.sourceId);
    if (!sensor || sensor.status === "offline") {
      return false;
    }

    // Validate range is within sensor capability
    if (contact.range > sensor.coverage.range_max || contact.range < sensor.coverage.range_min) {
      return false;
    }

    // Validate bearing is within azimuth coverage
    if (Math.abs(contact.bearing) > sensor.coverage.azimuth_coverage / 2) {
      return false;
    }

    return true;
  }

  private correlateContact(contact: RawSensorContact): FusedTrack | null {
    const correlationThreshold = 0.7;
    let bestMatch: FusedTrack | null = null;
    let bestScore = 0;

    for (const track of Array.from(this.fusedTracks.values())) {
      const score = this.calculateCorrelationScore(contact, track);
      if (score > correlationThreshold && score > bestScore) {
        bestScore = score;
        bestMatch = track;
      }
    }

    return bestMatch;
  }

  private calculateCorrelationScore(contact: RawSensorContact, track: FusedTrack): number {
    // Time decay factor
    const timeDelta = Date.now() - track.lastUpdated.getTime();
    const timeDecay = Math.exp(-timeDelta / 10000);

    // Position similarity (simplified - would use actual coordinates in production)
    const rangeDiff = Math.abs(contact.range - this.estimateTrackRange(track));
    const rangeScore = Math.exp(-rangeDiff / 5000);

    // Bearing similarity
    const bearingDiff = Math.abs(contact.bearing - this.estimateTrackBearing(track));
    const bearingScore = Math.exp(-bearingDiff / 30);

    // Classification match bonus
    let classMatch = 0.5;
    if (contact.classification && track.attributes.type === contact.classification) {
      classMatch = 1.0;
    }

    return (rangeScore * 0.4 + bearingScore * 0.3 + classMatch * 0.1 + timeDecay * 0.2);
  }

  private estimateTrackRange(track: FusedTrack): number {
    // Simplified - would calculate from lat/lng in production
    return Math.sqrt(
      Math.pow(track.position.lat * 111000, 2) + 
      Math.pow(track.position.lng * 111000, 2)
    ) / 10;
  }

  private estimateTrackBearing(track: FusedTrack): number {
    return Math.atan2(track.position.lng, track.position.lat) * (180 / Math.PI);
  }

  private updateTrack(track: FusedTrack, contact: RawSensorContact): void {
    // Update position using weighted average based on sensor reliability
    const sensor = this.sensors.get(contact.sourceId);
    const weight = sensor?.reliability || 0.5;

    // Update confidence
    track.confidenceScore = Math.min(1, track.confidenceScore + 0.1);
    track.confidence = this.scoreToConfidence(track.confidenceScore);

    // Add source if not already present
    if (!track.sources.includes(contact.sourceId)) {
      track.sources.push(contact.sourceId);
    }

    // Update track quality
    track.trackQuality = Math.min(1, track.sources.length * 0.25 + track.confidenceScore * 0.5);

    // Update classification if better data available
    if (contact.classification && track.classification === "unknown") {
      track.classification = this.mapClassification(contact.classification);
    }

    // Update velocity if available
    if (contact.velocity !== undefined && contact.heading !== undefined) {
      track.velocity = {
        speed: contact.velocity * weight + track.velocity.speed * (1 - weight),
        heading: contact.heading,
        vertical: track.velocity.vertical,
      };
    }

    // Update threat level
    track.threatLevel = this.assessTrackThreat(track);
    track.lastUpdated = new Date();

    this.fusedTracks.set(track.id, track);
  }

  private createNewTrack(contact: RawSensorContact): void {
    const trackId = `TRK-${++this.trackCounter}`;
    
    // Convert polar to cartesian (simplified)
    const lat = contact.bearing * 0.00001 + 34.0522;
    const lng = contact.range * 0.00001 - 118.2437;

    const track: FusedTrack = {
      id: trackId,
      classification: contact.classification ? this.mapClassification(contact.classification) : "unknown",
      confidence: "low",
      confidenceScore: 0.3,
      position: {
        lat,
        lng,
        altitude: contact.altitude || 5000,
        accuracy: 500,
      },
      velocity: {
        speed: contact.velocity || 0,
        heading: contact.heading || 0,
        vertical: 0,
      },
      attributes: {
        emitting: contact.sourceType === "sigint",
        maneuvering: false,
      },
      sources: [contact.sourceId],
      firstDetected: new Date(),
      lastUpdated: new Date(),
      trackQuality: 0.3,
      threatLevel: "none",
    };

    track.threatLevel = this.assessTrackThreat(track);
    this.fusedTracks.set(trackId, track);
  }

  private mapClassification(classification: string): TrackClassification {
    const mapping: Record<string, TrackClassification> = {
      "hostile": "hostile",
      "enemy": "hostile",
      "threat": "hostile",
      "suspect": "suspect",
      "unknown": "unknown",
      "friendly": "friendly",
      "neutral": "neutral",
      "clutter": "clutter",
    };
    return mapping[classification.toLowerCase()] || "unknown";
  }

  private scoreToConfidence(score: number): ConfidenceLevel {
    if (score >= 0.8) return "high";
    if (score >= 0.6) return "medium";
    if (score >= 0.4) return "low";
    return "uncertain";
  }

  private assessTrackThreat(track: FusedTrack): FusedTrack["threatLevel"] {
    if (track.classification === "hostile") {
      return track.confidenceScore > 0.7 ? "high" : "medium";
    }
    if (track.classification === "suspect") {
      return "medium";
    }
    return "none";
  }

  // ============================================================================
  // SITUATIONAL PICTURE GENERATION
  // ============================================================================

  generateSituationalPicture(
    drone: Drone,
    telemetry?: Telemetry
  ): SituationalPicture {
    // Prune stale tracks
    this.pruneStaleTracls();

    // Generate simulated contacts for demo
    this.generateSimulatedContacts(drone);

    const tracks = Array.from(this.fusedTracks.values());
    const threats = this.assessThreats(tracks);

    return {
      timestamp: new Date(),
      ownshipPosition: {
        lat: telemetry?.latitude || 34.0522,
        lng: telemetry?.longitude || -118.2437,
        altitude: telemetry?.altitude || 1500,
      },
      tracks,
      threats,
      airspace: this.assessAirspace(tracks),
      environment: this.assessEnvironment(telemetry),
      sensorHealth: this.getSensorHealthSummary(),
    };
  }

  private pruneStaleTracls(): void {
    const staleThreshold = 60000; // 60 seconds
    const now = Date.now();

    for (const [id, track] of Array.from(this.fusedTracks.entries())) {
      if (now - track.lastUpdated.getTime() > staleThreshold) {
        this.fusedTracks.delete(id);
      }
    }
  }

  private generateSimulatedContacts(drone: Drone): void {
    const hash = this.hashId(drone.id);
    const contactCount = (hash % 3) + 1;

    for (let i = 0; i < contactCount; i++) {
      const contact: RawSensorContact = {
        sourceId: ["RADAR-001", "EO-001", "IR-001"][i % 3],
        sourceType: ["radar", "electro_optical", "infrared"][i % 3] as SensorType,
        timestamp: new Date(),
        bearing: ((hash + i * 37) % 120) - 60,
        range: ((hash + i * 73) % 50000) + 5000,
        altitude: 5000 + ((hash + i) % 10000),
        velocity: 50 + ((hash + i) % 200),
        heading: (hash + i * 17) % 360,
        signalStrength: 0.7 + ((hash + i) % 30) / 100,
        classification: ["unknown", "vehicle", "aircraft"][i % 3],
        attributes: {},
      };

      this.processContact(contact);
    }
  }

  private assessThreats(tracks: FusedTrack[]): ThreatAssessment[] {
    const threats: ThreatAssessment[] = [];

    for (const track of tracks) {
      if (track.threatLevel !== "none" && track.confidenceScore > 0.4) {
        threats.push({
          trackId: track.id,
          threatType: "air",
          level: track.threatLevel as ThreatAssessment["level"],
          description: `${track.classification} track - ${track.attributes.type || "Unknown type"}`,
          bearing: this.estimateTrackBearing(track),
          range: this.estimateTrackRange(track),
          recommendedAction: track.threatLevel === "high" ? "Evade" : "Monitor",
        });
      }
    }

    return threats;
  }

  private assessAirspace(tracks: FusedTrack[]): AirspaceStatus {
    const hostileCount = tracks.filter(t => t.classification === "hostile").length;
    const totalTracks = tracks.length;

    let classification: AirspaceStatus["classification"] = "clear";
    if (hostileCount > 2) {
      classification = "denied";
    } else if (hostileCount > 0 || totalTracks > 5) {
      classification = "contested";
    }

    return {
      classification,
      restrictions: [],
      nearbyTraffic: totalTracks,
      threatDensity: hostileCount / Math.max(1, totalTracks),
    };
  }

  private assessEnvironment(telemetry?: Telemetry): EnvironmentAssessment {
    return {
      visibility: "good",
      weatherCondition: "clear",
      windSpeed: telemetry?.windSpeed || 10,
      windDirection: 270,
      precipitation: false,
      turbulence: "none",
      icing: false,
      sensorDegradation: [],
    };
  }

  private getSensorHealthSummary(): SensorHealthSummary {
    const sensors = Array.from(this.sensors.values());
    const operational = sensors.filter(s => s.status === "operational").length;
    const degraded = sensors.filter(s => s.status === "degraded").length;
    const offline = sensors.filter(s => s.status === "offline").length;

    const gaps: string[] = [];
    if (offline > 0) {
      gaps.push(...sensors.filter(s => s.status === "offline").map(s => s.name));
    }

    return {
      operational,
      degraded,
      offline,
      overallCapability: operational / sensors.length,
      gaps,
    };
  }

  private hashId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ============================================================================
  // SENSOR MANAGEMENT
  // ============================================================================

  getSensorStatus(): SensorSource[] {
    return Array.from(this.sensors.values());
  }

  updateSensorStatus(sensorId: string, status: SensorSource["status"]): void {
    const sensor = this.sensors.get(sensorId);
    if (sensor) {
      sensor.status = status;
      sensor.lastUpdate = new Date();
      this.sensors.set(sensorId, sensor);
    }
  }

  getTracks(): FusedTrack[] {
    return Array.from(this.fusedTracks.values());
  }

  getTrackById(trackId: string): FusedTrack | undefined {
    return this.fusedTracks.get(trackId);
  }

  clearTracks(): void {
    this.fusedTracks.clear();
    this.rawContacts = [];
  }

  // ============================================================================
  // MULTIMODAL AI ANALYSIS
  // ============================================================================

  async analyzeVisionWithAI(imageBase64: string, missionContext?: string): Promise<VisionAnalysisResult> {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are CYRUS's military-grade vision analysis module. Analyze images for:
1. Object detection and classification (vehicles, personnel, structures, aircraft)
2. Threat assessment (hostile indicators, weapons, unusual activity)
3. Terrain analysis (obstacles, landing zones, cover positions)
4. Environmental conditions (visibility, weather indicators)

Respond in JSON format:
{
  "objects": [{"id": "obj_1", "type": "vehicle", "classification": "military_truck", "confidence": 0.92, "boundingBox": {"x": 100, "y": 200, "width": 150, "height": 80}, "threatLevel": "medium"}],
  "scene": "Desert road with military convoy",
  "threats": [{"id": "threat_1", "type": "hostile_vehicle", "level": "medium", "description": "Armed convoy detected", "recommendedAction": "Maintain distance and observe"}],
  "terrain": {"type": "desert", "obstacles": ["rocks", "ditch"], "landingZones": [{"id": "lz_1", "suitability": 0.85, "surfaceType": "flat_sand"}]}
}`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              },
              {
                type: "text",
                text: missionContext || "Analyze for situational awareness and threat detection."
              }
            ]
          }
        ],
        max_tokens: 2000
      });

      const content = response.choices[0].message.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return this.getDefaultVisionResult();
    } catch (error) {
      console.error("[SensorFusion] Vision analysis error:", error);
      return this.getDefaultVisionResult();
    }
  }

  async analyzeAudioContext(audioDescription: string): Promise<AudioAnalysisResult> {
    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are CYRUS's audio analysis module. Analyze sound patterns for:
1. Sound source identification (engines, gunfire, voices, alarms)
2. Threat indicators (hostile sounds, warning signals)
3. Voice command detection and intent parsing
4. Environmental audio assessment

Respond in JSON format:
{
  "sounds": [{"type": "engine", "confidence": 0.85, "direction": 45, "distance": 500, "threatIndicator": false}],
  "ambientLevel": 55,
  "voiceCommands": [{"text": "return to base", "confidence": 0.92, "intent": "RTB_COMMAND"}],
  "environmentalThreats": ["approaching vehicle"]
}`
          },
          {
            role: "user",
            content: audioDescription
          }
        ],
        max_tokens: 1000
      });

      const content = response.choices[0].message.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return this.getDefaultAudioResult();
    } catch (error) {
      console.error("[SensorFusion] Audio analysis error:", error);
      return this.getDefaultAudioResult();
    }
  }

  async performMultimodalFusion(
    gps: GPSPosition,
    visionImage?: string,
    audioContext?: string,
    missionContext?: string
  ): Promise<MultimodalFusionResult> {
    const timestamp = Date.now();
    
    let visionAnalysis: VisionAnalysisResult | undefined;
    let audioAnalysis: AudioAnalysisResult | undefined;

    const analysisPromises: Promise<void>[] = [];

    if (visionImage) {
      analysisPromises.push(
        this.analyzeVisionWithAI(visionImage, missionContext)
          .then(result => { visionAnalysis = result; })
      );
    }

    if (audioContext) {
      analysisPromises.push(
        this.analyzeAudioContext(audioContext)
          .then(result => { audioAnalysis = result; })
      );
    }

    await Promise.all(analysisPromises);

    const fusedThreats = this.fuseThreatsFromMultipleSources(visionAnalysis, audioAnalysis);
    const situationalConfidence = this.calculateMultimodalConfidence(visionAnalysis, audioAnalysis);
    const recommendations = this.generateMultimodalRecommendations(fusedThreats, gps);

    return {
      timestamp,
      position: gps,
      visionAnalysis,
      audioAnalysis,
      fusedThreats,
      situationalConfidence,
      recommendations
    };
  }

  private fuseThreatsFromMultipleSources(
    vision?: VisionAnalysisResult,
    audio?: AudioAnalysisResult
  ): ThreatAssessment[] {
    const threats: ThreatAssessment[] = [];
    let threatCounter = 0;

    if (vision?.threats) {
      vision.threats.forEach(t => {
        threats.push({
          trackId: `vision_${threatCounter++}`,
          threatType: "air",
          level: t.level === "critical" ? "critical" : t.level === "high" ? "high" : t.level === "medium" ? "medium" : "low",
          description: t.description,
          bearing: 0,
          range: 0,
          recommendedAction: t.recommendedAction
        });
      });
    }

    if (audio?.environmentalThreats) {
      audio.environmentalThreats.forEach(threat => {
        threats.push({
          trackId: `audio_${threatCounter++}`,
          threatType: "ground",
          level: "medium",
          description: threat,
          bearing: audio.sounds[0]?.direction || 0,
          range: audio.sounds[0]?.distance || 0,
          recommendedAction: "Investigate audio source"
        });
      });
    }

    return threats.sort((a, b) => {
      const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return levelOrder[a.level] - levelOrder[b.level];
    });
  }

  private calculateMultimodalConfidence(
    vision?: VisionAnalysisResult,
    audio?: AudioAnalysisResult
  ): number {
    let confidence = 0.5;
    let sources = 1;

    if (vision) {
      const avgConf = vision.objects.reduce((sum, o) => sum + o.confidence, 0) / 
        Math.max(vision.objects.length, 1);
      confidence += avgConf * 0.35;
      sources++;
    }

    if (audio) {
      const avgConf = audio.sounds.reduce((sum, s) => sum + s.confidence, 0) / 
        Math.max(audio.sounds.length, 1);
      confidence += avgConf * 0.15;
      sources++;
    }

    return Math.min(confidence, 1.0);
  }

  private generateMultimodalRecommendations(
    threats: ThreatAssessment[],
    position: GPSPosition
  ): MultimodalFusionResult["recommendations"] {
    const recommendations: MultimodalFusionResult["recommendations"] = [];

    const criticalThreats = threats.filter(t => t.level === "critical" || t.level === "high");
    if (criticalThreats.length > 0) {
      recommendations.push({
        priority: 1,
        action: "EVASIVE_MANEUVER",
        reason: `${criticalThreats.length} high-priority threat(s) detected`,
        urgency: "immediate"
      });
    }

    if (position.altitude < 50 && threats.length > 0) {
      recommendations.push({
        priority: 2,
        action: "GAIN_ALTITUDE",
        reason: "Low altitude with threats present",
        urgency: "soon"
      });
    }

    if (position.speed > 30 && criticalThreats.length > 0) {
      recommendations.push({
        priority: 3,
        action: "REDUCE_SPEED",
        reason: "High speed in threat environment",
        urgency: "soon"
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  private getDefaultVisionResult(): VisionAnalysisResult {
    return {
      objects: [],
      scene: "Unable to analyze",
      threats: [],
      terrain: { type: "unknown", obstacles: [], landingZones: [] }
    };
  }

  private getDefaultAudioResult(): AudioAnalysisResult {
    return {
      sounds: [],
      ambientLevel: 0,
      voiceCommands: [],
      environmentalThreats: []
    };
  }
}

// Export singleton instance
export const sensorFusionEngine = new SensorFusionEngine();
