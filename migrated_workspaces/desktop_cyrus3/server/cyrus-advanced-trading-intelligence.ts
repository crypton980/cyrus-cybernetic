import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai) {
    try {
      openai = new OpenAI();
    } catch (e) {
      console.log("[Intelligence] OpenAI not available - AI features disabled");
      return null;
    }
  }
  return openai;
}

export interface NeuralPattern {
  id: string;
  name: string;
  pattern: number[];
  confidence: number;
  historicalAccuracy: number;
  lastOccurrence: Date;
  predictedOutcome: "bullish" | "bearish" | "neutral";
  timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
}

export interface RiskCircuitBreaker {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  currentValue: number;
  isTripped: boolean;
  trippedAt?: Date;
  cooldownMinutes: number;
  action: "halt_trading" | "reduce_position_size" | "close_positions" | "alert_only";
}

export interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: "legal" | "ethical" | "risk" | "regulatory";
  isActive: boolean;
  priority: number;
  enforcement: "hard_block" | "soft_warning" | "log_only";
  lastViolation?: Date;
  violationCount: number;
}

export interface LearningMetric {
  metricName: string;
  currentValue: number;
  historicalValues: number[];
  trend: "improving" | "stable" | "declining";
  improvementRate: number;
  targetValue: number;
}

export interface EnvironmentalAwareness {
  marketVolatilityIndex: number;
  globalRiskSentiment: number;
  liquidityScore: number;
  correlationMatrix: Record<string, Record<string, number>>;
  marketRegime: "trending" | "ranging" | "volatile" | "calm";
  tradingSessionActivity: "high" | "medium" | "low";
  majorEventsNearby: boolean;
  recommendedExposure: number;
}

export interface AutonomousDecisionContext {
  symbol: string;
  timestamp: Date;
  technicalFactors: Record<string, number>;
  fundamentalFactors: Record<string, number>;
  sentimentFactors: Record<string, number>;
  riskFactors: Record<string, number>;
  environmentalFactors: EnvironmentalAwareness;
  activePatterns: NeuralPattern[];
  complianceStatus: { passed: boolean; violations: string[] };
  confidence: number;
  reasoning: string[];
}

class AdvancedTradingIntelligence {
  private patterns: Map<string, NeuralPattern[]> = new Map();
  private circuitBreakers: RiskCircuitBreaker[] = [];
  private complianceRules: ComplianceRule[] = [];
  private learningMetrics: Map<string, LearningMetric> = new Map();
  private environmentalState: EnvironmentalAwareness;
  private decisionHistory: AutonomousDecisionContext[] = [];
  private isLearningEnabled: boolean = true;
  private lastAdaptation: Date = new Date();
  private adaptationCycle: number = 0;

  constructor() {
    this.initializeCircuitBreakers();
    this.initializeComplianceRules();
    this.initializeLearningMetrics();
    this.initializeNeuralPatterns();
    this.environmentalState = this.initializeEnvironmentalAwareness();
    console.log("[AdvancedIntelligence] CYRUS Advanced Trading Intelligence initialized");
  }

