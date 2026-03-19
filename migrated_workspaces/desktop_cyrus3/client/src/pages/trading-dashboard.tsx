import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Play, 
  Square, 
  RefreshCw,
  BarChart3,
  Wallet,
  Target,
  Shield,
  Zap,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Globe,
  Lightbulb,
  Cpu,
  ArrowLeft,
  Newspaper,
  LineChart,
  BookOpen,
  Bot,
  CheckCircle,
  XCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TradingIntelligencePanel } from "@/components/trading-intelligence-panel";

interface MarketData {
  symbol: string;
  type: "forex" | "crypto";
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

interface Trade {
  id: string;
  symbol: string;
  type: string;
  side: "buy" | "sell";
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  status: string;
  openedAt: number;
}

interface Portfolio {
  totalBalance: number;
  availableBalance: number;
  marginUsed: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  positions: Trade[];
}

interface TradingStatus {
  isRunning: boolean;
  autoTrade: boolean;
  marketsMonitored: number;
  openPositions: number;
  totalBalance: number;
  unrealizedPnl: number;
}

interface WorldEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  impactLevel: string;
  affectedAssets: string[];
  sentiment: string;
  timestamp: string;
  source: string;
  marketImpactScore: number;
}

interface PricePrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice1h: number;
  predictedPrice4h: number;
  predictedPrice24h: number;
  confidence: number;
  direction: string;
  volatilityForecast: string;
  riskScore: number;
  reasoning: string;
}

interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type: string;
  rules: Array<{ condition: string; action: string; weight: number; successRate: number }>;
  performance: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    expectancy: number;
  };
  adaptiveParameters: Record<string, number>;
  lastRefined: string;
  refinementCount: number;
  isActive: boolean;
}

interface TradeDecision {
  id: string;
  symbol: string;
  action: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  reasoning: string;
  strategyUsed: string;
  worldEventsConsidered: string[];
  timestamp: string;
  executed: boolean;
  outcome?: string;
}

interface AutonomousStatus {
  isAutonomous: boolean;
  worldEventsCount: number;
  strategiesCount: number;
  decisionsCount: number;
  predictionsCount: number;
}

