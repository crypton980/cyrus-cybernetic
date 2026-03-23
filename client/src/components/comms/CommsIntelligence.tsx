import {
  Brain,
  Activity,
  Users,
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  useUserInsights,
  useContactSuggestions,
  useAnomalyAlerts,
  useNetworkHealth,
} from "../../hooks/useCommsIntelligence";

interface Props {
  userId: string;
  darkMode?: boolean;
}


function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: (props: any) => any;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-gray-800 ${accent ?? "text-cyan-400"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold text-white">{value}</p>
      </div>
    </div>
  );
}

export function CommsIntelligence({ userId }: Props) {
  const { data: insights, isLoading: insightsLoading } = useUserInsights(userId);
  const { data: suggestionsData } = useContactSuggestions(userId);
  const { data: anomaliesData } = useAnomalyAlerts(userId);
  const { data: healthData } = useNetworkHealth();

  const suggestions: Array<{ contactId: string; relevanceScore: number; reason: string }> =
    suggestionsData?.suggestions ?? [];
  const anomalies: Array<{ type: string; severity: string; description: string; timestamp: string }> =
    anomaliesData?.anomalies ?? [];
  const health = healthData?.health;
  const profile = insights?.profile;
  const sentimentTrend: number[] = insights?.sentimentTrend ?? [];
  const churnRisk = profile?.churnRiskScore
    ? parseFloat(profile.churnRiskScore)
    : null;

  const peakHours: Record<string, number> =
    profile?.communicationPatterns?.peakHours ?? {};

  const churnColor =
    churnRisk == null
      ? "text-gray-400"
      : churnRisk < 0.33
      ? "text-green-400"
      : churnRisk < 0.66
      ? "text-yellow-400"
      : "text-red-400";
  const churnLabel =
    churnRisk == null
      ? "—"
      : churnRisk < 0.33
      ? "Low"
      : churnRisk < 0.66
      ? "Medium"
      : "High";

  return (
    <div className="space-y-6 text-sm">
      {/* ── Network Health ── */}
      <section>
        <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
          <Activity className="w-4 h-4" /> Network Health
        </h3>
        {health ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard icon={Users} label="Total Users" value={health.totalUsers ?? "—"} />
            <StatCard icon={Zap} label="Active Today" value={health.activeToday ?? "—"} accent="text-green-400" />
            <StatCard
              icon={Brain}
              label="Avg Sentiment"
              value={
                health.avgSentiment != null
                  ? (parseFloat(health.avgSentiment) * 100).toFixed(0) + "%"
                  : "—"
              }
              accent={
                parseFloat(health.avgSentiment ?? "0") > 0.1
                  ? "text-green-400"
                  : parseFloat(health.avgSentiment ?? "0") < -0.1
                  ? "text-red-400"
                  : "text-gray-400"
              }
            />
            <StatCard icon={BarChart3} label="Messages Today" value={health.messagesToday ?? "—"} />
            <StatCard
              icon={Shield}
              label="Call Success"
              value={
                health.callSuccessRate != null
                  ? (parseFloat(health.callSuccessRate) * 100).toFixed(0) + "%"
                  : "—"
              }
              accent="text-cyan-400"
            />
          </div>
        ) : (
          <p className="text-gray-500 text-xs">Loading network health…</p>
        )}
      </section>

      {/* ── User Insights ── */}
      <section>
        <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
          <TrendingUp className="w-4 h-4" /> Communication Patterns
        </h3>
        {insightsLoading ? (
          <p className="text-gray-500 text-xs">Loading insights…</p>
        ) : profile ? (
          <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-500">Avg Msg Length</p>
                <p className="text-white font-medium">
                  {profile.communicationPatterns?.avgMsgLength?.toFixed(0) ?? "—"} chars
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Msg / Day</p>
                <p className="text-white font-medium">
                  {profile.communicationPatterns?.messagingFrequency?.toFixed(1) ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Preferred Channel</p>
                <p className="text-white font-medium capitalize">
                  {profile.communicationPatterns?.preferredChannels?.[0]?.replace("_", " ") ?? "—"}
                </p>
              </div>
            </div>

            {/* Peak hours bar chart (0-23) */}
            {Object.keys(peakHours).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Peak Hours (24h)</p>
                <div className="flex items-end gap-0.5 h-10">
                  {Array.from({ length: 24 }, (_, h) => {
                    const val = peakHours[String(h)] ?? 0;
                    const max = Math.max(1, ...Object.values(peakHours));
                    const pct = Math.round((val / max) * 100);
                    return (
                      <div
                        key={h}
                        className="flex-1 bg-cyan-600 rounded-t opacity-80"
                        style={{ height: `${pct}%`, minHeight: val > 0 ? "2px" : undefined }}
                        title={`${h}:00 — ${val} msgs`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                  <span>0h</span><span>12h</span><span>23h</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-xs">No profile data yet. Start interacting to build your intelligence profile.</p>
        )}
      </section>

      {/* ── Sentiment Trend ── */}
      {sentimentTrend.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
            <Brain className="w-4 h-4" /> Sentiment Trend
          </h3>
          <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-1 flex-wrap">
              {sentimentTrend.slice(-20).map((score, i) => {
                const bg =
                  score > 0.1
                    ? "bg-green-500"
                    : score < -0.1
                    ? "bg-red-500"
                    : "bg-gray-500";
                return (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full ${bg} opacity-80`}
                    title={`Score: ${score.toFixed(2)}`}
                  />
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Last {sentimentTrend.slice(-20).length} interactions · 🟢 positive · ⚫ neutral · 🔴 negative
            </p>
          </div>
        </section>
      )}

      {/* ── Contact Suggestions ── */}
      <section>
        <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
          <Users className="w-4 h-4" /> Smart Contact Suggestions
        </h3>
        {suggestions.length === 0 ? (
          <p className="text-gray-500 text-xs">No suggestions yet. Interact with more contacts to get personalised recommendations.</p>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-cyan-900 border border-cyan-700 flex items-center justify-center text-cyan-300 font-bold text-sm shrink-0">
                  {s.contactId.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{s.contactId}</p>
                  <p className="text-xs text-gray-400 truncate">{s.reason}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-cyan-400 font-semibold text-xs">
                    {Math.round(s.relevanceScore * 100)}%
                  </p>
                  <div className="w-16 h-1 bg-gray-700 rounded-full mt-1">
                    <div
                      className="h-1 bg-cyan-500 rounded-full"
                      style={{ width: `${Math.round(s.relevanceScore * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Anomaly Alerts ── */}
      <section>
        <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
          <AlertTriangle className="w-4 h-4" /> Anomaly Alerts
        </h3>
        {anomalies.length === 0 ? (
          <p className="text-gray-500 text-xs">No anomalies detected. Your communication patterns look normal.</p>
        ) : (
          <div className="space-y-2">
            {anomalies.map((a, i) => {
              const isCritical = a.severity === "critical";
              return (
                <div
                  key={i}
                  className={`border rounded-xl p-3 flex items-start gap-3 ${
                    isCritical
                      ? "border-red-700 bg-red-900/20"
                      : "border-yellow-700 bg-yellow-900/20"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${isCritical ? "text-red-400" : "text-yellow-400"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${isCritical ? "text-red-300" : "text-yellow-300"}`}>
                      {a.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-400">{a.description}</p>
                    {a.timestamp && (
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(a.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${
                      isCritical
                        ? "border-red-600 text-red-400"
                        : "border-yellow-600 text-yellow-400"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Churn Risk ── */}
      {churnRisk != null && (

        <section>
          <h3 className="flex items-center gap-2 text-cyan-400 font-semibold mb-3">
            <Shield className="w-4 h-4" /> Engagement Risk
          </h3>
          <div className="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-xl p-4 flex items-center gap-4">
            <div className={`text-3xl font-bold ${churnColor}`}>{churnLabel}</div>
            <div className="flex-1">
              <div className="h-2 bg-gray-700 rounded-full">
                <div
                  className={`h-2 rounded-full transition-all ${
                    churnRisk < 0.33
                      ? "bg-green-500"
                      : churnRisk < 0.66
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${Math.round(churnRisk * 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round(churnRisk * 100)}% disengagement risk based on recent activity
              </p>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
