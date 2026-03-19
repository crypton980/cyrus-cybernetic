import { type User, type InsertUser, type Drone, type InsertDrone, type Mission, type InsertMission, type Alert, type InsertAlert, type FlightLog, type PilotMode } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDrones(): Promise<Drone[]>;
  getDrone(id: string): Promise<Drone | undefined>;
  createDrone(drone: InsertDrone): Promise<Drone>;
  updateDronePilotMode(id: string, mode: PilotMode): Promise<Drone | undefined>;
  updateDroneStatus(id: string, status: Drone["status"]): Promise<Drone | undefined>;
  
  getMissions(): Promise<Mission[]>;
  getMission(id: string): Promise<Mission | undefined>;
  getMissionsByDroneId(droneId: string): Promise<Mission[]>;
  createMission(mission: InsertMission): Promise<Mission>;
  updateMissionStatus(id: string, status: Mission["status"]): Promise<Mission | undefined>;
  
  getAlerts(): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert | undefined>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: string): Promise<Alert | undefined>;
  deleteAlert(id: string): Promise<boolean>;
  
  getFlightLogs(droneId?: string): Promise<FlightLog[]>;
  createFlightLog(log: Omit<FlightLog, "id">): Promise<FlightLog>;
  
  getTelemetry(droneId: string): Promise<any | undefined>;
  updateTelemetry(droneId: string, telemetry: any): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private drones: Map<string, Drone>;
  private missions: Map<string, Mission>;
  private alerts: Map<string, Alert>;
  private flightLogs: Map<string, FlightLog>;
  private telemetry: Map<string, any>;

  constructor() {
    this.users = new Map();
    this.drones = new Map();
    this.missions = new Map();
    this.alerts = new Map();
    this.flightLogs = new Map();
    this.telemetry = new Map();
    
    this.seedData();
  }

  private seedData() {
    const droneModels = ["MQ-9 Reaper", "RQ-4 Global Hawk", "MQ-1C Gray Eagle", "RQ-7 Shadow", "Scan Eagle"];
    const droneNames = ["Alpha-1", "Bravo-2", "Charlie-3", "Delta-4", "Echo-5", "Foxtrot-6"];
    const statuses: Drone["status"][] = ["online", "mission", "online", "returning", "maintenance", "online"];
    const pilotModes: PilotMode[] = ["manual", "autonomous", "ai-assist", "autonomous", "manual", "ai-assist"];

    droneNames.forEach((name, index) => {
      const id = randomUUID();
      const drone: Drone = {
        id,
        name,
        model: droneModels[index % droneModels.length],
        status: statuses[index],
        pilotMode: pilotModes[index],
        batteryLevel: 60 + Math.random() * 40,
        signalStrength: 70 + Math.random() * 30,
        gpsLock: index !== 4,
        lastSeen: new Date().toISOString(),
        currentMissionId: null,
      };
      this.drones.set(id, drone);

      if (index < 3) {
        const missionId = randomUUID();
        const mission: Mission = {
          id: missionId,
          name: `Recon Mission ${index + 1}`,
          droneId: id,
          status: index === 1 ? "active" : "planning",
          waypoints: [
            { id: randomUUID(), latitude: 37.7749 + Math.random() * 0.1, longitude: -122.4194 + Math.random() * 0.1, altitude: 150, action: "waypoint" },
            { id: randomUUID(), latitude: 37.7749 + Math.random() * 0.1, longitude: -122.4194 + Math.random() * 0.1, altitude: 200, action: "photo" },
            { id: randomUUID(), latitude: 37.7749 + Math.random() * 0.1, longitude: -122.4194 + Math.random() * 0.1, altitude: 150, action: "land" },
          ],
          startTime: index === 1 ? new Date(Date.now() - 15 * 60000).toISOString() : null,
          endTime: null,
          estimatedDuration: 45,
          distance: 12.5 + Math.random() * 10,
          createdAt: new Date().toISOString(),
        };
        this.missions.set(missionId, mission);
        
        if (index === 1) {
          drone.currentMissionId = missionId;
          drone.status = "mission";
        }
      }
    });

    const alertData = [
      { severity: "warning" as const, title: "Low Battery Warning", message: "Delta-4 battery level below 25%. Consider RTB.", droneId: Array.from(this.drones.keys())[3] },
      { severity: "info" as const, title: "Mission Waypoint Reached", message: "Bravo-2 reached waypoint 2 of 3.", droneId: Array.from(this.drones.keys())[1] },
      { severity: "warning" as const, title: "High Wind Advisory", message: "Wind speed exceeding 15 m/s in operational area.", droneId: Array.from(this.drones.keys())[0] },
    ];

    alertData.forEach((alertInfo) => {
      const id = randomUUID();
      const alert: Alert = {
        id,
        droneId: alertInfo.droneId,
        severity: alertInfo.severity,
        title: alertInfo.title,
        message: alertInfo.message,
        timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        acknowledged: false,
      };
      this.alerts.set(id, alert);
    });

    const logEvents = [
      { event: "System initialized", details: "All subsystems nominal", severity: "info" as const },
      { event: "GPS lock acquired", details: "Accuracy: 2.3m", severity: "info" as const },
      { event: "Takeoff sequence initiated", details: "Target altitude: 150m", severity: "info" as const },
      { event: "Waypoint 1 reached", details: "Lat: 37.7851, Lon: -122.4094", severity: "info" as const },
      { event: "Wind speed warning", details: "Current: 12.5 m/s", severity: "warning" as const },
    ];

    const droneIds = Array.from(this.drones.keys());
    logEvents.forEach((logInfo, index) => {
      const id = randomUUID();
      const log: FlightLog = {
        id,
        droneId: droneIds[1],
        missionId: null,
        event: logInfo.event,
        details: logInfo.details,
        timestamp: new Date(Date.now() - (logEvents.length - index) * 60000).toISOString(),
        severity: logInfo.severity,
      };
      this.flightLogs.set(id, log);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDrones(): Promise<Drone[]> {
    return Array.from(this.drones.values());
  }

  async getDrone(id: string): Promise<Drone | undefined> {
    return this.drones.get(id);
  }

  async createDrone(insertDrone: InsertDrone): Promise<Drone> {
    const id = randomUUID();
    const drone: Drone = {
      ...insertDrone,
      id,
      lastSeen: new Date().toISOString(),
      currentMissionId: null,
    };
    this.drones.set(id, drone);
    return drone;
  }

  async updateDronePilotMode(id: string, mode: PilotMode): Promise<Drone | undefined> {
    const drone = this.drones.get(id);
    if (!drone) return undefined;
    drone.pilotMode = mode;
    this.drones.set(id, drone);
    return drone;
  }

  async updateDroneStatus(id: string, status: Drone["status"]): Promise<Drone | undefined> {
    const drone = this.drones.get(id);
    if (!drone) return undefined;
    drone.status = status;
    drone.lastSeen = new Date().toISOString();
    this.drones.set(id, drone);
    return drone;
  }

  async getMissions(): Promise<Mission[]> {
    return Array.from(this.missions.values());
  }

  async getMission(id: string): Promise<Mission | undefined> {
    return this.missions.get(id);
  }

  async getMissionsByDroneId(droneId: string): Promise<Mission[]> {
    return Array.from(this.missions.values()).filter(m => m.droneId === droneId);
  }

  async createMission(insertMission: InsertMission): Promise<Mission> {
    const id = randomUUID();
    const mission: Mission = {
      ...insertMission,
      id,
      status: "planning",
      startTime: null,
      endTime: null,
      createdAt: new Date().toISOString(),
    };
    this.missions.set(id, mission);
    return mission;
  }

  async updateMissionStatus(id: string, status: Mission["status"]): Promise<Mission | undefined> {
    const mission = this.missions.get(id);
    if (!mission) return undefined;
    mission.status = status;
    if (status === "active" && !mission.startTime) {
      mission.startTime = new Date().toISOString();
    }
    if (status === "completed" || status === "aborted") {
      mission.endTime = new Date().toISOString();
    }
    this.missions.set(id, mission);
    return mission;
  }

  async getAlerts(): Promise<Alert[]> {
    return Array.from(this.alerts.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async getAlert(id: string): Promise<Alert | undefined> {
    return this.alerts.get(id);
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const id = randomUUID();
    const alert: Alert = {
      ...insertAlert,
      id,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    this.alerts.set(id, alert);
    return alert;
  }

  async acknowledgeAlert(id: string): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    alert.acknowledged = true;
    this.alerts.set(id, alert);
    return alert;
  }

  async deleteAlert(id: string): Promise<boolean> {
    return this.alerts.delete(id);
  }

  async getFlightLogs(droneId?: string): Promise<FlightLog[]> {
    const logs = Array.from(this.flightLogs.values());
    const filtered = droneId ? logs.filter(l => l.droneId === droneId) : logs;
    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async createFlightLog(log: Omit<FlightLog, "id">): Promise<FlightLog> {
    const id = randomUUID();
    const flightLog: FlightLog = { ...log, id };
    this.flightLogs.set(id, flightLog);
    return flightLog;
  }

  async getTelemetry(droneId: string): Promise<any | undefined> {
    return this.telemetry.get(droneId);
  }

  async updateTelemetry(droneId: string, telemetryData: any): Promise<void> {
    this.telemetry.set(droneId, telemetryData);
  }
}

export const storage = new MemStorage();