export default function TradingDashboard() {
  const { toast } = useToast();
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [tradeQuantity, setTradeQuantity] = useState<string>("1000");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");

  const { data: status } = useQuery<TradingStatus>({
    queryKey: ["/api/trading/status"],
    refetchInterval: 2000
  });

  const { data: markets = [] } = useQuery<MarketData[]>({
    queryKey: ["/api/trading/markets"],
    refetchInterval: 3000
  });

  const { data: portfolio } = useQuery<Portfolio>({
    queryKey: ["/api/trading/portfolio"],
    refetchInterval: 2000
  });

  const { data: trades = [] } = useQuery<Trade[]>({
    queryKey: ["/api/trading/trades"],
    refetchInterval: 2000
  });

  const { data: autonomousStatus } = useQuery<AutonomousStatus>({
    queryKey: ["/api/trading/autonomous/status"],
    refetchInterval: 3000
  });

  const { data: worldEvents = [] } = useQuery<WorldEvent[]>({
    queryKey: ["/api/trading/autonomous/events"],
    refetchInterval: 10000
  });

  const { data: predictions = [] } = useQuery<PricePrediction[]>({
    queryKey: ["/api/trading/autonomous/predictions"],
    refetchInterval: 5000
  });

  const { data: strategies = [] } = useQuery<TradingStrategy[]>({
    queryKey: ["/api/trading/autonomous/strategies"],
    refetchInterval: 10000
  });

  const { data: decisions = [] } = useQuery<TradeDecision[]>({
    queryKey: ["/api/trading/autonomous/decisions"],
    refetchInterval: 3000
  });

  const startAutonomousMutation = useMutation({
    mutationFn: () => apiRequest("/api/trading/autonomous/start", "POST"),
    onSuccess: () => {
      toast({ title: "Autonomous Trading AI Started", description: "CYRUS is now analyzing markets and executing trades" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/autonomous/status"] });
    }
  });

  const stopAutonomousMutation = useMutation({
    mutationFn: () => apiRequest("/api/trading/autonomous/stop", "POST"),
    onSuccess: () => {
      toast({ title: "Autonomous Trading AI Stopped" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/autonomous/status"] });
    }
  });

  const refineStrategyMutation = useMutation({
    mutationFn: (strategyId: string) => apiRequest("/api/trading/autonomous/refine", "POST", { strategyId }),
    onSuccess: (data: any) => {
      toast({ title: "Strategy Refined", description: `${data.name} has been optimized` });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/autonomous/strategies"] });
    }
  });

  const generatePredictionMutation = useMutation({
    mutationFn: (params: { symbol: string; currentPrice: number }) => 
      apiRequest("/api/trading/autonomous/predict", "POST", params),
    onSuccess: () => {
      toast({ title: "Prediction Generated" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/autonomous/predictions"] });
    }
  });

  const executeTradeMutation = useMutation({
    mutationFn: (params: { symbol: string; side: string; quantity: number }) => 
      apiRequest("/api/trading/execute", "POST", params),
    onSuccess: (data: any) => {
      if (data.error) {
        toast({ title: "Trade Rejected", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Trade Executed", description: `${data.side?.toUpperCase()} ${data.symbol}` });
        queryClient.invalidateQueries({ queryKey: ["/api/trading/portfolio"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trading/trades"] });
      }
    }
  });

  const closeTradeMutation = useMutation({
    mutationFn: (tradeId: string) => apiRequest("/api/trading/close", "POST", { tradeId }),
    onSuccess: () => {
      toast({ title: "Trade Closed" });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/trades"] });
    }
  });

  const forexMarkets = markets.filter(m => m.type === "forex");
  const cryptoMarkets = markets.filter(m => m.type === "crypto");

  const handleTrade = () => {
    if (!selectedSymbol) {
      toast({ title: "Select a market first", variant: "destructive" });
      return;
    }
    executeTradeMutation.mutate({
      symbol: selectedSymbol,
      side: tradeSide,
      quantity: parseFloat(tradeQuantity)
    });
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/50";
      case "high": return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
      default: return "bg-slate-500/20 text-muted-foreground border-slate-500/50";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish": return "text-green-400";
      case "bearish": return "text-red-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background tactical-grid text-foreground p-4 relative">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/3 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between glass rounded-lg p-4 border border-cyan-500/20">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="h-8 w-px bg-cyan-500/30" />
            <div>
              <h1 className="text-xl font-bold text-emerald-400 font-mono tracking-wider text-glow-subtle">
                AUTONOMOUS TRADING
              </h1>
              <p className="text-xs text-muted-foreground font-mono">AI-POWERED MARKET ANALYSIS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {autonomousStatus?.isAutonomous ? (
              <Button
                onClick={() => stopAutonomousMutation.mutate()}
                variant="outline"
                className="border-red-500/40 text-red-400 gap-2 font-mono text-xs glow-red"
                data-testid="button-stop-autonomous"
              >
                <Square className="w-4 h-4" />
                STOP AI
              </Button>
            ) : (
              <Button
                onClick={() => startAutonomousMutation.mutate()}
                className="bg-emerald-600 hover:bg-emerald-500 gap-2 font-mono text-xs glow-green"
                data-testid="button-start-autonomous"
              >
                <Brain className="w-4 h-4" />
                START AI
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="glass border-cyan-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Brain className={`w-5 h-5 ${autonomousStatus?.isAutonomous ? "text-emerald-400 animate-pulse" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-xs text-muted-foreground font-mono">AI STATUS</p>
                  <p className={`font-bold font-mono ${autonomousStatus?.isAutonomous ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {autonomousStatus?.isAutonomous ? "ACTIVE" : "STANDBY"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass border-cyan-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-muted-foreground font-mono">WORLD EVENTS</p>
                  <p className="font-bold text-cyan-400 font-mono">{worldEvents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass border-cyan-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <LineChart className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-xs text-muted-foreground font-mono">PREDICTIONS</p>
                  <p className="font-bold text-purple-400 font-mono">{predictions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass border-cyan-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <p className="text-xs text-muted-foreground font-mono">STRATEGIES</p>
                  <p className="font-bold text-amber-400 font-mono">{strategies.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass border-cyan-500/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-xs text-muted-foreground">Decisions</p>
                  <p className="font-bold text-cyan-400">{decisions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="intelligence" className="w-full">
          <TabsList className="glass border-cyan-500/20">
            <TabsTrigger value="intelligence" data-testid="tab-intelligence" className="font-mono text-xs">
              <Shield className="w-4 h-4 mr-1" />
              INTELLIGENCE
            </TabsTrigger>
            <TabsTrigger value="autonomous" data-testid="tab-autonomous" className="font-mono text-xs">
              <Brain className="w-4 h-4 mr-1" />
              AI ENGINE
            </TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events" className="font-mono text-xs">
              <Globe className="w-4 h-4 mr-1" />
              EVENTS
            </TabsTrigger>
            <TabsTrigger value="predictions" data-testid="tab-predictions" className="font-mono text-xs">
              <LineChart className="w-4 h-4 mr-1" />
              PREDICTIONS
            </TabsTrigger>
            <TabsTrigger value="strategies" data-testid="tab-strategies" className="font-mono text-xs">
              <BookOpen className="w-4 h-4 mr-1" />
              STRATEGIES
            </TabsTrigger>
            <TabsTrigger value="markets" data-testid="tab-markets">
              <BarChart3 className="w-4 h-4 mr-1" />
              Markets
            </TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">
              <Wallet className="w-4 h-4 mr-1" />
              Portfolio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intelligence" className="space-y-4">
            <TradingIntelligencePanel />
          </TabsContent>

          <TabsContent value="autonomous" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="glass border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    Recent AI Decisions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {decisions.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No autonomous decisions yet. Start the AI to begin trading.
                    </p>
                  ) : (
                    decisions.slice(0, 10).map((decision) => (
                      <div key={decision.id} className="p-3 bg-card/50 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={decision.action === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                              {decision.action.toUpperCase()}
                            </Badge>
                            <span className="font-mono font-bold">{decision.symbol}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={decision.confidence * 100} className="w-16 h-2" />
                            <span className="text-xs text-muted-foreground">{(decision.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{decision.reasoning}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                          <span>Strategy: {decision.strategyUsed}</span>
                          {decision.executed ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-400" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="glass border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Newspaper className="w-5 h-5 text-blue-400" />
                    Latest Market Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {worldEvents.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      No world events detected. AI is monitoring global markets.
                    </p>
                  ) : (
                    worldEvents.slice(0, 8).map((event) => (
                      <div key={event.id} className="p-3 bg-card/50 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-1">
                          <Badge className={getImpactColor(event.impactLevel)}>
                            {event.impactLevel.toUpperCase()}
                          </Badge>
                          <span className={`text-sm font-semibold ${getSentimentColor(event.sentiment)}`}>
                            {event.sentiment === "bullish" ? <TrendingUp className="w-4 h-4 inline" /> : 
                             event.sentiment === "bearish" ? <TrendingDown className="w-4 h-4 inline" /> : null}
                            {" "}{event.sentiment}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {event.affectedAssets?.slice(0, 4).map((asset) => (
                            <Badge key={asset} variant="outline" className="text-xs border-cyan-500/30">
                              {asset}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card className="glass border-cyan-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  World Events & Market Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {worldEvents.map((event) => (
                  <div key={event.id} className="p-4 bg-card/50 rounded-lg border border-slate-700">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getImpactColor(event.impactLevel)}>
                            {event.impactLevel.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="border-cyan-500/30">
                            {event.category}
                          </Badge>
                          <span className={`font-semibold ${getSentimentColor(event.sentiment)}`}>
                            {event.sentiment}
                          </span>
                        </div>
                        <h4 className="font-bold">{event.title}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-cyan-400">
                          {event.marketImpactScore}
                        </div>
                        <div className="text-xs text-slate-500">Impact Score</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">{event.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {event.affectedAssets?.map((asset) => (
                        <Badge key={asset} className="bg-slate-700/50 text-slate-300">
                          {asset}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Source: {event.source} | {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((pred) => (
                <Card key={pred.symbol} className="glass border-cyan-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="font-mono">{pred.symbol}</span>
                      <Badge className={
                        pred.direction === "up" ? "bg-green-500/20 text-green-400" :
                        pred.direction === "down" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-500/20 text-muted-foreground"
                      }>
                        {pred.direction === "up" ? <TrendingUp className="w-3 h-3 mr-1" /> :
                         pred.direction === "down" ? <TrendingDown className="w-3 h-3 mr-1" /> : null}
                        {pred.direction.toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-slate-500">Current</p>
                        <p className="font-mono font-bold">${pred.currentPrice?.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">1h Pred</p>
                        <p className={`font-mono font-bold ${pred.predictedPrice1h > pred.currentPrice ? "text-green-400" : "text-red-400"}`}>
                          ${pred.predictedPrice1h?.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">4h Pred</p>
                        <p className={`font-mono font-bold ${pred.predictedPrice4h > pred.currentPrice ? "text-green-400" : "text-red-400"}`}>
                          ${pred.predictedPrice4h?.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">24h Pred</p>
                        <p className={`font-mono font-bold ${pred.predictedPrice24h > pred.currentPrice ? "text-green-400" : "text-red-400"}`}>
                          ${pred.predictedPrice24h?.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Confidence</span>
                        <span className="text-cyan-400">{(pred.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={pred.confidence * 100} className="h-1.5" />
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className="border-cyan-500/30">
                        Volatility: {pred.volatilityForecast}
                      </Badge>
                      <span className={`${pred.riskScore > 70 ? "text-red-400" : pred.riskScore > 40 ? "text-yellow-400" : "text-green-400"}`}>
                        Risk: {pred.riskScore}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2">{pred.reasoning}</p>
                  </CardContent>
                </Card>
              ))}
              
              {predictions.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <LineChart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500">No predictions yet. Start the AI engine to generate forecasts.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {strategies.map((strategy) => (
                <Card key={strategy.id} className="glass border-cyan-500/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <Badge className={strategy.isActive ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-muted-foreground"}>
                        {strategy.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{strategy.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="p-2 bg-card/50 rounded">
                        <p className="text-slate-500">Win Rate</p>
                        <p className={`font-bold ${strategy.performance.winRate > 0.6 ? "text-green-400" : strategy.performance.winRate > 0.5 ? "text-yellow-400" : "text-red-400"}`}>
                          {(strategy.performance.winRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-2 bg-card/50 rounded">
                        <p className="text-slate-500">Profit Factor</p>
                        <p className={`font-bold ${strategy.performance.profitFactor > 1.5 ? "text-green-400" : "text-yellow-400"}`}>
                          {strategy.performance.profitFactor?.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-2 bg-card/50 rounded">
                        <p className="text-slate-500">Sharpe</p>
                        <p className="font-bold text-cyan-400">{strategy.performance.sharpeRatio?.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Strategy Rules:</p>
                      {strategy.rules.slice(0, 3).map((rule, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 bg-card/30 rounded">
                          <span className="text-slate-300 truncate flex-1">{rule.condition}</span>
                          <Badge variant="outline" className="ml-2">
                            {(rule.successRate * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Refined {strategy.refinementCount}x</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refineStrategyMutation.mutate(strategy.id)}
                        disabled={refineStrategyMutation.isPending}
                        data-testid={`button-refine-${strategy.id}`}
                      >
                        <Lightbulb className="w-3 h-3 mr-1" />
                        Refine Strategy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="markets" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="glass border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    Forex Markets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {forexMarkets.map((market) => (
                    <div
                      key={market.symbol}
                      onClick={() => setSelectedSymbol(market.symbol)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSymbol === market.symbol 
                          ? "bg-green-500/20 border border-green-500/50" 
                          : "bg-card/50 border border-slate-700 hover:border-cyan-500/30"
                      }`}
                      data-testid={`market-${market.symbol}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold">{market.symbol}</span>
                        <span className="font-mono text-lg">{market.price?.toFixed(5)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                        <span>Spread: {market.spread?.toFixed(1)}</span>
                        <span className={market.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                          {market.change24h >= 0 ? "+" : ""}{market.change24h?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass border-cyan-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    Crypto Markets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cryptoMarkets.map((market) => (
                    <div
                      key={market.symbol}
                      onClick={() => setSelectedSymbol(market.symbol)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedSymbol === market.symbol 
                          ? "bg-amber-500/20 border border-amber-500/50" 
                          : "bg-card/50 border border-slate-700 hover:border-cyan-500/30"
                      }`}
                      data-testid={`market-${market.symbol}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold">{market.symbol}</span>
                        <span className="font-mono text-lg">${market.price?.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                        <span>Vol: ${(market.volume24h / 1e9)?.toFixed(2)}B</span>
                        <span className={market.change24h >= 0 ? "text-green-400" : "text-red-400"}>
                          {market.change24h >= 0 ? "+" : ""}{market.change24h?.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {selectedSymbol && (
              <Card className="glass border-cyan-500/20">
                <CardHeader>
                  <CardTitle>Trade {selectedSymbol}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                  <div className="space-y-2 flex-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(e.target.value)}
                      className="bg-card/50 border-slate-700"
                      data-testid="input-trade-quantity"
                    />
                  </div>
                  <Button
                    onClick={() => { setTradeSide("buy"); handleTrade(); }}
                    className="bg-green-500 hover:bg-green-600"
                    disabled={executeTradeMutation.isPending}
                    data-testid="button-buy"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    BUY
                  </Button>
                  <Button
                    onClick={() => { setTradeSide("sell"); handleTrade(); }}
                    className="bg-red-500 hover:bg-red-600"
                    disabled={executeTradeMutation.isPending}
                    data-testid="button-sell"
                  >
                    <ArrowDownRight className="w-4 h-4 mr-1" />
                    SELL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const market = markets.find(m => m.symbol === selectedSymbol);
                      if (market) {
                        generatePredictionMutation.mutate({ symbol: selectedSymbol, currentPrice: market.price });
                      }
                    }}
                    disabled={generatePredictionMutation.isPending}
                    data-testid="button-predict"
                  >
                    <LineChart className="w-4 h-4 mr-1" />
                    Predict
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="glass border-cyan-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Balance</p>
                      <p className="text-2xl font-bold">${portfolio?.totalBalance?.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass border-cyan-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-8 h-8 ${(portfolio?.unrealizedPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`} />
                    <div>
                      <p className="text-sm text-muted-foreground">Unrealized P&L</p>
                      <p className={`text-2xl font-bold ${(portfolio?.unrealizedPnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ${portfolio?.unrealizedPnl?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass border-cyan-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-8 h-8 text-cyan-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold text-cyan-400">
                        {((portfolio?.winRate || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass border-cyan-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Trades</p>
                      <p className="text-2xl font-bold text-purple-400">{portfolio?.totalTrades}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass border-cyan-500/20">
              <CardHeader>
                <CardTitle>Open Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {trades.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No open positions</p>
                ) : (
                  <div className="space-y-2">
                    {trades.map((trade) => (
                      <div
                        key={trade.id}
                        className="p-3 bg-card/50 rounded-lg border border-slate-700 flex items-center justify-between"
                        data-testid={`trade-${trade.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge className={trade.side === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                            {trade.side.toUpperCase()}
                          </Badge>
                          <span className="font-mono font-bold">{trade.symbol}</span>
                          <span className="text-sm text-muted-foreground">Qty: {trade.quantity}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Entry: ${trade.entryPrice?.toFixed(4)}</p>
                            <p className={`font-bold ${trade.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {trade.pnl >= 0 ? "+" : ""}${trade.pnl?.toFixed(2)} ({trade.pnlPercent?.toFixed(2)}%)
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => closeTradeMutation.mutate(trade.id)}
                            disabled={closeTradeMutation.isPending}
                            data-testid={`button-close-${trade.id}`}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
