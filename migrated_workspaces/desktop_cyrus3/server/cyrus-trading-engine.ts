import OpenAI from "openai";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } catch (e) {
      console.log("[Trading] OpenAI not available");
      return null;
    }
  }
  return openai;
}

export type MarketType = "forex" | "crypto";
export type OrderType = "market" | "limit" | "stop_loss" | "take_profit";
export type OrderSide = "buy" | "sell";
export type TradingStrategy = "scalping" | "swing" | "trend_following" | "mean_reversion" | "breakout";

export interface MarketData {
  symbol: string;
  type: MarketType;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  volume24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: { value: number; signal: number; histogram: number };
  ema: { short: number; medium: number; long: number };
  sma: { short: number; medium: number; long: number };
  bollingerBands: { upper: number; middle: number; lower: number };
  atr: number;
  stochastic: { k: number; d: number };
  adx: number;
  obv: number;
}

export interface TradeSignal {
  id: string;
  symbol: string;
  type: MarketType;
  side: OrderSide;
  strength: number;
  confidence: number;
  strategy: TradingStrategy;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  reasoning: string;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: MarketType;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  status: "pending" | "open" | "closed" | "cancelled";
  openedAt: number;
  closedAt?: number;
  signalId?: string;
}

export interface Portfolio {
  totalBalance: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positions: Trade[];
}

export interface RiskParameters {
  maxPositionSize: number;
  maxDrawdownPercent: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
  riskPerTrade: number;
  useTrailingStop: boolean;
  trailingStopPercent: number;
  maxLeverage: number;
  allowedMarkets: MarketType[];
  blacklistedSymbols: string[];
}

export interface TradingConfig {
  enabled: boolean;
  autoTrade: boolean;
  strategies: TradingStrategy[];
  riskParams: RiskParameters;
  refreshInterval: number;
  aiAnalysisEnabled: boolean;
}

