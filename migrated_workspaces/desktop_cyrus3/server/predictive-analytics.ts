import { Drone, Mission, Telemetry, FlightLog } from "@shared/schema";

export interface BatteryPrediction {
  droneId: string;
  currentLevel: number;
  drainRate: number;
  estimatedFlightTime: number;
  criticalIn: number;
  recommendation: string;
}

export interface MissionPrediction {
  missionId: string;
  completionProbability: number;
  estimatedCompletion: Date;
  riskFactors: string[];
  recommendations: string[];
}

export interface MaintenancePrediction {
  droneId: string;
  droneName: string;
  nextMaintenance: Date;
  healthScore: number;
  components: {
    name: string;
    status: "good" | "fair" | "attention" | "critical";
    remainingLife: number;
  }[];
  priority: "low" | "medium" | "high" | "critical";
}

export interface FleetHealthAnalysis {
  overallHealth: number;
  availableDrones: number;
  totalDrones: number;
  onMission: number;
  needsMaintenance: number;
  criticalAlerts: number;
  predictions: {
    batteryCriticalSoon: number;
    maintenanceDueSoon: number;
    missionRisks: number;
  };
}

export class PredictiveAnalyticsEngine {
  private telemetryHistory: Map<string, Telemetry[]> = new Map();
  private flightHistory: Map<string, FlightLog[]> = new Map();

  recordTelemetry(telemetry: Telemetry): void {
    const droneId = telemetry.droneId;
    const history = this.telemetryHistory.get(droneId) || [];
    history.push(telemetry);
    if (history.length > 1000) {
      history.shift();
    }
    this.telemetryHistory.set(droneId, history);
  }

  recordFlightLog(log: FlightLog): void {
    const droneId = log.droneId;
    const history = this.flightHistory.get(droneId) || [];
    history.push(log);
    if (history.length > 500) {
      history.shift();
    }
    this.flightHistory.set(droneId, history);
  }

  predictBatteryLife(drone: Drone, currentTelemetry?: Telemetry): BatteryPrediction {
    const history = this.telemetryHistory.get(drone.id) || [];
    
    let drainRate = 0.5;
    if (history.length >= 2) {
      const recent = history.slice(-10);
      let totalDrain = 0;
      let timeSpan = 0;
      
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const curr = recent[i];
        const batteryDiff = prev.batteryLevel - curr.batteryLevel;
        const timeDiff = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000;
        
        if (batteryDiff > 0 && timeDiff > 0) {
          totalDrain += batteryDiff;
          timeSpan += timeDiff;
        }
      }
      
      if (timeSpan > 0) {
        drainRate = totalDrain / timeSpan;
      }
    }

    if (drone.status === "mission") drainRate *= 1.3;
    if (drone.pilotMode === "autonomous") drainRate *= 1.1;

    const currentLevel = currentTelemetry?.batteryLevel || drone.batteryLevel;
    const estimatedFlightTime = drainRate > 0 ? (currentLevel - 10) / drainRate : 999;
    const criticalIn = drainRate > 0 ? (currentLevel - 15) / drainRate : 999;

    let recommendation = "Normal operation";
    if (criticalIn < 10) {
      recommendation = "CRITICAL: Initiate RTB immediately";
    } else if (criticalIn < 20) {
      recommendation = "WARNING: Begin RTB procedures";
    } else if (criticalIn < 30) {
      recommendation = "CAUTION: Monitor battery closely";
    }

