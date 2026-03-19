/**
 * CYRUS ADAPTIVE LEARNING ENGINE
 * ===============================
 * 
 * Implements reinforcement learning and continuous improvement
 * for autonomous decision-making and performance optimization.
 * 
 * Features:
 * - Decision outcome tracking and analysis
 * - Performance metrics and trend analysis
 * - Adaptive threshold adjustment
 * - Pattern recognition for threat assessment
 * - Mission success prediction
 */

export interface LearningEvent {
  id: string;
  timestamp: number;
  eventType: "decision" | "action" | "outcome" | "feedback";
  category: string;
  context: Record<string, any>;
  decision?: string;
  outcome?: "success" | "failure" | "partial" | "unknown";
  reward?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  trend: "improving" | "stable" | "declining";
  historicalValues: { timestamp: number; value: number }[];
  target?: number;
  unit?: string;
}

export interface LearningModel {
  id: string;
  name: string;
  type: "classification" | "regression" | "reinforcement";
  accuracy: number;
  lastUpdated: number;
  trainingDataSize: number;
  features: string[];
  weights: Record<string, number>;
}

export interface AdaptiveThreshold {
  name: string;
  currentValue: number;
  baseValue: number;
  minValue: number;
  maxValue: number;
  adjustmentHistory: { timestamp: number; oldValue: number; newValue: number; reason: string }[];
}

export interface PredictionResult {
  prediction: string | number;
  confidence: number;
  factors: { name: string; contribution: number }[];
  alternatives?: { value: string | number; probability: number }[];
}

export interface LearningStats {
  totalEvents: number;
  successRate: number;
  averageReward: number;
  improvementRate: number;
  modelAccuracy: number;
  adaptiveAdjustments: number;
}

export class AdaptiveLearningEngine {
  private events: LearningEvent[] = [];
  private metrics: Map<string, PerformanceMetric> = new Map();
  private thresholds: Map<string, AdaptiveThreshold> = new Map();
  private models: Map<string, LearningModel> = new Map();
  private maxEventsStored = 10000;
  private learningRate = 0.1;
  private explorationRate = 0.15;

  constructor() {
    this.initializeMetrics();
    this.initializeThresholds();
    this.initializeModels();
  }

  private initializeMetrics(): void {
    const defaultMetrics: Omit<PerformanceMetric, "historicalValues">[] = [
      { name: "decision_accuracy", value: 0.85, trend: "stable", target: 0.95, unit: "%" },
      { name: "response_time", value: 150, trend: "stable", target: 100, unit: "ms" },
      { name: "threat_detection_rate", value: 0.92, trend: "improving", target: 0.99, unit: "%" },
      { name: "false_positive_rate", value: 0.08, trend: "declining", target: 0.02, unit: "%" },
      { name: "mission_success_rate", value: 0.88, trend: "stable", target: 0.95, unit: "%" },
      { name: "fuel_efficiency", value: 0.82, trend: "improving", target: 0.90, unit: "%" },
      { name: "path_optimization", value: 0.75, trend: "improving", target: 0.90, unit: "%" },
      { name: "obstacle_avoidance", value: 0.98, trend: "stable", target: 0.99, unit: "%" }
    ];

    defaultMetrics.forEach(metric => {
      this.metrics.set(metric.name, {
        ...metric,
        historicalValues: [{ timestamp: Date.now(), value: metric.value }]
      });
    });
  }

