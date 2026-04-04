import type { Express } from "express";
import { createAlpacaClient } from "./alpaca-client";

// In-memory simulation state (used when Alpaca credentials are not configured)
interface SimOrder {
  id: string;
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  status: string;
  filledQty: number;
  limitPrice?: number;
  createdAt: string;
}

interface SimPosition {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPl: number;
  side: "long" | "short";
}

interface SimState {
  isRunning: boolean;
  balance: number;
  equity: number;
  buyingPower: number;
  orders: SimOrder[];
  positions: SimPosition[];
  decisions: Array<{ id: string; symbol: string; action: string; confidence: number; reason: string; ts: number }>;
}

const sim: SimState = {
  isRunning: false,
  balance: 100_000,
  equity: 100_000,
  buyingPower: 100_000,
  orders: [],
  positions: [],
  decisions: [],
};

// Simulated price feed
const prices: Record<string, number> = {
  AAPL: 182.5, TSLA: 243.0, MSFT: 415.0, AMZN: 186.0, GOOGL: 174.5,
  NVDA: 875.0, META: 507.0, SPY: 525.0, QQQ: 451.0, BTC: 67000, ETH: 3400,
};
function getPrice(symbol: string): number {
  if (!prices[symbol]) prices[symbol] = 100 + Math.random() * 400;
  prices[symbol] *= 1 + (Math.random() - 0.5) * 0.002; // ±0.1% drift per call
  return parseFloat(prices[symbol].toFixed(2));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatStatus(sim: SimState) {
  return {
    isRunning: sim.isRunning,
    autoTrade: sim.isRunning,
    marketsMonitored: Object.keys(prices).length,
    openPositions: sim.positions.length,
    totalBalance: sim.balance,
    unrealizedPnl: sim.positions.reduce((s, p) => s + p.unrealizedPl, 0),
    alpacaConnected: false,
    alpacaEnvironment: "paper",
  };
}

export function registerTradingRoutes(app: Express): void {
  console.log("[Trading] Registering trading API routes");

  const getClient = () => createAlpacaClient();

  // GET /api/trading/status
  app.get("/api/trading/status", async (_req, res) => {
    const client = getClient();
    if (!client) {
      return res.json(formatStatus(sim));
    }
    try {
      const account = await client.getAccount();
      const positions = await client.getPositions();
      res.json({
        isRunning: sim.isRunning,
        autoTrade: sim.isRunning,
        marketsMonitored: Object.keys(prices).length,
        openPositions: positions.length,
        totalBalance: parseFloat(account.equity),
        unrealizedPnl: positions.reduce((s, p) => s + parseFloat(p.unrealized_pl), 0),
        alpacaConnected: true,
        alpacaEnvironment: process.env.ALPACA_ENVIRONMENT || "paper",
      });
    } catch (e: any) {
      res.json({ ...formatStatus(sim), alpacaError: e.message });
    }
  });

  // GET /api/trading/account
  app.get("/api/trading/account", async (_req, res) => {
    const client = getClient();
    if (!client) {
      return res.json({
        id: "sim-account",
        currency: "USD",
        balance: sim.balance,
        buyingPower: sim.buyingPower,
        equity: sim.equity,
        status: "ACTIVE",
      });
    }
    try {
      const account = await client.getAccount();
      res.json({
        id: account.id,
        currency: account.currency,
        balance: parseFloat(account.cash),
        buyingPower: parseFloat(account.buying_power),
        equity: parseFloat(account.equity),
        status: account.status,
      });
    } catch (e: any) {
      res.json({ id: "sim-account", currency: "USD", balance: sim.balance, buyingPower: sim.buyingPower, equity: sim.equity, status: "ACTIVE", alpacaError: e.message });
    }
  });

  // GET /api/trading/positions
  app.get("/api/trading/positions", async (_req, res) => {
    const client = getClient();
    if (!client) {
      // Refresh simulated unrealized PL
      for (const p of sim.positions) {
        p.currentPrice = getPrice(p.symbol);
        p.unrealizedPl = (p.currentPrice - p.avgEntryPrice) * p.qty * (p.side === "long" ? 1 : -1);
      }
      return res.json(sim.positions);
    }
    try {
      const positions = await client.getPositions();
      res.json(positions.map(p => ({
        symbol: p.symbol,
        qty: parseFloat(p.qty),
        avgEntryPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        unrealizedPl: parseFloat(p.unrealized_pl),
        side: p.side as "long" | "short",
      })));
    } catch (e: any) {
      res.json(sim.positions);
    }
  });

  // GET /api/trading/orders
  app.get("/api/trading/orders", async (_req, res) => {
    const client = getClient();
    if (!client) return res.json(sim.orders.slice(0, 50));
    try {
      const orders = await client.getOrders({ status: "all", limit: 50 });
      res.json(orders.map(o => ({
        id: o.id,
        symbol: o.symbol,
        qty: parseFloat(o.qty),
        side: o.side,
        type: o.type,
        status: o.status,
        filledQty: parseFloat(o.filled_qty),
        limitPrice: o.limit_price ? parseFloat(o.limit_price) : undefined,
        createdAt: o.created_at,
      })));
    } catch (e: any) {
      res.json(sim.orders.slice(0, 50));
    }
  });

  // POST /api/trading/orders — place order
  app.post("/api/trading/orders", async (req, res) => {
    const { symbol, qty, side, type, limitPrice } = req.body;
    if (!symbol || !qty || !side || !type) {
      return res.status(400).json({ error: "symbol, qty, side and type required" });
    }

    const client = getClient();
    if (!client) {
      // Simulate order fill
      const price = getPrice(symbol);
      const order: SimOrder = {
        id: generateId(),
        symbol: symbol.toUpperCase(),
        qty: Number(qty),
        side,
        type,
        status: "filled",
        filledQty: Number(qty),
        limitPrice,
        createdAt: new Date().toISOString(),
      };
      sim.orders.unshift(order);

      // Update simulated position
      const cost = price * Number(qty);
      if (side === "buy") {
        sim.balance -= cost;
        sim.buyingPower -= cost;
        const existing = sim.positions.find(p => p.symbol === order.symbol && p.side === "long");
        if (existing) {
          const totalQty = existing.qty + Number(qty);
          existing.avgEntryPrice = (existing.avgEntryPrice * existing.qty + cost) / totalQty;
          existing.qty = totalQty;
        } else {
          sim.positions.push({ symbol: order.symbol, qty: Number(qty), avgEntryPrice: price, currentPrice: price, unrealizedPl: 0, side: "long" });
        }
      } else {
        const existing = sim.positions.find(p => p.symbol === order.symbol);
        if (existing) {
          const proceeds = price * Number(qty);
          sim.balance += proceeds;
          sim.buyingPower += proceeds;
          existing.qty -= Number(qty);
          if (existing.qty <= 0) sim.positions = sim.positions.filter(p => p !== existing);
        }
      }
      sim.equity = sim.balance + sim.positions.reduce((s, p) => s + p.currentPrice * p.qty, 0);
      return res.json({ success: true, order });
    }

    try {
      const order = await client.createOrder({
        symbol,
        qty: Number(qty),
        side,
        type,
        time_in_force: "gtc",
        limit_price: limitPrice,
      });
      res.json({ success: true, order });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/trading/orders/:id — cancel order
  app.delete("/api/trading/orders/:id", async (req, res) => {
    const client = getClient();
    if (!client) {
      const order = sim.orders.find(o => o.id === req.params.id);
      if (order) order.status = "canceled";
      return res.json({ success: true });
    }
    try {
      await client.cancelOrder(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // DELETE /api/trading/positions/:symbol — close position
  app.delete("/api/trading/positions/:symbol", async (req, res) => {
    const client = getClient();
    if (!client) {
      const sym = req.params.symbol.toUpperCase();
      sim.positions = sim.positions.filter(p => p.symbol !== sym);
      return res.json({ success: true });
    }
    try {
      await client.closePosition(req.params.symbol);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // GET /api/trading/quote/:symbol
  app.get("/api/trading/quote/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const client = getClient();
    if (!client) {
      const price = getPrice(symbol);
      return res.json({
        symbol,
        bid: parseFloat((price * 0.9995).toFixed(2)),
        ask: parseFloat((price * 1.0005).toFixed(2)),
        last: price,
        volume: Math.floor(Math.random() * 1_000_000),
        timestamp: new Date().toISOString(),
      });
    }
    try {
      const result = await client.getStockQuotes([symbol]);
      const q = result.quotes[symbol];
      if (!q) throw new Error("No quote data");
      const price = getPrice(symbol);
      res.json({
        symbol,
        bid: q.bp,
        ask: q.ap,
        last: price,
        volume: Math.floor(Math.random() * 1_000_000),
        timestamp: new Date().toISOString(),
      });
    } catch {
      const price = getPrice(symbol);
      res.json({ symbol, bid: price * 0.9995, ask: price * 1.0005, last: price, volume: 500000, timestamp: new Date().toISOString() });
    }
  });

  // GET /api/trading/decisions
  app.get("/api/trading/decisions", (_req, res) => {
    res.json(sim.decisions.slice(0, 20));
  });

  // POST /api/trading/autonomous/start
  app.post("/api/trading/autonomous/start", (_req, res) => {
    sim.isRunning = true;
    // Generate some demo AI decisions
    const symbols = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN"];
    const actions = ["buy", "hold", "sell"];
    sim.decisions = symbols.map((symbol, i) => ({
      id: generateId(),
      symbol,
      action: actions[i % 3],
      confidence: 0.6 + Math.random() * 0.35,
      reason: `AI pattern analysis: ${symbol} trend detected`,
      ts: Date.now() - i * 60000,
    }));
    res.json({ success: true, message: "Autonomous trading started", decisions: sim.decisions });
  });

  // POST /api/trading/autonomous/stop
  app.post("/api/trading/autonomous/stop", (_req, res) => {
    sim.isRunning = false;
    res.json({ success: true, message: "Autonomous trading stopped" });
  });

  // POST /api/trading/execute — execute AI decision
  app.post("/api/trading/execute", (req, res) => {
    const { decisionId } = req.body;
    const decision = sim.decisions.find(d => d.id === decisionId);
    if (!decision) {
      return res.status(404).json({ error: "Decision not found" });
    }
    const price = getPrice(decision.symbol);
    const order: SimOrder = {
      id: generateId(),
      symbol: decision.symbol,
      qty: 1,
      side: decision.action === "sell" ? "sell" : "buy",
      type: "market",
      status: "filled",
      filledQty: 1,
      createdAt: new Date().toISOString(),
    };
    sim.orders.unshift(order);
    res.json({ success: true, order, executedPrice: price });
  });

  console.log("[Trading] Routes registered: status, account, positions, orders, quote, decisions, autonomous");
}
