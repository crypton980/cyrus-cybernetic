import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  RefreshCw
} from "lucide-react";

interface CircuitBreaker {
  id: string;
  name: string;
  isTripped: boolean;
  currentValue: number;
  threshold: number;
  action: string;
}

interface ComplianceRule {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  violationCount: number;
}

interface LearningMetric {
  name: string;
  current: number;
  target: number;
  trend: string;
  improvementRate: number;
}

interface EnvironmentalState {
  marketVolatilityIndex: number;
  globalRiskSentiment: number;
  liquidityScore: number;
  marketRegime: string;
  tradingSessionActivity: string;
  majorEventsNearby: boolean;
  recommendedExposure: number;
}

interface IntelligenceStatus {
  circuitBreakers: CircuitBreaker[];
  complianceRules: ComplianceRule[];
  learningMetrics: LearningMetric[];
  environmentalState: EnvironmentalState;
  patternsDetected: number;
  decisionHistorySize: number;
  adaptationCycles: number;
  isLearningEnabled: boolean;
}

export function TradingIntelligencePanel() {
  const { data: status, isLoading, refetch } = useQuery<IntelligenceStatus>({
    queryKey: ["/api/trading/intelligence/status"],
    refetchInterval: 5000
  });

  if (isLoading || !status) {
    return (
      <Card className="glass border-cyan-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="font-mono text-sm">LOADING INTELLIGENCE...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trippedBreakers = status.circuitBreakers.filter(cb => cb.isTripped);
  const activeCompliance = status.complianceRules.filter(r => r.isActive);
  const improvingMetrics = status.learningMetrics.filter(m => m.trend === "improving");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-cyan-400 font-mono tracking-wider flex items-center gap-2">
          <Brain className="w-5 h-5" />
          ADVANCED INTELLIGENCE
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="font-mono text-xs"
          data-testid="button-refresh-intelligence"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          REFRESH
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="glass border-cyan-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${trippedBreakers.length === 0 ? "text-emerald-400" : "text-red-400"}`} />
              <div>
                <p className="text-xs text-muted-foreground font-mono">CIRCUIT BREAKERS</p>
                <p className={`font-bold font-mono ${trippedBreakers.length === 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {trippedBreakers.length === 0 ? "ALL CLEAR" : `${trippedBreakers.length} TRIPPED`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-cyan-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs text-muted-foreground font-mono">COMPLIANCE</p>
                <p className="font-bold text-emerald-400 font-mono">{activeCompliance.length} ACTIVE</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-cyan-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className={`w-5 h-5 ${improvingMetrics.length > 0 ? "text-emerald-400" : "text-amber-400"}`} />
              <div>
                <p className="text-xs text-muted-foreground font-mono">LEARNING</p>
                <p className={`font-bold font-mono ${improvingMetrics.length > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {improvingMetrics.length}/{status.learningMetrics.length} IMPROVING
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-cyan-500/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-xs text-muted-foreground font-mono">ADAPTATIONS</p>
                <p className="font-bold text-purple-400 font-mono">{status.adaptationCycles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="glass border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              ENVIRONMENTAL AWARENESS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">VOLATILITY INDEX</span>
                <span className={status.environmentalState.marketVolatilityIndex > 2 ? "text-red-400" : "text-emerald-400"}>
                  {status.environmentalState.marketVolatilityIndex.toFixed(2)}x
                </span>
              </div>
              <Progress 
                value={Math.min(100, status.environmentalState.marketVolatilityIndex * 25)} 
                className="h-1.5"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">LIQUIDITY SCORE</span>
                <span className={status.environmentalState.liquidityScore > 0.6 ? "text-emerald-400" : "text-amber-400"}>
                  {(status.environmentalState.liquidityScore * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={status.environmentalState.liquidityScore * 100} className="h-1.5" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">RECOMMENDED EXPOSURE</span>
                <span className={status.environmentalState.recommendedExposure > 0.7 ? "text-emerald-400" : "text-amber-400"}>
                  {(status.environmentalState.recommendedExposure * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={status.environmentalState.recommendedExposure * 100} className="h-1.5" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline" className="font-mono text-xs border-cyan-500/30">
                {status.environmentalState.marketRegime.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-cyan-500/30">
                {status.environmentalState.tradingSessionActivity.toUpperCase()} ACTIVITY
              </Badge>
              {status.environmentalState.majorEventsNearby && (
                <Badge variant="outline" className="font-mono text-xs border-amber-500/50 text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  MAJOR EVENTS
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-cyan-400 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              LEARNING METRICS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {status.learningMetrics.slice(0, 4).map(metric => (
              <div key={metric.name} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">{metric.name.toUpperCase().replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className={metric.trend === "improving" ? "text-emerald-400" : metric.trend === "declining" ? "text-red-400" : "text-amber-400"}>
                      {(metric.current * 100).toFixed(1)}%
                    </span>
                    {metric.trend === "improving" && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    {metric.trend === "declining" && <TrendingDown className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
                <Progress 
                  value={(metric.current / metric.target) * 100} 
                  className="h-1"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {trippedBreakers.length > 0 && (
        <Card className="glass border-red-500/30 glow-red">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              TRIPPED CIRCUIT BREAKERS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trippedBreakers.map(breaker => (
                <div key={breaker.id} className="flex items-center justify-between p-2 rounded bg-red-500/10 border border-red-500/20">
                  <div>
                    <p className="text-sm font-mono text-red-400">{breaker.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Value: {breaker.currentValue.toFixed(2)} / Threshold: {breaker.threshold}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs border-red-500/50 text-red-400">
                    {breaker.action.toUpperCase().replace(/_/g, ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