class CYRUSAutonomousTradingEngine {
  private marketData: Map<string, MarketData> = new Map();
  private signals: TradeSignal[] = [];
  private trades: Trade[] = [];
  private portfolio: Portfolio;
  private config: TradingConfig;
  private isRunning: boolean = false;
  private analysisInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.portfolio = this.initializePortfolio();
    this.config = this.getDefaultConfig();
    this.initializeMarketData();
    console.log("[Trading] CYRUS Autonomous Trading Engine initialized");
  }

  private initializePortfolio(): Portfolio {
    return {
      totalBalance: 100000,
      availableBalance: 100000,
      marginUsed: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      positions: []
    };
  }

  private getDefaultConfig(): TradingConfig {
    return {
      enabled: true,
      autoTrade: false,
      strategies: ["trend_following", "breakout"],
      riskParams: {
        maxPositionSize: 10000,
        maxDrawdownPercent: 10,
        maxDailyLoss: 2000,
        maxOpenPositions: 5,
        riskPerTrade: 2,
        useTrailingStop: true,
        trailingStopPercent: 1.5,
        maxLeverage: 10,
        allowedMarkets: ["forex", "crypto"],
        blacklistedSymbols: []
      },
      refreshInterval: 5000,
      aiAnalysisEnabled: true
    };
  }

  private initializeMarketData(): void {
    const forexPairs = [
      { symbol: "EUR/USD", price: 1.0856 },
      { symbol: "GBP/USD", price: 1.2654 },
      { symbol: "USD/JPY", price: 149.32 },
      { symbol: "AUD/USD", price: 0.6543 },
      { symbol: "USD/CAD", price: 1.3521 },
      { symbol: "USD/CHF", price: 0.8876 },
      { symbol: "NZD/USD", price: 0.6123 },
      { symbol: "EUR/GBP", price: 0.8579 }
    ];

    const cryptoPairs = [
      { symbol: "BTC/USD", price: 67842.50 },
      { symbol: "ETH/USD", price: 3421.75 },
      { symbol: "SOL/USD", price: 178.42 },
      { symbol: "XRP/USD", price: 0.5234 },
      { symbol: "ADA/USD", price: 0.4521 },
      { symbol: "DOT/USD", price: 7.85 },
      { symbol: "LINK/USD", price: 14.32 },
      { symbol: "AVAX/USD", price: 35.67 }
    ];

    forexPairs.forEach(pair => {
      this.marketData.set(pair.symbol, this.generateMarketData(pair.symbol, "forex", pair.price));
    });

    cryptoPairs.forEach(pair => {
      this.marketData.set(pair.symbol, this.generateMarketData(pair.symbol, "crypto", pair.price));
    });
  }

  private generateMarketData(symbol: string, type: MarketType, basePrice: number): MarketData {
    const spreadPercent = type === "forex" ? 0.0001 : 0.001;
    const spread = basePrice * spreadPercent;
    const volatility = type === "forex" ? 0.005 : 0.03;
    const priceChange = basePrice * (Math.random() * volatility * 2 - volatility);
    const price = basePrice + priceChange;

    return {
      symbol,
      type,
      price: Number(price.toFixed(type === "forex" ? 5 : 2)),
      bid: Number((price - spread / 2).toFixed(type === "forex" ? 5 : 2)),
      ask: Number((price + spread / 2).toFixed(type === "forex" ? 5 : 2)),
      spread: Number(spread.toFixed(type === "forex" ? 5 : 4)),
      volume24h: Math.floor(Math.random() * 1000000000) + 100000000,
      change24h: Number(((Math.random() * 10 - 5)).toFixed(2)),
      high24h: Number((price * 1.02).toFixed(type === "forex" ? 5 : 2)),
      low24h: Number((price * 0.98).toFixed(type === "forex" ? 5 : 2)),
      timestamp: Date.now()
    };
  }

  private calculateTechnicalIndicators(symbol: string): TechnicalIndicators {
    const data = this.marketData.get(symbol);
    if (!data) {
      throw new Error(`No market data for ${symbol}`);
    }

    const price = data.price;
    const randomOffset = () => (Math.random() - 0.5) * 0.02;

    return {
      rsi: 30 + Math.random() * 40,
      macd: {
        value: price * randomOffset(),
        signal: price * randomOffset(),
        histogram: price * randomOffset() * 0.5
      },
      ema: {
        short: price * (1 + randomOffset()),
        medium: price * (1 + randomOffset()),
        long: price * (1 + randomOffset())
      },
      sma: {
        short: price * (1 + randomOffset()),
        medium: price * (1 + randomOffset()),
        long: price * (1 + randomOffset())
      },
      bollingerBands: {
        upper: price * 1.02,
        middle: price,
        lower: price * 0.98
      },
      atr: price * 0.015,
      stochastic: {
        k: 20 + Math.random() * 60,
        d: 20 + Math.random() * 60
      },
      adx: 15 + Math.random() * 35,
      obv: Math.floor(Math.random() * 10000000)
    };
  }

  async analyzeMarketWithAI(symbol: string): Promise<TradeSignal | null> {
    const data = this.marketData.get(symbol);
    if (!data) return null;

    const indicators = this.calculateTechnicalIndicators(symbol);

    const client = getOpenAIClient();
    if (!client) {
      return null;
    }
    
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are CYRUS, an autonomous trading AI. Analyze market data and provide trading signals.
            
Your analysis must consider:
1. Technical indicators (RSI, MACD, EMA, Bollinger Bands, ATR)
2. Market conditions and volatility
3. Risk/reward ratio (minimum 1:2)
4. Current price action and trend

Respond with a JSON object:
{
  "action": "buy" | "sell" | "hold",
  "confidence": 0-100,
  "strength": 0-100,
  "strategy": "scalping" | "swing" | "trend_following" | "mean_reversion" | "breakout",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "reasoning": "brief explanation"
}

Only recommend trades with confidence > 70 and risk/reward > 1.5`
          },
          {
            role: "user",
            content: `Analyze ${symbol} (${data.type}):
Price: ${data.price}
Change 24h: ${data.change24h}%
High/Low 24h: ${data.high24h}/${data.low24h}
Volume: ${data.volume24h}

Technical Indicators:
RSI: ${indicators.rsi.toFixed(2)}
MACD: ${indicators.macd.value.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)})
EMA 12/26/50: ${indicators.ema.short.toFixed(4)}/${indicators.ema.medium.toFixed(4)}/${indicators.ema.long.toFixed(4)}
Bollinger: Upper ${indicators.bollingerBands.upper.toFixed(4)}, Lower ${indicators.bollingerBands.lower.toFixed(4)}
ATR: ${indicators.atr.toFixed(4)}
Stochastic K/D: ${indicators.stochastic.k.toFixed(2)}/${indicators.stochastic.d.toFixed(2)}
ADX: ${indicators.adx.toFixed(2)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content || "{}");

      if (analysis.action === "hold" || analysis.confidence < 70) {
        return null;
      }

      const riskReward = Math.abs(analysis.takeProfit - analysis.entryPrice) / 
                         Math.abs(analysis.entryPrice - analysis.stopLoss);

      return {
        id: `SIG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        type: data.type,
        side: analysis.action,
        strength: analysis.strength,
        confidence: analysis.confidence,
        strategy: analysis.strategy,
        entryPrice: analysis.entryPrice,
        stopLoss: analysis.stopLoss,
        takeProfit: analysis.takeProfit,
        riskRewardRatio: riskReward,
        reasoning: analysis.reasoning,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error(`[Trading] AI analysis failed for ${symbol}:`, error);
      return null;
    }
  }

  async generateSignal(symbol: string): Promise<TradeSignal | null> {
    if (this.config.aiAnalysisEnabled) {
      return this.analyzeMarketWithAI(symbol);
    }

    const data = this.marketData.get(symbol);
    if (!data) return null;

    const indicators = this.calculateTechnicalIndicators(symbol);
    
    let side: OrderSide | null = null;
    let strength = 0;
    let strategy: TradingStrategy = "trend_following";
    let reasoning = "";

    if (indicators.rsi < 30 && indicators.macd.histogram > 0) {
      side = "buy";
      strength = 80;
      strategy = "mean_reversion";
      reasoning = "Oversold RSI with bullish MACD divergence";
    } else if (indicators.rsi > 70 && indicators.macd.histogram < 0) {
      side = "sell";
      strength = 80;
      strategy = "mean_reversion";
      reasoning = "Overbought RSI with bearish MACD divergence";
    } else if (data.price > indicators.ema.short && indicators.ema.short > indicators.ema.medium) {
      side = "buy";
      strength = 65;
      strategy = "trend_following";
      reasoning = "Price above EMA with bullish alignment";
    } else if (data.price < indicators.ema.short && indicators.ema.short < indicators.ema.medium) {
      side = "sell";
      strength = 65;
      strategy = "trend_following";
      reasoning = "Price below EMA with bearish alignment";
    }

    if (!side || strength < 60) return null;

    const atrMultiplier = data.type === "forex" ? 1.5 : 2;
    const stopLoss = side === "buy" 
      ? data.price - indicators.atr * atrMultiplier
      : data.price + indicators.atr * atrMultiplier;
    const takeProfit = side === "buy"
      ? data.price + indicators.atr * atrMultiplier * 2
      : data.price - indicators.atr * atrMultiplier * 2;

    const riskReward = Math.abs(takeProfit - data.price) / Math.abs(data.price - stopLoss);

    return {
      id: `SIG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol,
      type: data.type,
      side,
      strength,
      confidence: strength + Math.random() * 10,
      strategy,
      entryPrice: data.price,
      stopLoss: Number(stopLoss.toFixed(data.type === "forex" ? 5 : 2)),
      takeProfit: Number(takeProfit.toFixed(data.type === "forex" ? 5 : 2)),
      riskRewardRatio: riskReward,
      reasoning,
      timestamp: Date.now()
    };
  }

  validateRiskCompliance(signal: TradeSignal, quantity: number): { valid: boolean; reason?: string } {
    const { riskParams } = this.config;
    const positionValue = signal.entryPrice * quantity;

    if (positionValue > riskParams.maxPositionSize) {
      return { valid: false, reason: `Position size ${positionValue} exceeds maximum ${riskParams.maxPositionSize}` };
    }

    if (this.portfolio.positions.length >= riskParams.maxOpenPositions) {
      return { valid: false, reason: `Maximum open positions (${riskParams.maxOpenPositions}) reached` };
    }

    if (!riskParams.allowedMarkets.includes(signal.type)) {
      return { valid: false, reason: `Market type ${signal.type} not allowed` };
    }

    if (riskParams.blacklistedSymbols.includes(signal.symbol)) {
      return { valid: false, reason: `Symbol ${signal.symbol} is blacklisted` };
    }

    const potentialLoss = Math.abs(signal.entryPrice - signal.stopLoss) * quantity;
    const maxRiskAmount = this.portfolio.totalBalance * (riskParams.riskPerTrade / 100);
    if (potentialLoss > maxRiskAmount) {
      return { valid: false, reason: `Potential loss ${potentialLoss} exceeds risk limit ${maxRiskAmount}` };
    }

    const currentDrawdown = (1 - this.portfolio.totalBalance / 100000) * 100;
    if (currentDrawdown >= riskParams.maxDrawdownPercent) {
      return { valid: false, reason: `Current drawdown ${currentDrawdown.toFixed(2)}% exceeds limit ${riskParams.maxDrawdownPercent}%` };
    }

    return { valid: true };
  }

  async executeTrade(signal: TradeSignal, quantity: number): Promise<Trade | null> {
    const compliance = this.validateRiskCompliance(signal, quantity);
    if (!compliance.valid) {
      console.log(`[Trading] Trade rejected: ${compliance.reason}`);
      return null;
    }

    const trade: Trade = {
      id: `TRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      symbol: signal.symbol,
      type: signal.type,
      side: signal.side,
      orderType: "market",
      quantity,
      entryPrice: signal.entryPrice,
      currentPrice: signal.entryPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      pnl: 0,
      pnlPercent: 0,
      status: "open",
      openedAt: Date.now(),
      signalId: signal.id
    };

    this.trades.push(trade);
    this.portfolio.positions.push(trade);
    this.portfolio.marginUsed += trade.entryPrice * quantity;
    this.portfolio.availableBalance -= trade.entryPrice * quantity;
    this.portfolio.totalTrades++;

    console.log(`[Trading] Trade executed: ${trade.side.toUpperCase()} ${quantity} ${trade.symbol} @ ${trade.entryPrice}`);

    return trade;
  }

  async closeTrade(tradeId: string, closePrice?: number): Promise<Trade | null> {
    const trade = this.trades.find(t => t.id === tradeId && t.status === "open");
    if (!trade) return null;

    const currentData = this.marketData.get(trade.symbol);
    const exitPrice = closePrice || (currentData?.price ?? trade.entryPrice);

    trade.currentPrice = exitPrice;
    trade.closedAt = Date.now();
    trade.status = "closed";

    const priceChange = trade.side === "buy" 
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;
    trade.pnl = priceChange * trade.quantity;
    trade.pnlPercent = (priceChange / trade.entryPrice) * 100;

    this.portfolio.realizedPnl += trade.pnl;
    this.portfolio.marginUsed -= trade.entryPrice * trade.quantity;
    this.portfolio.availableBalance += (trade.entryPrice * trade.quantity) + trade.pnl;
    this.portfolio.totalBalance += trade.pnl;

    if (trade.pnl > 0) {
      this.portfolio.winningTrades++;
    } else {
      this.portfolio.losingTrades++;
    }

    this.portfolio.winRate = (this.portfolio.winningTrades / this.portfolio.totalTrades) * 100;
    this.portfolio.positions = this.portfolio.positions.filter(p => p.id !== tradeId);

    console.log(`[Trading] Trade closed: ${trade.symbol} PnL: ${trade.pnl > 0 ? '+' : ''}${trade.pnl.toFixed(2)}`);

    return trade;
  }

  updatePositions(): void {
    this.portfolio.unrealizedPnl = 0;

    for (const trade of this.portfolio.positions) {
      const currentData = this.marketData.get(trade.symbol);
      if (!currentData) continue;

      trade.currentPrice = currentData.price;
      const priceChange = trade.side === "buy"
        ? currentData.price - trade.entryPrice
        : trade.entryPrice - currentData.price;
      trade.pnl = priceChange * trade.quantity;
      trade.pnlPercent = (priceChange / trade.entryPrice) * 100;

      this.portfolio.unrealizedPnl += trade.pnl;

      if (trade.side === "buy") {
        if (currentData.price <= trade.stopLoss || currentData.price >= trade.takeProfit) {
          this.closeTrade(trade.id, currentData.price);
        }
      } else {
        if (currentData.price >= trade.stopLoss || currentData.price <= trade.takeProfit) {
          this.closeTrade(trade.id, currentData.price);
        }
      }
    }
  }

  refreshMarketData(): void {
    for (const [symbol, data] of Array.from(this.marketData.entries())) {
      const volatility = data.type === "forex" ? 0.0005 : 0.005;
      const priceChange = data.price * (Math.random() * volatility * 2 - volatility);
      const newPrice = data.price + priceChange;
      const spread = data.type === "forex" ? newPrice * 0.0001 : newPrice * 0.001;

      this.marketData.set(symbol, {
        ...data,
        price: Number(newPrice.toFixed(data.type === "forex" ? 5 : 2)),
        bid: Number((newPrice - spread / 2).toFixed(data.type === "forex" ? 5 : 2)),
        ask: Number((newPrice + spread / 2).toFixed(data.type === "forex" ? 5 : 2)),
        timestamp: Date.now()
      });
    }
  }

  startAutonomousTrading(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[Trading] Autonomous trading started");

    this.analysisInterval = setInterval(async () => {
      this.refreshMarketData();
      this.updatePositions();

      if (this.config.autoTrade) {
        for (const [symbol] of Array.from(this.marketData.entries())) {
          const signal = await this.generateSignal(symbol);
          if (signal && signal.confidence >= 75) {
            const quantity = this.calculateOptimalQuantity(signal);
            if (quantity > 0) {
              await this.executeTrade(signal, quantity);
            }
          }
        }
      }
    }, this.config.refreshInterval);
  }

  stopAutonomousTrading(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    console.log("[Trading] Autonomous trading stopped");
  }

  private calculateOptimalQuantity(signal: TradeSignal): number {
    const riskAmount = this.portfolio.availableBalance * (this.config.riskParams.riskPerTrade / 100);
    const stopDistance = Math.abs(signal.entryPrice - signal.stopLoss);
    const quantity = riskAmount / stopDistance;
    const maxQuantity = this.config.riskParams.maxPositionSize / signal.entryPrice;
    return Math.min(quantity, maxQuantity);
  }

  getMarketData(): MarketData[] {
    return Array.from(this.marketData.values());
  }

  getSignals(): TradeSignal[] {
    return this.signals.slice(-50);
  }

  getTrades(): Trade[] {
    return this.trades;
  }

  getPortfolio(): Portfolio {
    return this.portfolio;
  }

  getConfig(): TradingConfig {
    return this.config;
  }

  updateConfig(updates: Partial<TradingConfig>): TradingConfig {
    this.config = { ...this.config, ...updates };
    return this.config;
  }

  getStatus(): {
    isRunning: boolean;
    autoTrade: boolean;
    marketsMonitored: number;
    openPositions: number;
    totalBalance: number;
    unrealizedPnl: number;
  } {
    return {
      isRunning: this.isRunning,
      autoTrade: this.config.autoTrade,
      marketsMonitored: this.marketData.size,
      openPositions: this.portfolio.positions.length,
      totalBalance: this.portfolio.totalBalance,
      unrealizedPnl: this.portfolio.unrealizedPnl
    };
  }
}

export const tradingEngine = new CYRUSAutonomousTradingEngine();