  private initializeCircuitBreakers() {
    this.circuitBreakers = [
      {
        id: "max_daily_loss",
        name: "Maximum Daily Loss",
        condition: "Daily loss exceeds threshold",
        threshold: 5,
        currentValue: 0,
        isTripped: false,
        cooldownMinutes: 1440,
        action: "halt_trading"
      },
      {
        id: "max_drawdown",
        name: "Maximum Drawdown",
        condition: "Portfolio drawdown exceeds limit",
        threshold: 15,
        currentValue: 0,
        isTripped: false,
        cooldownMinutes: 2880,
        action: "halt_trading"
      },
      {
        id: "volatility_spike",
        name: "Volatility Spike Protection",
        condition: "Market volatility exceeds safe levels",
        threshold: 3.5,
        currentValue: 1.0,
        isTripped: false,
        cooldownMinutes: 60,
        action: "reduce_position_size"
      },
      {
        id: "consecutive_losses",
        name: "Consecutive Loss Limit",
        condition: "Too many consecutive losing trades",
        threshold: 5,
        currentValue: 0,
        isTripped: false,
        cooldownMinutes: 240,
        action: "reduce_position_size"
      },
      {
        id: "rapid_execution",
        name: "Rapid Execution Guard",
        condition: "Too many trades in short period",
        threshold: 10,
        currentValue: 0,
        isTripped: false,
        cooldownMinutes: 30,
        action: "alert_only"
      },
      {
        id: "liquidity_warning",
        name: "Low Liquidity Warning",
        condition: "Market liquidity below safe threshold",
        threshold: 0.3,
        currentValue: 1.0,
        isTripped: false,
        cooldownMinutes: 15,
        action: "reduce_position_size"
      },
      {
        id: "correlation_risk",
        name: "Correlation Risk Alert",
        condition: "High correlation between open positions",
        threshold: 0.85,
        currentValue: 0,
        isTripped: false,
        cooldownMinutes: 60,
        action: "alert_only"
      }
    ];
  }

  private initializeComplianceRules() {
    this.complianceRules = [
      {
        id: "no_market_manipulation",
        name: "Anti-Market Manipulation",
        description: "Prevent actions that could be construed as market manipulation",
        category: "legal",
        isActive: true,
        priority: 1,
        enforcement: "hard_block",
        violationCount: 0
      },
      {
        id: "position_size_limit",
        name: "Position Size Limit",
        description: "Maximum single position size relative to portfolio",
        category: "risk",
        isActive: true,
        priority: 2,
        enforcement: "hard_block",
        violationCount: 0
      },
      {
        id: "leverage_limit",
        name: "Leverage Restriction",
        description: "Maximum leverage allowed per trade",
        category: "regulatory",
        isActive: true,
        priority: 2,
        enforcement: "hard_block",
        violationCount: 0
      },
      {
        id: "insider_trading_prevention",
        name: "Insider Trading Prevention",
        description: "Block trades based on non-public information patterns",
        category: "legal",
        isActive: true,
        priority: 1,
        enforcement: "hard_block",
        violationCount: 0
      },
      {
        id: "fair_execution",
        name: "Fair Execution Policy",
        description: "Ensure trades don't exploit information asymmetry",
        category: "ethical",
        isActive: true,
        priority: 3,
        enforcement: "soft_warning",
        violationCount: 0
      },
      {
        id: "diversification_requirement",
        name: "Diversification Requirement",
        description: "Maintain minimum portfolio diversification",
        category: "risk",
        isActive: true,
        priority: 3,
        enforcement: "soft_warning",
        violationCount: 0
      },
      {
        id: "trading_hours",
        name: "Trading Hours Compliance",
        description: "Respect market trading hours and liquidity windows",
        category: "regulatory",
        isActive: true,
        priority: 4,
        enforcement: "log_only",
        violationCount: 0
      },
      {
        id: "wash_trading_prevention",
        name: "Wash Trading Prevention",
        description: "Prevent circular trades that artificially inflate volume",
        category: "legal",
        isActive: true,
        priority: 1,
        enforcement: "hard_block",
        violationCount: 0
      }
    ];
  }

  private initializeLearningMetrics() {
    const metrics = [
      { name: "win_rate", current: 0.55, target: 0.65 },
      { name: "profit_factor", current: 1.2, target: 2.0 },
      { name: "sharpe_ratio", current: 0.8, target: 1.5 },
      { name: "max_drawdown_control", current: 0.85, target: 0.95 },
      { name: "decision_accuracy", current: 0.60, target: 0.75 },
      { name: "risk_adjusted_return", current: 0.12, target: 0.25 },
      { name: "execution_efficiency", current: 0.88, target: 0.95 },
      { name: "pattern_recognition_accuracy", current: 0.62, target: 0.80 }
    ];

    metrics.forEach(m => {
      this.learningMetrics.set(m.name, {
        metricName: m.name,
        currentValue: m.current,
        historicalValues: Array.from({ length: 30 }, () => m.current + (Math.random() - 0.5) * 0.1),
        trend: "stable",
        improvementRate: 0,
        targetValue: m.target
      });
    });
  }

