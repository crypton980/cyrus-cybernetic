export type FixSource = "gps" | "network" | "manual";

export interface PositionFix {
  lat: number;
  lon: number;
  accuracy: number; // meters
  source: FixSource;
  timestamp: number; // ms
}

export interface ScoredFix extends PositionFix {
  confidence: number; // 0-1
  ageMs: number;
}

export interface RouteRequest {
  origin: { lat: number; lon: number };
  destination: { lat: number; lon: number };
  waypoints?: Array<{ lat: number; lon: number }>;
  mode?: "driving" | "walking" | "bicycling";
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  fetchedAt: number;
  confidence: number;
  provider: "google" | "simulated";
}

