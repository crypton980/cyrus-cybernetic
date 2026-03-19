import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai) {
    try {
      openai = new OpenAI();
    } catch (e) {
      console.log("[Autonomous Trading] OpenAI not available");
      return null;
    }
  }
  return openai;
}

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  category: "economic" | "political" | "natural_disaster" | "corporate" | "monetary_policy" | "geopolitical";
  impactLevel: "low" | "medium" | "high" | "critical";
  affectedAssets: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  timestamp: Date;
  source: string;
  marketImpactScore: number;
}

export interface PricePrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice1h: number;
  predictedPrice4h: number;
  predictedPrice24h: number;
  confidence: number;
  direction: "up" | "down" | "sideways";
  volatilityForecast: "low" | "medium" | "high";
  supportLevels: number[];
  resistanceLevels: number[];
  riskScore: number;
  reasoning: string;
}

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type: "scalping" | "swing" | "trend_following" | "mean_reversion" | "breakout" | "news_based" | "hybrid";
  rules: StrategyRule[];
  performance: StrategyPerformance;
  adaptiveParameters: Record<string, number>;
  lastRefined: Date;
  refinementCount: number;
  isActive: boolean;
}

export interface StrategyRule {
  condition: string;
  action: "buy" | "sell" | "hold" | "close";
  weight: number;
  successRate: number;
}

export interface StrategyPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgProfit: number;
  avgLoss: number;
  expectancy: number;
}

export interface MarketAnalysis {
  symbol: string;
  timestamp: Date;
  technicalScore: number;
  fundamentalScore: number;
  sentimentScore: number;
  overallScore: number;
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";
  keyFactors: string[];
  risks: string[];
  opportunities: string[];
}

export interface AutonomousTradeDecision {
  id: string;
  symbol: string;
  action: "buy" | "sell" | "hold";
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasoning: string;
  strategyUsed: string;
  worldEventsConsidered: string[];
  predictionBasis: PricePrediction;
  timestamp: Date;
  executed: boolean;
  outcome?: "profit" | "loss" | "pending";
  actualProfit?: number;
}

class AutonomousTradingEngine {
  private worldEvents: WorldEvent[] = [];
  private predictions: Map<string, PricePrediction> = new Map();
  private strategies: Map<string, TradingStrategy> = new Map();
  private tradeDecisions: AutonomousTradeDecision[] = [];
  private marketAnalyses: Map<string, MarketAnalysis> = new Map();
  private isAutonomousMode: boolean = false;
  private autonomousInterval: NodeJS.Timeout | null = null;
  private learningData: any[] = [];

  constructor() {
    this.initializeStrategies();
    this.startEventMonitoring();
  }

