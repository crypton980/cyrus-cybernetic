import { useState, useEffect } from "react";
import { useTrading } from "../hooks/useTrading";
import { CyrusAssistant } from "../components/CyrusAssistant";
import {
  TrendingUp,
  Globe,
  BarChart3,
  BookOpen,
  Brain,
  Play,
  Square,
  Target,
  DollarSign,
  Zap,
  Clock,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  X,
  Link,
  Link2Off,
} from "lucide-react";

type TabType = "ai-engine" | "world-events" | "predictions" | "strategies" | "markets" | "portfolio";
type AIStatus = "STANDBY" | "ACTIVE" | "ANALYZING" | "EXECUTING";

export function TradingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("ai-engine");
  const [aiStatus, setAiStatus] = useState<AIStatus>("STANDBY");
  const [worldEvents, setWorldEvents] = useState(0);
  const [predictions, setPredictions] = useState(0);
  const [strategies, setStrategies] = useState(0);
  const [decisions, setDecisions] = useState(0);

  const {
    status,
    account,
    positions,
    orders,
    isLoading,
    alpacaConnected,
    alpacaEnvironment,
    placeOrder,
    cancelOrder,
    closePosition,
    startAutonomous,
    stopAutonomous,
    executeDecision,
    refreshAll,
  } = useTrading();

  const isAIRunning = status?.isRunning || false;

  const [orderForm, setOrderForm] = useState({
    symbol: "AAPL",
    qty: 1,
    side: "buy" as "buy" | "sell",
    type: "market" as "market" | "limit" | "stop",
    limitPrice: "",
  });

  useEffect(() => {
    if (status?.isRunning) {
      setAiStatus("ACTIVE");
    } else {
      setAiStatus("STANDBY");
    }
  }, [status?.isRunning]);

  const handleStartAI = () => {
    setAiStatus("ANALYZING");
    startAutonomous.mutate(undefined, {
      onSuccess: (data) => {
        setAiStatus("ACTIVE");
        setWorldEvents(3);
        setPredictions(2);
        setStrategies(1);
      },
      onError: () => {
        setAiStatus("STANDBY");
      }
    });
  };

  const handleStopAI = () => {
    stopAutonomous.mutate(undefined, {
      onSuccess: () => {
        setAiStatus("STANDBY");
      }
    });
  };

  const handlePlaceOrder = () => {
    placeOrder.mutate({
      symbol: orderForm.symbol,
      qty: orderForm.qty,
      side: orderForm.side,
      type: orderForm.type,
      limitPrice: orderForm.limitPrice ? parseFloat(orderForm.limitPrice) : undefined,
    });
  };

  const tabs = [
    { id: "ai-engine", label: "AI Engine", icon: Brain },
    { id: "world-events", label: "World Events", icon: Globe },
    { id: "predictions", label: "Predictions", icon: BarChart3 },
    { id: "strategies", label: "Strategies", icon: BookOpen },
    { id: "markets", label: "Markets", icon: TrendingUp },
    { id: "portfolio", label: "Portfolio", icon: DollarSign },
  ];

  const getStatusColor = (status: AIStatus) => {
    switch (status) {
      case "ACTIVE": return "text-green-400";
      case "ANALYZING": return "text-yellow-400 animate-pulse";
      case "EXECUTING": return "text-blue-400 animate-pulse";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <header className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-3">
            <a href="/" className="p-2 hover:bg-gray-800 rounded-lg transition-colors mt-1">
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </a>
            <div>
              <h1 className="text-xl font-bold">
                <span className="text-cyan-400">CYRUS</span>{" "}
                <span className="text-green-400">Autonomous</span>
                <br />
                <span className="text-green-400">Trading</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400">AI-Powered Market Analysis & Execution</p>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                  alpacaConnected 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                }`}>
                  {alpacaConnected ? <Link className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                  {alpacaConnected ? `Alpaca ${alpacaEnvironment}` : 'Simulation Mode'}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={isAIRunning ? handleStopAI : handleStartAI}
            disabled={startAutonomous.isPending || stopAutonomous.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 ${
              isAIRunning
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {startAutonomous.isPending || stopAutonomous.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : isAIRunning ? (
              <>
                <Square className="w-4 h-4" />
                Stop AI
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Autonomous AI
              </>
            )}
          </button>
        </header>

        {/* Status Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* AI Status Card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-gray-500" />
              <span className="text-xs text-gray-400">AI Status</span>
            </div>
            <p className={`text-lg font-bold ${getStatusColor(aiStatus)}`}>
              {aiStatus}
            </p>
          </div>

          {/* World Events Card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-cyan-500" />
              <span className="text-xs text-gray-400">World Events</span>
            </div>
            <p className="text-lg font-bold text-cyan-400">{worldEvents}</p>
          </div>

          {/* Predictions Card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-400">Predictions</span>
            </div>
            <p className="text-lg font-bold text-purple-400">{predictions}</p>
          </div>

          {/* Strategies Card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-400">Strategies</span>
            </div>
            <p className="text-lg font-bold text-yellow-400">{strategies}</p>
          </div>
        </div>

        {/* Decisions Card - Full Width */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-400">Decisions</span>
          </div>
          <p className="text-lg font-bold text-blue-400">{decisions}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto gap-1 mb-4 pb-2 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-gray-800 text-white border border-gray-700"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "ai-engine" && (
            <>
              {/* Recent AI Decisions */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold">Recent AI Decisions</h3>
                </div>
                {decisions === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No autonomous decisions yet. Start the AI to begin trading.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-green-400">BUY AAPL</p>
                      <p className="text-xs text-gray-400">Based on momentum analysis</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Latest Market Events */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold">Latest Market Events</h3>
                </div>
                {worldEvents === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No world events detected. AI is monitoring global markets.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-sm font-medium">Fed Interest Rate Decision</p>
                      <p className="text-xs text-gray-400">High impact - USD pairs affected</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-sm font-medium">Tech Earnings Season</p>
                      <p className="text-xs text-gray-400">Major tech companies reporting</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "world-events" && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-5 h-5 text-cyan-400" />
                <h3 className="font-semibold">World Events & Market Impact Analysis</h3>
              </div>
              <p className="text-gray-500 text-sm">
                Real-time monitoring of global events affecting financial markets.
              </p>
            </div>
          )}

          {activeTab === "predictions" && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <BarChart3 className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm text-center">
                  No predictions yet. Start the AI engine to generate forecasts.
                </p>
              </div>
            </div>
          )}

          {activeTab === "strategies" && (
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col items-center justify-center py-8">
                <BookOpen className="w-12 h-12 text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm text-center">
                  No active strategies. AI will generate strategies based on market conditions.
                </p>
              </div>
            </div>
          )}

          {activeTab === "markets" && (
            <>
              {/* Forex Markets */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold">Forex Markets</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">EUR/USD</p>
                    <p className="text-green-400 text-sm">1.0842</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">GBP/USD</p>
                    <p className="text-red-400 text-sm">1.2651</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">USD/JPY</p>
                    <p className="text-green-400 text-sm">149.32</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">USD/CHF</p>
                    <p className="text-gray-400 text-sm">0.8892</p>
                  </div>
                </div>
              </div>

              {/* Crypto Markets */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <h3 className="font-semibold">Crypto Markets</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">BTC/USD</p>
                    <p className="text-green-400 text-sm">$67,450</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">ETH/USD</p>
                    <p className="text-green-400 text-sm">$3,245</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">SOL/USD</p>
                    <p className="text-red-400 text-sm">$142.80</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-sm font-mono">XRP/USD</p>
                    <p className="text-green-400 text-sm">$0.6234</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "portfolio" && (
            <>
              {/* Account Info */}
              {account && (
                <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Account Overview</h3>
                    <button
                      onClick={refreshAll}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Balance</p>
                      <p className="text-lg font-bold">${account.balance.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Buying Power</p>
                      <p className="text-lg font-bold text-green-400">${account.buyingPower.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Equity</p>
                      <p className="text-lg font-bold">${account.equity.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Status</p>
                      <p className="text-lg font-bold text-blue-400">{account.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Positions */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Open Positions</h3>
                {positions.length === 0 ? (
                  <p className="text-gray-500 text-sm">No open positions</p>
                ) : (
                  <div className="space-y-2">
                    {positions.map((pos) => (
                      <div key={pos.symbol} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="font-bold">{pos.symbol}</p>
                          <p className="text-xs text-gray-400">{pos.qty} shares @ ${pos.avgEntryPrice.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className={pos.unrealizedPl >= 0 ? "text-green-400" : "text-red-400"}>
                            {pos.unrealizedPl >= 0 ? "+" : ""}${pos.unrealizedPl.toFixed(2)}
                          </p>
                          <button
                            onClick={() => closePosition.mutate(pos.symbol)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Trade */}
              <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold mb-3">Quick Trade</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={orderForm.symbol}
                    onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                    placeholder="Symbol (e.g., AAPL)"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={orderForm.qty}
                      onChange={(e) => setOrderForm({ ...orderForm, qty: parseInt(e.target.value) || 1 })}
                      placeholder="Quantity"
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      value={orderForm.type}
                      onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value as any })}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="market">Market</option>
                      <option value="limit">Limit</option>
                      <option value="stop">Stop</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setOrderForm({ ...orderForm, side: "buy" });
                        handlePlaceOrder();
                      }}
                      className="py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-sm transition-colors"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => {
                        setOrderForm({ ...orderForm, side: "sell" });
                        handlePlaceOrder();
                      }}
                      className="py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium text-sm transition-colors"
                    >
                      Sell
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CYRUS Assistant */}
      <CyrusAssistant
        module="trading"
        context={`User is in Autonomous Trading module. AI Status: ${aiStatus}. Tab: ${activeTab}. Events: ${worldEvents}, Predictions: ${predictions}, Strategies: ${strategies}, Decisions: ${decisions}`}
        compact={true}
      />
    </div>
  );
}