    return {
      droneId: drone.id,
      currentLevel,
      drainRate: Math.round(drainRate * 100) / 100,
      estimatedFlightTime: Math.max(0, Math.round(estimatedFlightTime)),
      criticalIn: Math.max(0, Math.round(criticalIn)),
      recommendation
    };
  }

  predictMissionCompletion(mission: Mission, drone: Drone): MissionPrediction {
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let completionProbability = 0.95;

    if (drone.batteryLevel < 50) {
      completionProbability -= 0.15;
      riskFactors.push("Low battery may affect mission completion");
      recommendations.push("Consider mission scope reduction");
    }
    if (drone.batteryLevel < 30) {
      completionProbability -= 0.25;
      riskFactors.push("Critical battery level");
      recommendations.push("Abort mission and RTB immediately");
    }

    if (drone.signalStrength < 50) {
      completionProbability -= 0.10;
      riskFactors.push("Weak signal strength");
      recommendations.push("Reduce operational distance from base");
    }
    if (drone.signalStrength < 30) {
      completionProbability -= 0.20;
      riskFactors.push("Critical signal level - link loss imminent");
      recommendations.push("Climb for better signal or abort");
    }

    if (!drone.gpsLock) {
      completionProbability -= 0.30;
      riskFactors.push("No GPS lock - navigation degraded");
      recommendations.push("Hold position until GPS reacquired");
    }

    const waypointsRemaining = mission.waypoints.length;
    const estimatedMinutes = waypointsRemaining * 5;
    const estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    if (waypointsRemaining > 10 && drone.batteryLevel < 60) {
      completionProbability -= 0.15;
      riskFactors.push("Many waypoints remaining with limited battery");
      recommendations.push("Consider skipping non-essential waypoints");
    }

    completionProbability = Math.max(0, Math.min(1, completionProbability));

    return {
      missionId: mission.id,
      completionProbability: Math.round(completionProbability * 100) / 100,
      estimatedCompletion,
      riskFactors,
      recommendations
    };
  }

  predictMaintenance(drone: Drone): MaintenancePrediction {
    const flightLogs = this.flightHistory.get(drone.id) || [];
    const errors = flightLogs.filter(log => log.severity === "error" || log.severity === "warning");
    
    const errorRate = flightLogs.length > 0 ? errors.length / flightLogs.length : 0;
    let healthScore = 100 - (errorRate * 100);

    if (drone.status === "maintenance") healthScore = Math.min(healthScore, 50);
    if (!drone.gpsLock) healthScore -= 10;
    if (drone.signalStrength < 50) healthScore -= 5;

    healthScore = Math.max(0, Math.min(100, healthScore));

    const droneHash = this.hashDroneId(drone.id);
    const components = [
      {
        name: "Propulsion System",
        status: this.getComponentStatus(healthScore - (droneHash % 10)),
        remainingLife: Math.max(0, healthScore - 10 + (droneHash % 20))
      },
      {
        name: "Navigation Module",
        status: this.getComponentStatus(drone.gpsLock ? healthScore : healthScore - 20),
        remainingLife: Math.max(0, drone.gpsLock ? healthScore - 5 : healthScore - 25)
      },
      {
        name: "Sensor Array",
        status: this.getComponentStatus(healthScore - ((droneHash >> 4) % 15)),
        remainingLife: Math.max(0, healthScore - 15 + ((droneHash >> 4) % 25))
      },
      {
        name: "Communication Link",
        status: this.getComponentStatus(drone.signalStrength),
        remainingLife: Math.max(0, drone.signalStrength - 10)
      },
      {
        name: "Battery Pack",
        status: this.getComponentStatus(drone.batteryLevel),
        remainingLife: Math.max(0, drone.batteryLevel - 20)
      }
    ] as MaintenancePrediction["components"];

    let priority: MaintenancePrediction["priority"] = "low";
    if (healthScore < 40) priority = "critical";
    else if (healthScore < 60) priority = "high";
    else if (healthScore < 80) priority = "medium";

    const daysUntilMaintenance = Math.max(1, Math.floor(healthScore / 5));
    const nextMaintenance = new Date(Date.now() + daysUntilMaintenance * 24 * 60 * 60 * 1000);

    return {
      droneId: drone.id,
      droneName: drone.name,
      nextMaintenance,
      healthScore: Math.round(healthScore),
      components,
      priority
    };
  }

  private hashDroneId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private getComponentStatus(value: number): "good" | "fair" | "attention" | "critical" {
    if (value >= 80) return "good";
    if (value >= 60) return "fair";
    if (value >= 40) return "attention";
    return "critical";
  }

  analyzeFleetHealth(drones: Drone[], missions: Mission[]): FleetHealthAnalysis {
    const totalDrones = drones.length;
    const availableDrones = drones.filter(d => d.status === "online").length;
    const onMission = drones.filter(d => d.status === "mission").length;
    const needsMaintenance = drones.filter(d => d.status === "maintenance").length;

    let batteryCriticalSoon = 0;
    let maintenanceDueSoon = 0;
    let missionRisks = 0;

    const healthScores: number[] = [];

    for (const drone of drones) {
      const batteryPred = this.predictBatteryLife(drone);
      if (batteryPred.criticalIn < 30) {
        batteryCriticalSoon++;
      }

      const maintenancePred = this.predictMaintenance(drone);
      healthScores.push(maintenancePred.healthScore);
      if (maintenancePred.priority === "high" || maintenancePred.priority === "critical") {
        maintenanceDueSoon++;
      }
    }

    const activeMissions = missions.filter(m => m.status === "active");
    for (const mission of activeMissions) {
      const drone = drones.find(d => d.id === mission.droneId);
      if (drone) {
        const missionPred = this.predictMissionCompletion(mission, drone);
        if (missionPred.completionProbability < 0.7) {
          missionRisks++;
        }
      }
    }

    const overallHealth = healthScores.length > 0
      ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
      : 100;

    const criticalAlerts = drones.filter(d => 
      d.batteryLevel < 20 || 
      d.signalStrength < 30 || 
      d.status === "emergency"
    ).length;

    return {
      overallHealth,
      availableDrones,
      totalDrones,
      onMission,
      needsMaintenance,
      criticalAlerts,
      predictions: {
        batteryCriticalSoon,
        maintenanceDueSoon,
        missionRisks
      }
    };
  }

  getOperationalRecommendations(drones: Drone[], missions: Mission[]): string[] {
    const recommendations: string[] = [];
    const fleetHealth = this.analyzeFleetHealth(drones, missions);

    if (fleetHealth.predictions.batteryCriticalSoon > 0) {
      recommendations.push(`${fleetHealth.predictions.batteryCriticalSoon} drone(s) approaching critical battery - schedule landings`);
    }

    if (fleetHealth.predictions.maintenanceDueSoon > 0) {
      recommendations.push(`${fleetHealth.predictions.maintenanceDueSoon} drone(s) require maintenance soon - plan downtime`);
    }

    if (fleetHealth.predictions.missionRisks > 0) {
      recommendations.push(`${fleetHealth.predictions.missionRisks} mission(s) at risk - review mission parameters`);
    }

    if (fleetHealth.overallHealth < 70) {
      recommendations.push("Fleet health below optimal - prioritize maintenance cycles");
    }

    if (fleetHealth.availableDrones < 2) {
      recommendations.push("Limited drone availability - restrict new mission assignments");
    }

    if (recommendations.length === 0) {
      recommendations.push("All systems nominal - fleet operating within parameters");
    }

    return recommendations;
  }
}

export const predictiveAnalytics = new PredictiveAnalyticsEngine();