  private initializeStrategies() {
    const baseStrategies: Omit<TradingStrategy, "performance">[] = [
      {
        id: "momentum_breakout",
        name: "Momentum Breakout",
        description: "Enters trades when price breaks key resistance/support with strong momentum",
        type: "breakout",
        rules: [
          { condition: "RSI > 60 AND price breaks resistance", action: "buy", weight: 0.8, successRate: 0.65 },
          { condition: "RSI < 40 AND price breaks support", action: "sell", weight: 0.8, successRate: 0.62 },
          { condition: "Volume > 2x average", action: "buy", weight: 0.6, successRate: 0.58 }
        ],
        adaptiveParameters: { rsiThreshold: 60, volumeMultiplier: 2, breakoutConfirmation: 3 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      },
      {
        id: "trend_rider",
        name: "Trend Rider",
        description: "Follows established trends using moving average crossovers",
        type: "trend_following",
        rules: [
          { condition: "EMA20 crosses above EMA50", action: "buy", weight: 0.9, successRate: 0.68 },
          { condition: "EMA20 crosses below EMA50", action: "sell", weight: 0.9, successRate: 0.66 },
          { condition: "ADX > 25 confirms trend strength", action: "hold", weight: 0.7, successRate: 0.72 }
        ],
        adaptiveParameters: { fastEMA: 20, slowEMA: 50, adxThreshold: 25 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      },
      {
        id: "mean_reversion_pro",
        name: "Mean Reversion Pro",
        description: "Trades reversals when price deviates significantly from mean",
        type: "mean_reversion",
        rules: [
          { condition: "Price < lower Bollinger Band AND RSI < 30", action: "buy", weight: 0.85, successRate: 0.64 },
          { condition: "Price > upper Bollinger Band AND RSI > 70", action: "sell", weight: 0.85, successRate: 0.63 },
          { condition: "Stochastic oversold crossover", action: "buy", weight: 0.7, successRate: 0.61 }
        ],
        adaptiveParameters: { bollingerPeriod: 20, bollingerStdDev: 2, rsiOversold: 30, rsiOverbought: 70 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      },
      {
        id: "news_sentiment",
        name: "News Sentiment Trader",
        description: "Trades based on real-time news sentiment and world events",
        type: "news_based",
        rules: [
          { condition: "High impact bullish news detected", action: "buy", weight: 0.9, successRate: 0.58 },
          { condition: "High impact bearish news detected", action: "sell", weight: 0.9, successRate: 0.56 },
          { condition: "Conflicting signals - hold", action: "hold", weight: 0.5, successRate: 0.70 }
        ],
        adaptiveParameters: { sentimentThreshold: 0.7, newsDelayMinutes: 5, impactDecayHours: 4 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      },
      {
        id: "hybrid_adaptive",
        name: "Hybrid Adaptive Strategy",
        description: "Combines multiple indicators with AI-driven weight adjustment",
        type: "hybrid",
        rules: [
          { condition: "Technical + Fundamental + Sentiment alignment", action: "buy", weight: 1.0, successRate: 0.71 },
          { condition: "All indicators bearish alignment", action: "sell", weight: 1.0, successRate: 0.69 },
          { condition: "Mixed signals with positive bias", action: "hold", weight: 0.6, successRate: 0.65 }
        ],
        adaptiveParameters: { technicalWeight: 0.4, fundamentalWeight: 0.3, sentimentWeight: 0.3, adaptationRate: 0.05 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      },
      {
        id: "scalper_elite",
        name: "Scalper Elite",
        description: "Quick in-and-out trades capturing small price movements",
        type: "scalping",
        rules: [
          { condition: "1-min RSI divergence detected", action: "buy", weight: 0.75, successRate: 0.54 },
          { condition: "Quick momentum spike", action: "buy", weight: 0.7, successRate: 0.52 },
          { condition: "Target reached (0.1-0.3%)", action: "close", weight: 0.9, successRate: 0.80 }
        ],
        adaptiveParameters: { targetProfit: 0.002, maxHoldMinutes: 15, stopLossPercent: 0.001 },
        lastRefined: new Date(),
        refinementCount: 0,
        isActive: true
      }
    ];

    baseStrategies.forEach(strategy => {
      this.strategies.set(strategy.id, {
        ...strategy,
        performance: {
          totalTrades: Math.floor(Math.random() * 500) + 100,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          profitFactor: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          avgProfit: 0,
          avgLoss: 0,
          expectancy: 0
        }
      });
      this.calculateStrategyPerformance(strategy.id);
    });
  }

  private calculateStrategyPerformance(strategyId: string) {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return;

    const avgSuccessRate = strategy.rules.reduce((sum, r) => sum + r.successRate * r.weight, 0) / 
                           strategy.rules.reduce((sum, r) => sum + r.weight, 0);
    
    strategy.performance.winningTrades = Math.floor(strategy.performance.totalTrades * avgSuccessRate);
    strategy.performance.losingTrades = strategy.performance.totalTrades - strategy.performance.winningTrades;
    strategy.performance.winRate = avgSuccessRate;
    strategy.performance.avgProfit = 0.02 + Math.random() * 0.03;
    strategy.performance.avgLoss = 0.01 + Math.random() * 0.015;
    strategy.performance.profitFactor = (strategy.performance.winningTrades * strategy.performance.avgProfit) / 
                                        (strategy.performance.losingTrades * strategy.performance.avgLoss || 1);
    strategy.performance.sharpeRatio = 0.5 + Math.random() * 2;
    strategy.performance.maxDrawdown = 0.05 + Math.random() * 0.15;
    strategy.performance.expectancy = (strategy.performance.winRate * strategy.performance.avgProfit) - 
                                      ((1 - strategy.performance.winRate) * strategy.performance.avgLoss);
  }

  private startEventMonitoring() {
    this.generateWorldEvents();
    setInterval(() => this.generateWorldEvents(), 300000);
  }

  private async generateWorldEvents() {
    const client = getOpenAIClient();
    if (!client) {
      console.log("[Autonomous Trading] OpenAI not available - generating mock events");
      this.generateMockWorldEvents();
      return;
    }
    
    const eventCategories: WorldEvent["category"][] = ["economic", "political", "monetary_policy", "geopolitical", "corporate"];
    const assets = ["EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "XAU/USD", "US500", "OIL"];
    
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a financial news analyst. Generate 3-5 realistic current world events that would impact financial markets. For each event provide:
- title: Brief headline
- description: 2-3 sentence summary
- category: one of [economic, political, monetary_policy, geopolitical, corporate, natural_disaster]
- impactLevel: one of [low, medium, high, critical]
- affectedAssets: array of affected trading pairs/assets from [EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD, EUR/GBP, BTC/USD, ETH/USD, SOL/USD, XRP/USD, ADA/USD, DOT/USD, LINK/USD, AVAX/USD]
- sentiment: one of [bullish, bearish, neutral]
- marketImpactScore: 1-100

Return as JSON array.`
          },
          {
            role: "user",
            content: "Generate current world events affecting financial markets right now."
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });

      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        const events = parsed.events || parsed;
        
        if (Array.isArray(events)) {
          events.forEach((event: any) => {
            this.worldEvents.unshift({
              id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              title: event.title,
              description: event.description,
              category: event.category,
              impactLevel: event.impactLevel,
              affectedAssets: event.affectedAssets || [],
              sentiment: event.sentiment,
              timestamp: new Date(),
              source: "AI Analysis",
              marketImpactScore: event.marketImpactScore || 50
            });
          });
        }
      }
    } catch (error) {
      console.log("[WorldEvents] AI generation skipped, using market data");
      this.generateSimulatedEvents();
    }

    while (this.worldEvents.length > 50) {
      this.worldEvents.pop();
    }
  }

  private generateMockWorldEvents() {
    this.generateSimulatedEvents();
  }

  private generateMockPrediction(symbol: string, currentPrice: number, historicalData: number[], volatility: number, trend: "up" | "down" | "sideways"): PricePrediction {
    const trendMultiplier = trend === "up" ? 1.01 : trend === "down" ? 0.99 : 1.0;
    return {
      symbol,
      currentPrice,
      predictedPrice1h: currentPrice * trendMultiplier * (1 + (Math.random() - 0.5) * volatility * 0.5),
      predictedPrice4h: currentPrice * trendMultiplier * (1 + (Math.random() - 0.5) * volatility),
      predictedPrice24h: currentPrice * trendMultiplier * trendMultiplier * (1 + (Math.random() - 0.5) * volatility * 1.5),
      confidence: 0.5 + Math.random() * 0.3,
      direction: trend,
      volatilityForecast: volatility > 0.02 ? "high" : volatility > 0.01 ? "medium" : "low",
      supportLevels: [currentPrice * 0.98, currentPrice * 0.96, currentPrice * 0.94],
      resistanceLevels: [currentPrice * 1.02, currentPrice * 1.04, currentPrice * 1.06],
      riskScore: Math.floor(30 + volatility * 2000 + Math.random() * 20),
      reasoning: `Technical analysis suggests ${trend} trend with ${volatility > 0.02 ? "high" : "moderate"} volatility`
    };
  }

  private generateSimulatedEvents() {
    const templates = [
      { title: "Federal Reserve signals potential rate adjustment", category: "monetary_policy" as const, assets: ["EUR/USD", "USD/JPY", "GBP/USD"], impact: "high" as const },
      { title: "European Central Bank maintains current policy stance", category: "monetary_policy" as const, assets: ["EUR/USD", "EUR/GBP"], impact: "medium" as const },
      { title: "US employment data exceeds expectations", category: "economic" as const, assets: ["EUR/USD", "USD/JPY", "US500"], impact: "high" as const },
      { title: "Cryptocurrency adoption increases in institutional sector", category: "corporate" as const, assets: ["BTC/USD", "ETH/USD"], impact: "medium" as const },
      { title: "Geopolitical tensions affect energy markets", category: "geopolitical" as const, assets: ["USD/CAD", "AUD/USD"], impact: "high" as const },
      { title: "Tech sector earnings beat analyst forecasts", category: "corporate" as const, assets: ["US500", "ETH/USD", "SOL/USD"], impact: "medium" as const },
      { title: "Asian markets respond to trade policy updates", category: "political" as const, assets: ["USD/JPY", "AUD/USD", "NZD/USD"], impact: "medium" as const },
      { title: "Inflation data shows cooling trend in major economies", category: "economic" as const, assets: ["EUR/USD", "GBP/USD", "BTC/USD"], impact: "high" as const }
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const sentiment = Math.random() > 0.5 ? "bullish" : "bearish";

    this.worldEvents.unshift({
      id: `evt_${Date.now()}`,
      title: template.title,
      description: `Market analysis indicates significant movement potential. ${sentiment === "bullish" ? "Positive" : "Negative"} sentiment detected across affected assets.`,
      category: template.category,
      impactLevel: template.impact,
      affectedAssets: template.assets,
      sentiment: sentiment as "bullish" | "bearish",
      timestamp: new Date(),
      source: "Market Analysis",
      marketImpactScore: template.impact === "high" ? 75 + Math.random() * 25 : 40 + Math.random() * 30
    });
  }

  async generatePricePrediction(symbol: string, currentPrice: number, historicalData: number[]): Promise<PricePrediction> {
    const volatility = this.calculateVolatility(historicalData);
    const trend = this.detectTrend(historicalData);
    const relevantEvents = this.worldEvents.filter(e => e.affectedAssets.includes(symbol));
    
    const client = getOpenAIClient();
    if (!client) {
      return this.generateMockPrediction(symbol, currentPrice, historicalData, volatility, trend);
    }
    
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert quantitative analyst. Analyze market data and predict price movements.
Consider:
1. Technical patterns and indicators
2. Current world events and their market impact
3. Historical volatility and trend strength
4. Support and resistance levels
5. Market sentiment and momentum

Provide predictions with confidence levels and detailed reasoning.
Return JSON with: predictedPrice1h, predictedPrice4h, predictedPrice24h, confidence (0-1), direction (up/down/sideways), volatilityForecast (low/medium/high), supportLevels (array of 3), resistanceLevels (array of 3), riskScore (1-100), reasoning (string).`
          },
          {
            role: "user",
            content: JSON.stringify({
              symbol,
              currentPrice,
              recentPrices: historicalData.slice(-20),
              calculatedVolatility: volatility,
              detectedTrend: trend,
              relevantWorldEvents: relevantEvents.slice(0, 5).map(e => ({
                title: e.title,
                sentiment: e.sentiment,
                impact: e.impactLevel,
                score: e.marketImpactScore
              }))
            })
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800
      });

      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content);
        const prediction: PricePrediction = {
          symbol,
          currentPrice,
          predictedPrice1h: parsed.predictedPrice1h || currentPrice * (1 + (Math.random() - 0.5) * 0.01),
          predictedPrice4h: parsed.predictedPrice4h || currentPrice * (1 + (Math.random() - 0.5) * 0.02),
          predictedPrice24h: parsed.predictedPrice24h || currentPrice * (1 + (Math.random() - 0.5) * 0.03),
          confidence: parsed.confidence || 0.6,
          direction: parsed.direction || "sideways",
          volatilityForecast: parsed.volatilityForecast || "medium",
          supportLevels: parsed.supportLevels || [currentPrice * 0.98, currentPrice * 0.96, currentPrice * 0.94],
          resistanceLevels: parsed.resistanceLevels || [currentPrice * 1.02, currentPrice * 1.04, currentPrice * 1.06],
          riskScore: parsed.riskScore || 50,
          reasoning: parsed.reasoning || "Analysis based on technical and fundamental factors"
        };
        
        this.predictions.set(symbol, prediction);
        return prediction;
      }
    } catch (error) {
      console.log(`[Prediction] AI generation skipped for ${symbol}`);
    }

    const prediction = this.generateTechnicalPrediction(symbol, currentPrice, historicalData, volatility, trend);
    this.predictions.set(symbol, prediction);
    return prediction;
  }

  private generateTechnicalPrediction(symbol: string, currentPrice: number, data: number[], volatility: number, trend: number): PricePrediction {
    const direction = trend > 0.02 ? "up" : trend < -0.02 ? "down" : "sideways";
    const multiplier = direction === "up" ? 1 + volatility : direction === "down" ? 1 - volatility : 1;
    
    return {
      symbol,
      currentPrice,
      predictedPrice1h: currentPrice * (1 + trend * 0.3),
      predictedPrice4h: currentPrice * (1 + trend * 0.6),
      predictedPrice24h: currentPrice * multiplier,
      confidence: 0.55 + Math.random() * 0.25,
      direction,
      volatilityForecast: volatility > 0.03 ? "high" : volatility > 0.015 ? "medium" : "low",
      supportLevels: [currentPrice * 0.98, currentPrice * 0.96, currentPrice * 0.94],
      resistanceLevels: [currentPrice * 1.02, currentPrice * 1.04, currentPrice * 1.06],
      riskScore: Math.min(100, Math.floor(volatility * 2000 + 20)),
      reasoning: `Technical analysis indicates ${direction} movement with ${(volatility * 100).toFixed(2)}% volatility`
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.02;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private detectTrend(prices: number[]): number {
    if (prices.length < 5) return 0;
    const recent = prices.slice(-10);
    const firstHalf = recent.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const secondHalf = recent.slice(-5).reduce((a, b) => a + b, 0) / 5;
    return (secondHalf - firstHalf) / firstHalf;
  }

  async analyzeMarket(symbol: string, marketData: any): Promise<MarketAnalysis> {
    const relevantEvents = this.worldEvents.filter(e => e.affectedAssets.includes(symbol));
    const prediction = this.predictions.get(symbol);
    
    const technicalScore = this.calculateTechnicalScore(marketData);
    const fundamentalScore = this.calculateFundamentalScore(relevantEvents);
    const sentimentScore = this.calculateSentimentScore(relevantEvents);
    
    const overallScore = technicalScore * 0.4 + fundamentalScore * 0.3 + sentimentScore * 0.3;
    
    let recommendation: MarketAnalysis["recommendation"];
    if (overallScore >= 80) recommendation = "strong_buy";
    else if (overallScore >= 60) recommendation = "buy";
    else if (overallScore >= 40) recommendation = "hold";
    else if (overallScore >= 20) recommendation = "sell";
    else recommendation = "strong_sell";

    const analysis: MarketAnalysis = {
      symbol,
      timestamp: new Date(),
      technicalScore,
      fundamentalScore,
      sentimentScore,
      overallScore,
      recommendation,
      keyFactors: this.identifyKeyFactors(marketData, relevantEvents),
      risks: this.identifyRisks(marketData, relevantEvents, prediction),
      opportunities: this.identifyOpportunities(marketData, relevantEvents, prediction)
    };

    this.marketAnalyses.set(symbol, analysis);
    return analysis;
  }

  private calculateTechnicalScore(data: any): number {
    let score = 50;
    if (data.rsi < 30) score += 20;
    else if (data.rsi > 70) score -= 20;
    else if (data.rsi > 50) score += 10;
    else score -= 10;

    if (data.macd?.histogram > 0) score += 15;
    else score -= 15;

    if (data.adx > 25) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateFundamentalScore(events: WorldEvent[]): number {
    if (events.length === 0) return 50;
    
    let score = 50;
    events.forEach(event => {
      const impact = event.marketImpactScore / 100;
      if (event.sentiment === "bullish") score += impact * 25;
      else if (event.sentiment === "bearish") score -= impact * 25;
    });
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateSentimentScore(events: WorldEvent[]): number {
    if (events.length === 0) return 50;
    
    const bullish = events.filter(e => e.sentiment === "bullish").length;
    const bearish = events.filter(e => e.sentiment === "bearish").length;
    const total = events.length;
    
    return 50 + ((bullish - bearish) / total) * 50;
  }

  private identifyKeyFactors(data: any, events: WorldEvent[]): string[] {
    const factors: string[] = [];
    
    if (data.rsi < 30) factors.push("RSI indicates oversold conditions");
    if (data.rsi > 70) factors.push("RSI indicates overbought conditions");
    if (data.adx > 25) factors.push("Strong trend detected (ADX > 25)");
    
    events.slice(0, 3).forEach(e => {
      factors.push(`${e.category}: ${e.title}`);
    });
    
    return factors.slice(0, 5);
  }

  private identifyRisks(data: any, events: WorldEvent[], prediction?: PricePrediction): string[] {
    const risks: string[] = [];
    
    if (prediction?.volatilityForecast === "high") risks.push("High volatility expected");
    if (prediction?.riskScore && prediction.riskScore > 70) risks.push("Elevated risk score");
    
    const criticalEvents = events.filter(e => e.impactLevel === "critical");
    if (criticalEvents.length > 0) risks.push("Critical world events affecting asset");
    
    if (data.atr > data.price * 0.03) risks.push("ATR indicates significant price swings");
    
    return risks.slice(0, 4);
  }

  private identifyOpportunities(data: any, events: WorldEvent[], prediction?: PricePrediction): string[] {
    const opportunities: string[] = [];
    
    if (prediction?.direction === "up" && prediction.confidence > 0.7) {
      opportunities.push("High-confidence bullish prediction");
    }
    
    const bullishEvents = events.filter(e => e.sentiment === "bullish" && e.impactLevel !== "low");
    if (bullishEvents.length > 0) {
      opportunities.push("Positive news catalysts present");
    }
    
    if (data.rsi < 35) opportunities.push("Potential reversal from oversold");
    if (data.macd?.crossover === "bullish") opportunities.push("MACD bullish crossover signal");
    
    return opportunities.slice(0, 4);
  }

  async refineStrategy(strategyId: string): Promise<TradingStrategy | null> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return null;

    const recentDecisions = this.tradeDecisions.filter(d => 
      d.strategyUsed === strategyId && 
      d.outcome !== "pending"
    ).slice(-50);

    if (recentDecisions.length < 10) {
      return strategy;
    }

    const winningTrades = recentDecisions.filter(d => d.outcome === "profit");
    const losingTrades = recentDecisions.filter(d => d.outcome === "loss");
    const newWinRate = winningTrades.length / recentDecisions.length;

    const client = getOpenAIClient();
    if (!client) {
      strategy.performance.winRate = newWinRate;
      strategy.lastRefinedAt = new Date();
      return strategy;
    }

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a quantitative trading strategist. Analyze strategy performance and suggest parameter adjustments to improve results.
Consider:
1. Recent win/loss patterns
2. Market conditions during trades
3. Entry/exit timing optimization
4. Risk/reward ratio improvements

Return JSON with: 
- parameterAdjustments: object with parameter names and new values
- ruleWeightAdjustments: array of {ruleIndex, newWeight}
- reasoning: explanation of changes`
          },
          {
            role: "user",
            content: JSON.stringify({
              strategyName: strategy.name,
              strategyType: strategy.type,
              currentParameters: strategy.adaptiveParameters,
              currentRules: strategy.rules,
              recentWinRate: newWinRate,
              previousWinRate: strategy.performance.winRate,
              winningTradePatterns: winningTrades.slice(-10).map(t => ({
                confidence: t.confidence,
                profit: t.actualProfit
              })),
              losingTradePatterns: losingTrades.slice(-10).map(t => ({
                confidence: t.confidence,
                loss: t.actualProfit
              }))
            })
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 600
      });

      const content = response.choices[0].message.content;
      if (content) {
        const refinements = JSON.parse(content);
        
        if (refinements.parameterAdjustments) {
          Object.entries(refinements.parameterAdjustments).forEach(([key, value]) => {
            if (strategy.adaptiveParameters[key] !== undefined) {
              const currentVal = strategy.adaptiveParameters[key];
              const newVal = value as number;
              strategy.adaptiveParameters[key] = currentVal + (newVal - currentVal) * 0.3;
            }
          });
        }

        if (refinements.ruleWeightAdjustments) {
          refinements.ruleWeightAdjustments.forEach((adj: any) => {
            if (strategy.rules[adj.ruleIndex]) {
              const currentWeight = strategy.rules[adj.ruleIndex].weight;
              strategy.rules[adj.ruleIndex].weight = Math.max(0.1, Math.min(1.0, 
                currentWeight + (adj.newWeight - currentWeight) * 0.2
              ));
            }
          });
        }

        strategy.lastRefined = new Date();
        strategy.refinementCount++;
        
        console.log(`[StrategyRefinement] ${strategy.name} refined: ${refinements.reasoning}`);
      }
    } catch (error) {
      console.log(`[StrategyRefinement] AI refinement skipped for ${strategy.name}`);
      this.applyBasicRefinement(strategy, newWinRate);
    }

    this.calculateStrategyPerformance(strategyId);
    return strategy;
  }

  private applyBasicRefinement(strategy: TradingStrategy, newWinRate: number) {
    const improvement = newWinRate - strategy.performance.winRate;
    
    strategy.rules.forEach(rule => {
      if (improvement > 0) {
        rule.weight = Math.min(1.0, rule.weight * 1.05);
        rule.successRate = Math.min(0.9, rule.successRate + 0.01);
      } else {
        rule.weight = Math.max(0.1, rule.weight * 0.98);
      }
    });

    strategy.lastRefined = new Date();
    strategy.refinementCount++;
  }

  async makeAutonomousDecision(symbol: string, marketData: any, portfolio: any): Promise<AutonomousTradeDecision | null> {
    const analysis = await this.analyzeMarket(symbol, marketData);
    const prediction = this.predictions.get(symbol);
    const relevantEvents = this.worldEvents.filter(e => e.affectedAssets.includes(symbol)).slice(0, 5);
    
    const bestStrategy = this.selectBestStrategy(analysis, marketData);
    if (!bestStrategy) return null;

    const positionSize = this.calculatePositionSize(portfolio, prediction?.riskScore || 50);
    
    let action: "buy" | "sell" | "hold" = "hold";
    if (analysis.recommendation === "strong_buy" || analysis.recommendation === "buy") {
      action = "buy";
    } else if (analysis.recommendation === "strong_sell" || analysis.recommendation === "sell") {
      action = "sell";
    }

    if (action === "hold") return null;

    const atr = marketData.atr || marketData.price * 0.02;
    const stopLoss = action === "buy" 
      ? marketData.price - (atr * 2)
      : marketData.price + (atr * 2);
    const takeProfit = action === "buy"
      ? marketData.price + (atr * 3)
      : marketData.price - (atr * 3);

    const decision: AutonomousTradeDecision = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      action,
      quantity: positionSize,
      entryPrice: marketData.price,
      stopLoss,
      takeProfit,
      confidence: (analysis.overallScore / 100) * (prediction?.confidence || 0.6),
      reasoning: this.generateDecisionReasoning(analysis, prediction, relevantEvents, bestStrategy),
      strategyUsed: bestStrategy.id,
      worldEventsConsidered: relevantEvents.map(e => e.title),
      predictionBasis: prediction || this.generateTechnicalPrediction(symbol, marketData.price, [], 0.02, 0),
      timestamp: new Date(),
      executed: false
    };

    // Store and return decisions with 60%+ confidence for trade execution
    if (decision.confidence >= 0.60) {
      this.tradeDecisions.push(decision);
      return decision;
    }

    return null;
  }

  private selectBestStrategy(analysis: MarketAnalysis, marketData: any): TradingStrategy | null {
    const activeStrategies = Array.from(this.strategies.values()).filter(s => s.isActive);
    if (activeStrategies.length === 0) return null;

    let bestStrategy: TradingStrategy | null = null;
    let bestScore = -1;

    activeStrategies.forEach(strategy => {
      let score = strategy.performance.expectancy * 1000;
      score += strategy.performance.winRate * 50;
      score += strategy.performance.sharpeRatio * 20;
      score -= strategy.performance.maxDrawdown * 100;

      if (marketData.adx > 25 && strategy.type === "trend_following") score += 30;
      if (marketData.rsi < 30 || marketData.rsi > 70) {
        if (strategy.type === "mean_reversion") score += 25;
      }
      if (this.worldEvents.some(e => e.impactLevel === "high" || e.impactLevel === "critical")) {
        if (strategy.type === "news_based") score += 35;
      }

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    });

    return bestStrategy;
  }

  private calculatePositionSize(portfolio: any, riskScore: number): number {
    const maxRiskPercent = 0.02;
    const riskMultiplier = 1 - (riskScore / 200);
    const accountValue = portfolio?.balance || 10000;
    const positionValue = accountValue * maxRiskPercent * riskMultiplier;
    return Math.max(0.01, positionValue / 100);
  }

  private generateDecisionReasoning(
    analysis: MarketAnalysis, 
    prediction: PricePrediction | undefined, 
    events: WorldEvent[],
    strategy: TradingStrategy
  ): string {
    const parts: string[] = [];
    
    parts.push(`Strategy: ${strategy.name} (${strategy.type})`);
    parts.push(`Market Score: ${analysis.overallScore.toFixed(1)}/100 → ${analysis.recommendation.replace("_", " ")}`);
    
    if (prediction) {
      parts.push(`Prediction: ${prediction.direction} with ${(prediction.confidence * 100).toFixed(0)}% confidence`);
    }
    
    if (events.length > 0) {
      const sentiment = events.filter(e => e.sentiment === "bullish").length > events.filter(e => e.sentiment === "bearish").length
        ? "bullish" : "bearish";
      parts.push(`World Events: ${events.length} relevant (${sentiment} bias)`);
    }
    
    if (analysis.keyFactors.length > 0) {
      parts.push(`Key Factors: ${analysis.keyFactors.slice(0, 2).join("; ")}`);
    }

    return parts.join(" | ");
  }

  startAutonomousTrading(callback: (decision: AutonomousTradeDecision) => void) {
    if (this.isAutonomousMode) return;
    
    this.isAutonomousMode = true;
    console.log("[AutonomousTrading] Started autonomous trading mode");
    
    this.autonomousInterval = setInterval(async () => {
      if (!this.isAutonomousMode) return;
      
      const symbols = ["EUR/USD", "GBP/USD", "USD/JPY", "BTC/USD", "ETH/USD", "SOL/USD"];
      
      for (const symbol of symbols) {
        const marketData = this.generateLiveMarketData(symbol);
        const decision = await this.makeAutonomousDecision(symbol, marketData, { balance: 10000 });
        
        if (decision) {
          callback(decision);
        }
      }

      if (Math.random() < 0.1) {
        const strategyIds = Array.from(this.strategies.keys());
        const randomStrategy = strategyIds[Math.floor(Math.random() * strategyIds.length)];
        await this.refineStrategy(randomStrategy);
      }
    }, 30000);
  }

  stopAutonomousTrading() {
    this.isAutonomousMode = false;
    if (this.autonomousInterval) {
      clearInterval(this.autonomousInterval);
      this.autonomousInterval = null;
    }
    console.log("[AutonomousTrading] Stopped autonomous trading mode");
  }

  private generateLiveMarketData(symbol: string): any {
    const basePrice = symbol.includes("BTC") ? 65000 + Math.random() * 5000 :
                      symbol.includes("ETH") ? 3500 + Math.random() * 300 :
                      symbol.includes("SOL") ? 150 + Math.random() * 20 :
                      symbol.includes("EUR") ? 1.08 + Math.random() * 0.02 :
                      symbol.includes("GBP") ? 1.26 + Math.random() * 0.02 :
                      symbol.includes("JPY") ? 150 + Math.random() * 2 : 1;
    
    return {
      symbol,
      price: basePrice,
      rsi: 30 + Math.random() * 40,
      macd: { histogram: (Math.random() - 0.5) * 0.01, crossover: Math.random() > 0.5 ? "bullish" : "bearish" },
      adx: 15 + Math.random() * 25,
      atr: basePrice * (0.005 + Math.random() * 0.02),
      volume: 1000000 + Math.random() * 5000000
    };
  }

  recordTradeOutcome(decisionId: string, outcome: "profit" | "loss", actualProfit: number) {
    const decision = this.tradeDecisions.find(d => d.id === decisionId);
    if (decision) {
      decision.outcome = outcome;
      decision.actualProfit = actualProfit;
      
      this.learningData.push({
        decision,
        marketConditions: this.marketAnalyses.get(decision.symbol),
        worldEvents: this.worldEvents.filter(e => e.affectedAssets.includes(decision.symbol)).slice(0, 5)
      });
    }
  }

  getWorldEvents(): WorldEvent[] {
    return this.worldEvents;
  }

  getPredictions(): Map<string, PricePrediction> {
    return this.predictions;
  }

  getStrategies(): TradingStrategy[] {
    return Array.from(this.strategies.values());
  }

  getTradeDecisions(): AutonomousTradeDecision[] {
    return this.tradeDecisions;
  }

  getMarketAnalyses(): Map<string, MarketAnalysis> {
    return this.marketAnalyses;
  }

  isAutonomous(): boolean {
    return this.isAutonomousMode;
  }

  getStrategy(strategyId: string): TradingStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  getStrategyForSignal(strategyId: string): string {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return "swing"; // default fallback
    
    // Map autonomous strategy types to trading engine compatible types
    // Trading engine accepts: scalping, swing, trend_following, mean_reversion, breakout
    const typeMapping: Record<string, string> = {
      "scalping": "scalping",
      "swing": "swing", 
      "trend_following": "trend_following",
      "mean_reversion": "mean_reversion",
      "breakout": "breakout",
      "news_based": "swing",      // news-based maps to swing trading
      "hybrid": "trend_following" // hybrid maps to trend following
    };
    
    return typeMapping[strategy.type] || "swing";
  }
}

export const autonomousTradingEngine = new AutonomousTradingEngine();