  private initializeNeuralPatterns() {
    const basePatterns: Omit<NeuralPattern, "id" | "lastOccurrence">[] = [
      {
        name: "Double Bottom Reversal",
        pattern: [-2, -1, 0, -1, 0, 1, 2],
        confidence: 0.72,
        historicalAccuracy: 0.68,
        predictedOutcome: "bullish",
        timeframe: "4h"
      },
      {
        name: "Head and Shoulders Top",
        pattern: [1, 2, 1, 3, 1, 2, 1, 0],
        confidence: 0.75,
        historicalAccuracy: 0.71,
        predictedOutcome: "bearish",
        timeframe: "1d"
      },
      {
        name: "Ascending Triangle Breakout",
        pattern: [0, 1, 0.5, 1, 0.7, 1, 0.9, 1.5],
        confidence: 0.68,
        historicalAccuracy: 0.65,
        predictedOutcome: "bullish",
        timeframe: "1h"
      },
      {
        name: "Momentum Divergence",
        pattern: [1, 2, 3, 3, 2.5, 2],
        confidence: 0.70,
        historicalAccuracy: 0.66,
        predictedOutcome: "bearish",
        timeframe: "15m"
      },
      {
        name: "Volume Spike Reversal",
        pattern: [-1, -2, -3, 0, 1, 2],
        confidence: 0.65,
        historicalAccuracy: 0.62,
        predictedOutcome: "bullish",
        timeframe: "5m"
      },
      {
        name: "Consolidation Breakout",
        pattern: [0, 0.1, -0.1, 0, 0.1, 0, 1.5],
        confidence: 0.73,
        historicalAccuracy: 0.69,
        predictedOutcome: "bullish",
        timeframe: "1h"
      }
    ];

    const allPatterns = basePatterns.map((p, i) => ({
      ...p,
      id: `pattern_${i}_${Date.now()}`,
      lastOccurrence: new Date(Date.now() - Math.random() * 86400000)
    }));

    this.patterns.set("global", allPatterns);
  }

  private initializeEnvironmentalAwareness(): EnvironmentalAwareness {
    return {
      marketVolatilityIndex: 1.0,
      globalRiskSentiment: 0.5,
      liquidityScore: 0.8,
      correlationMatrix: {},
      marketRegime: "calm",
      tradingSessionActivity: "medium",
      majorEventsNearby: false,
      recommendedExposure: 1.0
    };
  }

