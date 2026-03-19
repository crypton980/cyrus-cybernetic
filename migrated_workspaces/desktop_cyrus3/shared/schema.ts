import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type DroneStatus = "online" | "offline" | "mission" | "returning" | "maintenance" | "emergency";
export type PilotMode = "manual" | "autonomous" | "ai-assist";
export type AlertSeverity = "critical" | "warning" | "info";
export type MissionStatus = "planning" | "active" | "completed" | "aborted";
export type SubsystemStatus = "nominal" | "degraded" | "critical" | "offline";

export interface Drone {
  id: string;
  name: string;
  model: string;
  status: DroneStatus;
  pilotMode: PilotMode;
  batteryLevel: number;
  signalStrength: number;
  gpsLock: boolean;
  lastSeen: string;
  currentMissionId: string | null;
}

export interface Telemetry {
  droneId: string;
  timestamp: string;
  altitude: number;
  speed: number;
  heading: number;
  latitude: number;
  longitude: number;
  batteryLevel: number;
  batteryVoltage: number;
  signalStrength: number;
  gpsAccuracy: number;
  temperature: number;
  windSpeed: number;
  subsystems: {
    propulsion: SubsystemStatus;
    navigation: SubsystemStatus;
    sensors: SubsystemStatus;
    communication: SubsystemStatus;
    payload: SubsystemStatus;
  };
}

export interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  action: "hover" | "photo" | "video" | "waypoint" | "land";
  duration?: number;
}

export interface Mission {
  id: string;
  name: string;
  droneId: string;
  status: MissionStatus;
  waypoints: Waypoint[];
  startTime: string | null;
  endTime: string | null;
  estimatedDuration: number;
  distance: number;
  createdAt: string;
}

export interface Alert {
  id: string;
  droneId: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface FlightLog {
  id: string;
  droneId: string;
  missionId: string | null;
  event: string;
  details: string;
  timestamp: string;
  severity: "debug" | "info" | "warning" | "error";
}

export const insertDroneSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["online", "offline", "mission", "returning", "maintenance", "emergency"]).default("offline"),
  pilotMode: z.enum(["manual", "autonomous", "ai-assist"]).default("manual"),
  batteryLevel: z.number().min(0).max(100).default(100),
  signalStrength: z.number().min(0).max(100).default(100),
  gpsLock: z.boolean().default(false),
});

export type InsertDrone = z.infer<typeof insertDroneSchema>;

export const insertMissionSchema = z.object({
  name: z.string().min(1),
  droneId: z.string(),
  waypoints: z.array(z.object({
    id: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number(),
    action: z.enum(["hover", "photo", "video", "waypoint", "land"]),
    duration: z.number().optional(),
  })),
  estimatedDuration: z.number().default(0),
  distance: z.number().default(0),
});

export type InsertMission = z.infer<typeof insertMissionSchema>;

export const insertAlertSchema = z.object({
  droneId: z.string(),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string(),
  message: z.string(),
});

export type InsertAlert = z.infer<typeof insertAlertSchema>;

// Chat models for AI conversations
export * from "./models/chat";