  private initializeThresholds(): void {
    const defaultThresholds: Omit<AdaptiveThreshold, "adjustmentHistory">[] = [
      { name: "threat_confidence", currentValue: 0.7, baseValue: 0.7, minValue: 0.5, maxValue: 0.95 },
      { name: "collision_distance", currentValue: 50, baseValue: 50, minValue: 20, maxValue: 100 },
      { name: "battery_critical", currentValue: 15, baseValue: 15, minValue: 10, maxValue: 25 },
      { name: "wind_speed_limit", currentValue: 25, baseValue: 25, minValue: 15, maxValue: 40 },
      { name: "altitude_buffer", currentValue: 30, baseValue: 30, minValue: 10, maxValue: 50 },
      { name: "target_lock_confidence", currentValue: 0.85, baseValue: 0.85, minValue: 0.7, maxValue: 0.99 }
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.name, {
        ...threshold,
        adjustmentHistory: []
      });
    });
  }

  private initializeModels(): void {
    const defaultModels: LearningModel[] = [
      {
        id: "threat_classifier",
        name: "Threat Classification Model",
        type: "classification",
        accuracy: 0.89,
        lastUpdated: Date.now(),
        trainingDataSize: 5000,
        features: ["distance", "velocity", "size", "emitting", "maneuvering"],
        weights: { distance: -0.3, velocity: 0.2, size: 0.15, emitting: 0.25, maneuvering: 0.1 }
      },
      {
        id: "path_optimizer",
        name: "Path Optimization Model",
        type: "regression",
        accuracy: 0.82,
        lastUpdated: Date.now(),
        trainingDataSize: 3000,
        features: ["distance", "obstacles", "wind", "battery", "urgency"],
        weights: { distance: 0.25, obstacles: -0.3, wind: -0.15, battery: 0.2, urgency: 0.1 }
      },
      {
        id: "mission_predictor",
        name: "Mission Success Predictor",
        type: "classification",
        accuracy: 0.85,
        lastUpdated: Date.now(),
        trainingDataSize: 2000,
        features: ["weather", "threat_level", "battery", "distance", "complexity"],
        weights: { weather: -0.2, threat_level: -0.3, battery: 0.2, distance: -0.15, complexity: -0.15 }
      }
    ];

    defaultModels.forEach(model => {
      this.models.set(model.id, model);
    });
  }

  recordEvent(event: Omit<LearningEvent, "id" | "timestamp">): LearningEvent {
    const fullEvent: LearningEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    this.events.push(fullEvent);

    if (this.events.length > this.maxEventsStored) {
      this.events = this.events.slice(-this.maxEventsStored / 2);
    }

    if (event.outcome) {
      this.updateMetricsFromOutcome(event.category, event.outcome, event.reward);
    }

    return fullEvent;
  }

  private updateMetricsFromOutcome(
    category: string,
    outcome: LearningEvent["outcome"],
    reward?: number
  ): void {
    const metricName = `${category}_accuracy`;
    const metric = this.metrics.get(metricName);
    
    if (metric) {
      const outcomeValue = outcome === "success" ? 1 : outcome === "partial" ? 0.5 : 0;
      const newValue = metric.value * (1 - this.learningRate) + outcomeValue * this.learningRate;
      
      this.updateMetric(metricName, newValue);
    }
  }

  updateMetric(name: string, value: number): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const previousValue = metric.value;
    metric.value = value;
    metric.historicalValues.push({ timestamp: Date.now(), value });

    if (metric.historicalValues.length > 100) {
      metric.historicalValues = metric.historicalValues.slice(-50);
    }

    metric.trend = this.calculateTrend(metric.historicalValues);
    this.metrics.set(name, metric);

    this.checkForThresholdAdjustment(name, previousValue, value);
  }

  private calculateTrend(history: { timestamp: number; value: number }[]): PerformanceMetric["trend"] {
    if (history.length < 5) return "stable";

    const recent = history.slice(-5);
    const older = history.slice(-10, -5);

    if (older.length === 0) return "stable";

    const recentAvg = recent.reduce((sum, h) => sum + h.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.value, 0) / older.length;

    const diff = recentAvg - olderAvg;
    const threshold = olderAvg * 0.05;

    if (diff > threshold) return "improving";
    if (diff < -threshold) return "declining";
    return "stable";
  }

  private checkForThresholdAdjustment(metricName: string, oldValue: number, newValue: number): void {
    const relatedThresholds: Record<string, string[]> = {
      "threat_detection_rate": ["threat_confidence"],
      "false_positive_rate": ["threat_confidence", "target_lock_confidence"],
      "obstacle_avoidance": ["collision_distance"],
      "fuel_efficiency": ["altitude_buffer"]
    };

    const thresholdNames = relatedThresholds[metricName];
    if (!thresholdNames) return;

    thresholdNames.forEach(thresholdName => {
      const threshold = this.thresholds.get(thresholdName);
      if (!threshold) return;

      if (newValue < oldValue * 0.95) {
        const adjustment = (threshold.maxValue - threshold.currentValue) * 0.1;
        this.adjustThreshold(thresholdName, threshold.currentValue + adjustment, 
          `Performance drop in ${metricName}`);
      }
    });
  }

  adjustThreshold(name: string, newValue: number, reason: string): boolean {
    const threshold = this.thresholds.get(name);
    if (!threshold) return false;

    const clampedValue = Math.max(threshold.minValue, Math.min(threshold.maxValue, newValue));
    const oldValue = threshold.currentValue;

    if (Math.abs(clampedValue - oldValue) < 0.001) return false;

    threshold.currentValue = clampedValue;
    threshold.adjustmentHistory.push({
      timestamp: Date.now(),
      oldValue,
      newValue: clampedValue,
      reason
    });

    if (threshold.adjustmentHistory.length > 50) {
      threshold.adjustmentHistory = threshold.adjustmentHistory.slice(-25);
    }

    this.thresholds.set(name, threshold);
    console.log(`[Learning] Adjusted ${name}: ${oldValue.toFixed(3)} → ${clampedValue.toFixed(3)} (${reason})`);
    return true;
  }

  predict(modelId: string, features: Record<string, number>): PredictionResult | null {
    const model = this.models.get(modelId);
    if (!model) return null;

    let score = 0;
    const factors: PredictionResult["factors"] = [];

    for (const [feature, weight] of Object.entries(model.weights)) {
      const featureValue = features[feature] || 0;
      const contribution = featureValue * weight;
      score += contribution;
      factors.push({ name: feature, contribution });
    }

    const normalizedScore = 1 / (1 + Math.exp(-score));

    let prediction: string | number;
    if (model.type === "classification") {
      prediction = normalizedScore > 0.5 ? "positive" : "negative";
    } else {
      prediction = normalizedScore;
    }

    return {
      prediction,
      confidence: Math.abs(normalizedScore - 0.5) * 2,
      factors: factors.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
      alternatives: model.type === "classification" ? [
        { value: "positive", probability: normalizedScore },
        { value: "negative", probability: 1 - normalizedScore }
      ] : undefined
    };
  }

  trainModel(modelId: string, examples: { features: Record<string, number>; label: number }[]): boolean {
    const model = this.models.get(modelId);
    if (!model || examples.length === 0) return false;

    for (const example of examples) {
      const prediction = this.predict(modelId, example.features);
      if (!prediction) continue;

      const predictedValue = typeof prediction.prediction === "number" 
        ? prediction.prediction 
        : prediction.prediction === "positive" ? 1 : 0;
      
      const error = example.label - predictedValue;

      for (const [feature, value] of Object.entries(example.features)) {
        if (model.weights[feature] !== undefined) {
          model.weights[feature] += this.learningRate * error * value;
        }
      }
    }

    model.trainingDataSize += examples.length;
    model.lastUpdated = Date.now();

    const testAccuracy = this.evaluateModel(modelId, examples);
    model.accuracy = model.accuracy * 0.9 + testAccuracy * 0.1;

    this.models.set(modelId, model);
    console.log(`[Learning] Trained ${model.name} with ${examples.length} examples. Accuracy: ${model.accuracy.toFixed(3)}`);
    return true;
  }

  private evaluateModel(modelId: string, testData: { features: Record<string, number>; label: number }[]): number {
    let correct = 0;

    for (const example of testData) {
      const prediction = this.predict(modelId, example.features);
      if (!prediction) continue;

      const predictedValue = typeof prediction.prediction === "number"
        ? prediction.prediction
        : prediction.prediction === "positive" ? 1 : 0;

      if (Math.abs(predictedValue - example.label) < 0.5) {
        correct++;
      }
    }

    return correct / testData.length;
  }

  getStats(): LearningStats {
    const outcomes = this.events.filter(e => e.outcome);
    const successes = outcomes.filter(e => e.outcome === "success").length;
    const rewards = this.events.filter(e => e.reward !== undefined);
    const avgReward = rewards.length > 0 
      ? rewards.reduce((sum, e) => sum + (e.reward || 0), 0) / rewards.length 
      : 0;

    const adjustments = Array.from(this.thresholds.values())
      .reduce((sum, t) => sum + t.adjustmentHistory.length, 0);

    const avgAccuracy = Array.from(this.models.values())
      .reduce((sum, m) => sum + m.accuracy, 0) / this.models.size;

    const improvingMetrics = Array.from(this.metrics.values())
      .filter(m => m.trend === "improving").length;
    const totalMetrics = this.metrics.size;
    const improvementRate = totalMetrics > 0 ? improvingMetrics / totalMetrics : 0;

    return {
      totalEvents: this.events.length,
      successRate: outcomes.length > 0 ? successes / outcomes.length : 0,
      averageReward: avgReward,
      improvementRate,
      modelAccuracy: avgAccuracy,
      adaptiveAdjustments: adjustments
    };
  }

  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  getThresholds(): AdaptiveThreshold[] {
    return Array.from(this.thresholds.values());
  }

  getModels(): LearningModel[] {
    return Array.from(this.models.values());
  }

  getThreshold(name: string): number | undefined {
    return this.thresholds.get(name)?.currentValue;
  }

  getRecentEvents(count: number = 100): LearningEvent[] {
    return this.events.slice(-count);
  }

  exportLearningData(): any {
    return {
      events: this.events,
      metrics: Array.from(this.metrics.entries()),
      thresholds: Array.from(this.thresholds.entries()),
      models: Array.from(this.models.entries()),
      stats: this.getStats(),
      exportedAt: Date.now()
    };
  }

  importLearningData(data: any): boolean {
    try {
      if (data.events) this.events = data.events;
      if (data.metrics) {
        data.metrics.forEach(([key, value]: [string, PerformanceMetric]) => {
          this.metrics.set(key, value);
        });
      }
      if (data.thresholds) {
        data.thresholds.forEach(([key, value]: [string, AdaptiveThreshold]) => {
          this.thresholds.set(key, value);
        });
      }
      if (data.models) {
        data.models.forEach(([key, value]: [string, LearningModel]) => {
          this.models.set(key, value);
        });
      }
      console.log("[Learning] Imported learning data successfully");
      return true;
    } catch (error) {
      console.error("[Learning] Failed to import learning data:", error);
      return false;
    }
  }
}

export const adaptiveLearningEngine = new AdaptiveLearningEngine();