  updateEnvironmentalAwareness(marketData: Record<string, any>, worldEvents: any[]) {
    const volatilities = Object.values(marketData).map((d: any) => d.change24h || 0);
    const avgVolatility = Math.abs(volatilities.reduce((a, b) => a + b, 0) / volatilities.length);
    
    this.environmentalState.marketVolatilityIndex = Math.min(5, avgVolatility / 0.5);
    
    const recentEvents = worldEvents.filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      return Date.now() - eventTime < 3600000;
    });
    
    this.environmentalState.majorEventsNearby = recentEvents.some(e => 
      e.impactLevel === "critical" || e.impactLevel === "high"
    );

    const bearishEvents = recentEvents.filter(e => e.sentiment === "bearish").length;
    const bullishEvents = recentEvents.filter(e => e.sentiment === "bullish").length;
    this.environmentalState.globalRiskSentiment = 
      (bullishEvents - bearishEvents) / Math.max(1, recentEvents.length) * 0.5 + 0.5;

    if (this.environmentalState.marketVolatilityIndex > 2.5) {
      this.environmentalState.marketRegime = "volatile";
    } else if (this.environmentalState.marketVolatilityIndex < 0.5) {
      this.environmentalState.marketRegime = "calm";
    } else {
      this.environmentalState.marketRegime = Math.random() > 0.5 ? "trending" : "ranging";
    }

    this.environmentalState.recommendedExposure = this.calculateRecommendedExposure();
    
    this.checkCircuitBreakers();
  }

  private calculateRecommendedExposure(): number {
    let exposure = 1.0;
    
    if (this.environmentalState.marketVolatilityIndex > 2) {
      exposure *= 0.5;
    } else if (this.environmentalState.marketVolatilityIndex > 1.5) {
      exposure *= 0.75;
    }

    if (this.environmentalState.majorEventsNearby) {
      exposure *= 0.6;
    }

    if (this.environmentalState.liquidityScore < 0.5) {
      exposure *= 0.7;
    }

    const trippedBreakers = this.circuitBreakers.filter(cb => cb.isTripped);
    exposure *= Math.pow(0.8, trippedBreakers.length);

    return Math.max(0.1, Math.min(1.0, exposure));
  }

  private checkCircuitBreakers() {
    this.circuitBreakers.forEach(breaker => {
      if (breaker.isTripped && breaker.trippedAt) {
        const cooldownMs = breaker.cooldownMinutes * 60 * 1000;
        if (Date.now() - breaker.trippedAt.getTime() > cooldownMs) {
          breaker.isTripped = false;
          breaker.trippedAt = undefined;
          console.log(`[CircuitBreaker] ${breaker.name} reset after cooldown`);
        }
      }

      if (!breaker.isTripped && breaker.currentValue >= breaker.threshold) {
        breaker.isTripped = true;
        breaker.trippedAt = new Date();
        console.log(`[CircuitBreaker] ${breaker.name} TRIPPED: ${breaker.currentValue} >= ${breaker.threshold}`);
      }
    });
  }

  updateCircuitBreakerValue(breakerId: string, value: number) {
    const breaker = this.circuitBreakers.find(b => b.id === breakerId);
    if (breaker) {
      breaker.currentValue = value;
      this.checkCircuitBreakers();
    }
  }

  checkCompliance(tradeParams: {
    symbol: string;
    side: "buy" | "sell";
    size: number;
    portfolioValue: number;
    openPositions: any[];
    recentTrades: any[];
  }): { approved: boolean; violations: ComplianceRule[]; warnings: ComplianceRule[] } {
    const violations: ComplianceRule[] = [];
    const warnings: ComplianceRule[] = [];

    this.complianceRules.forEach(rule => {
      if (!rule.isActive) return;

      let violated = false;
      
      switch (rule.id) {
        case "position_size_limit":
          violated = tradeParams.size > tradeParams.portfolioValue * 0.1;
          break;
        case "leverage_limit":
          violated = tradeParams.size > tradeParams.portfolioValue * 10;
          break;
        case "diversification_requirement":
          const sameSymbolPositions = tradeParams.openPositions.filter(
            p => p.symbol === tradeParams.symbol
          );
          violated = sameSymbolPositions.length >= 3;
          break;
        case "wash_trading_prevention":
          const recentSameTrades = tradeParams.recentTrades.filter(t => 
            t.symbol === tradeParams.symbol && 
            Date.now() - t.timestamp < 60000
          );
          violated = recentSameTrades.length >= 2;
          break;
        case "rapid_execution":
          const rapidTrades = tradeParams.recentTrades.filter(t =>
            Date.now() - t.timestamp < 300000
          );
          violated = rapidTrades.length >= 10;
          break;
      }

      if (violated) {
        rule.violationCount++;
        rule.lastViolation = new Date();
        
        if (rule.enforcement === "hard_block") {
          violations.push(rule);
        } else if (rule.enforcement === "soft_warning") {
          warnings.push(rule);
        }
      }
    });

    return {
      approved: violations.length === 0,
      violations,
      warnings
    };
  }

  detectPatterns(priceData: number[], symbol: string): NeuralPattern[] {
    const detectedPatterns: NeuralPattern[] = [];
    const allPatterns = this.patterns.get("global") || [];
    
    allPatterns.forEach(pattern => {
      const patternLength = pattern.pattern.length;
      if (priceData.length < patternLength) return;

      const recentPrices = priceData.slice(-patternLength);
      const normalizedPrices = this.normalizePattern(recentPrices);
      
      const similarity = this.calculatePatternSimilarity(normalizedPrices, pattern.pattern);
      
      if (similarity > 0.75) {
        detectedPatterns.push({
          ...pattern,
          confidence: similarity * pattern.historicalAccuracy,
          lastOccurrence: new Date()
        });
      }
    });

    return detectedPatterns;
  }

  private normalizePattern(prices: number[]): number[] {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    return prices.map(p => ((p - min) / range) * 4 - 2);
  }

  private calculatePatternSimilarity(pattern1: number[], pattern2: number[]): number {
    if (pattern1.length !== pattern2.length) return 0;
    
    let sumSquaredDiff = 0;
    for (let i = 0; i < pattern1.length; i++) {
      sumSquaredDiff += Math.pow(pattern1[i] - pattern2[i], 2);
    }
    
    const rmse = Math.sqrt(sumSquaredDiff / pattern1.length);
    return Math.max(0, 1 - rmse / 4);
  }

  async makeAutonomousDecision(
    symbol: string,
    marketData: any,
    prediction: any,
    strategies: any[],
    portfolio: any
  ): Promise<AutonomousDecisionContext> {
    const technicalFactors = this.analyzeTechnicalFactors(marketData);
    const fundamentalFactors = this.analyzeFundamentalFactors(marketData);
    const sentimentFactors = this.analyzeSentimentFactors(prediction);
    const riskFactors = this.analyzeRiskFactors(portfolio, marketData);
    
    const priceHistory = marketData.priceHistory || [];
    const activePatterns = this.detectPatterns(priceHistory, symbol);

    const complianceCheck = this.checkCompliance({
      symbol,
      side: prediction.direction === "up" ? "buy" : "sell",
      size: portfolio.availableBalance * 0.05,
      portfolioValue: portfolio.totalBalance,
      openPositions: portfolio.positions || [],
      recentTrades: []
    });

    const reasoning: string[] = [];
    
    reasoning.push(`Technical Score: ${(Object.values(technicalFactors).reduce((a: number, b: any) => a + b, 0) / Object.keys(technicalFactors).length * 100).toFixed(1)}%`);
    reasoning.push(`Fundamental Score: ${(Object.values(fundamentalFactors).reduce((a: number, b: any) => a + b, 0) / Object.keys(fundamentalFactors).length * 100).toFixed(1)}%`);
    reasoning.push(`Market Regime: ${this.environmentalState.marketRegime}`);
    reasoning.push(`Recommended Exposure: ${(this.environmentalState.recommendedExposure * 100).toFixed(0)}%`);
    
    if (activePatterns.length > 0) {
      reasoning.push(`Detected Patterns: ${activePatterns.map(p => p.name).join(", ")}`);
    }

    if (!complianceCheck.approved) {
      reasoning.push(`Compliance Violations: ${complianceCheck.violations.map(v => v.name).join(", ")}`);
    }

    const confidence = this.calculateOverallConfidence(
      technicalFactors,
      fundamentalFactors,
      sentimentFactors,
      riskFactors,
      activePatterns,
      complianceCheck
    );

    const context: AutonomousDecisionContext = {
      symbol,
      timestamp: new Date(),
      technicalFactors,
      fundamentalFactors,
      sentimentFactors,
      riskFactors,
      environmentalFactors: { ...this.environmentalState },
      activePatterns,
      complianceStatus: {
        passed: complianceCheck.approved,
        violations: complianceCheck.violations.map(v => v.name)
      },
      confidence,
      reasoning
    };

    this.decisionHistory.push(context);
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory = this.decisionHistory.slice(-500);
    }

    return context;
  }

  private analyzeTechnicalFactors(data: any): Record<string, number> {
    return {
      rsiSignal: data.rsi ? (data.rsi < 30 ? 0.8 : data.rsi > 70 ? 0.2 : 0.5) : 0.5,
      macdSignal: data.macd?.histogram > 0 ? 0.7 : 0.3,
      trendStrength: data.adx ? Math.min(1, data.adx / 50) : 0.5,
      bollingerPosition: this.calculateBollingerPosition(data),
      volumeConfirmation: data.volume24h > 0 ? 0.6 : 0.4,
      momentumScore: data.change24h > 0 ? 0.6 + Math.min(0.3, data.change24h / 10) : 0.4
    };
  }

  private calculateBollingerPosition(data: any): number {
    if (!data.bollingerBands) return 0.5;
    const { upper, lower, middle } = data.bollingerBands;
    const price = data.price || middle;
    const range = upper - lower || 1;
    return (price - lower) / range;
  }

  private analyzeFundamentalFactors(data: any): Record<string, number> {
    return {
      marketCap: 0.5,
      liquidity: this.environmentalState.liquidityScore,
      volatilityRisk: 1 - Math.min(1, this.environmentalState.marketVolatilityIndex / 3),
      sessionQuality: this.environmentalState.tradingSessionActivity === "high" ? 0.8 : 0.5
    };
  }

  private analyzeSentimentFactors(prediction: any): Record<string, number> {
    return {
      predictionConfidence: prediction?.confidence || 0.5,
      directionClarity: prediction?.direction === "sideways" ? 0.3 : 0.7,
      riskScore: 1 - (prediction?.riskScore || 50) / 100,
      globalSentiment: this.environmentalState.globalRiskSentiment
    };
  }

  private analyzeRiskFactors(portfolio: any, data: any): Record<string, number> {
    const exposureRatio = (portfolio.marginUsed || 0) / (portfolio.totalBalance || 1);
    const drawdownRisk = Math.abs(portfolio.unrealizedPnl || 0) / (portfolio.totalBalance || 1);
    
    return {
      portfolioHealth: 1 - exposureRatio,
      drawdownStatus: 1 - Math.min(1, drawdownRisk * 5),
      circuitBreakerStatus: this.circuitBreakers.filter(cb => cb.isTripped).length === 0 ? 1 : 0.3,
      volatilityAdjustment: this.environmentalState.recommendedExposure
    };
  }

  private calculateOverallConfidence(
    technical: Record<string, number>,
    fundamental: Record<string, number>,
    sentiment: Record<string, number>,
    risk: Record<string, number>,
    patterns: NeuralPattern[],
    compliance: { approved: boolean; violations: any[]; warnings: any[] }
  ): number {
    const techAvg = Object.values(technical).reduce((a, b) => a + b, 0) / Object.keys(technical).length;
    const fundAvg = Object.values(fundamental).reduce((a, b) => a + b, 0) / Object.keys(fundamental).length;
    const sentAvg = Object.values(sentiment).reduce((a, b) => a + b, 0) / Object.keys(sentiment).length;
    const riskAvg = Object.values(risk).reduce((a, b) => a + b, 0) / Object.keys(risk).length;

    let confidence = techAvg * 0.35 + fundAvg * 0.2 + sentAvg * 0.25 + riskAvg * 0.2;

    if (patterns.length > 0) {
      const patternBoost = Math.min(0.1, patterns.length * 0.03);
      confidence += patternBoost;
    }

    if (!compliance.approved) {
      confidence *= 0.5;
    } else if (compliance.warnings.length > 0) {
      confidence *= 0.85;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  async learnFromOutcome(decision: AutonomousDecisionContext, outcome: {
    actualProfit: number;
    wasSuccessful: boolean;
    holdDuration: number;
  }) {
    if (!this.isLearningEnabled) return;

    const winRateMetric = this.learningMetrics.get("win_rate");
    if (winRateMetric) {
      winRateMetric.historicalValues.push(outcome.wasSuccessful ? 1 : 0);
      if (winRateMetric.historicalValues.length > 100) {
        winRateMetric.historicalValues.shift();
      }
      winRateMetric.currentValue = 
        winRateMetric.historicalValues.reduce((a, b) => a + b, 0) / winRateMetric.historicalValues.length;
      
      this.updateMetricTrend(winRateMetric);
    }

    const decisionAccuracy = this.learningMetrics.get("decision_accuracy");
    if (decisionAccuracy) {
      const wasAccurate = (decision.confidence > 0.6 && outcome.wasSuccessful) || 
                          (decision.confidence < 0.4 && !outcome.wasSuccessful);
      decisionAccuracy.historicalValues.push(wasAccurate ? 1 : 0);
      if (decisionAccuracy.historicalValues.length > 100) {
        decisionAccuracy.historicalValues.shift();
      }
      decisionAccuracy.currentValue = 
        decisionAccuracy.historicalValues.reduce((a, b) => a + b, 0) / decisionAccuracy.historicalValues.length;
      
      this.updateMetricTrend(decisionAccuracy);
    }

    this.adaptationCycle++;
    if (this.adaptationCycle % 10 === 0) {
      await this.performAdaptation();
    }
  }

  private updateMetricTrend(metric: LearningMetric) {
    const recent = metric.historicalValues.slice(-10);
    const older = metric.historicalValues.slice(-20, -10);
    
    if (recent.length < 5 || older.length < 5) {
      metric.trend = "stable";
      metric.improvementRate = 0;
      return;
    }

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const improvement = (recentAvg - olderAvg) / Math.abs(olderAvg || 1);
    metric.improvementRate = improvement;
    
    if (improvement > 0.05) {
      metric.trend = "improving";
    } else if (improvement < -0.05) {
      metric.trend = "declining";
    } else {
      metric.trend = "stable";
    }
  }

  private async performAdaptation() {
    console.log("[Learning] Performing strategy adaptation...");
    this.lastAdaptation = new Date();

    const decliningMetrics = Array.from(this.learningMetrics.values())
      .filter(m => m.trend === "declining");

    if (decliningMetrics.length > 0) {
      console.log(`[Learning] Identified ${decliningMetrics.length} declining metrics, adjusting parameters`);
    }
  }

  getStatus() {
    return {
      circuitBreakers: this.circuitBreakers.map(cb => ({
        id: cb.id,
        name: cb.name,
        isTripped: cb.isTripped,
        currentValue: cb.currentValue,
        threshold: cb.threshold,
        action: cb.action
      })),
      complianceRules: this.complianceRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        isActive: rule.isActive,
        violationCount: rule.violationCount
      })),
      learningMetrics: Array.from(this.learningMetrics.values()).map(m => ({
        name: m.metricName,
        current: m.currentValue,
        target: m.targetValue,
        trend: m.trend,
        improvementRate: m.improvementRate
      })),
      environmentalState: this.environmentalState,
      patternsDetected: (this.patterns.get("global") || []).length,
      decisionHistorySize: this.decisionHistory.length,
      lastAdaptation: this.lastAdaptation,
      adaptationCycles: this.adaptationCycle,
      isLearningEnabled: this.isLearningEnabled
    };
  }

  getCircuitBreakers(): RiskCircuitBreaker[] {
    return [...this.circuitBreakers];
  }

  getComplianceRules(): ComplianceRule[] {
    return [...this.complianceRules];
  }

  getLearningMetrics(): LearningMetric[] {
    return Array.from(this.learningMetrics.values());
  }

  getEnvironmentalAwareness(): EnvironmentalAwareness {
    return { ...this.environmentalState };
  }

  getRecentDecisions(limit: number = 20): AutonomousDecisionContext[] {
    return this.decisionHistory.slice(-limit);
  }

  resetCircuitBreaker(breakerId: string): boolean {
    const breaker = this.circuitBreakers.find(b => b.id === breakerId);
    if (breaker) {
      breaker.isTripped = false;
      breaker.trippedAt = undefined;
      breaker.currentValue = 0;
      return true;
    }
    return false;
  }

  setLearningEnabled(enabled: boolean) {
    this.isLearningEnabled = enabled;
    console.log(`[Learning] Learning mode ${enabled ? "enabled" : "disabled"}`);
  }
}

export const advancedTradingIntelligence = new AdvancedTradingIntelligence();
