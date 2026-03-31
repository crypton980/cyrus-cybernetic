import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Server,
  Archive,
  Bell,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RotateCcw,
  Gauge,
} from "lucide-react";

interface SystemHealth {
  status: string;
  uptime?: number;
  node_id?: string;
  redis_available?: boolean;
  subsystems?: Record<string, string>;
}

interface PerformanceMetrics {
  total_requests?: number;
  avg_latency_ms?: number;
  error_rate?: number;
  recent_errors?: number;
  optimization_state?: string;
  metrics?: Array<{ name: string; value: number; ts: number }>;
}

interface AlertConfig {
  webhook_url?: string;
  alert_count?: number;
  error_rate_threshold?: number;
}

interface BackupRecord {
  backup_id: string;
  size_bytes?: number;
  sha256?: string;
  created_at: string;
  manifest?: Record<string, unknown>;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-1.5 ${ok ? "bg-green-400" : "bg-red-500"}`}
    />
  );
}

export function ObservabilityPage() {
  const qc = useQueryClient();
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  const { data: healthData, isLoading: loadingHealth, refetch: refetchHealth } =
    useQuery<SystemHealth>({
      queryKey: ["obs-health"],
      queryFn: () => api("/api/platform/observability/health"),
      refetchInterval: 10_000,
    });

  const { data: perfData, isLoading: loadingPerf, refetch: refetchPerf } =
    useQuery<PerformanceMetrics>({
      queryKey: ["obs-perf"],
      queryFn: () => api("/api/platform/observability/metrics"),
      refetchInterval: 15_000,
    });

  const { data: alertData, isLoading: loadingAlerts } =
    useQuery<AlertConfig>({
      queryKey: ["obs-alerts"],
      queryFn: () => api("/api/platform/control/alerts"),
      refetchInterval: 30_000,
    });

  const { data: backupList, isLoading: loadingBackups, refetch: refetchBackups } =
    useQuery<{ backups: BackupRecord[] }>({
      queryKey: ["backup-list"],
      queryFn: () => api("/api/platform/backup/list"),
      refetchInterval: 60_000,
    });

  const triggerBackup = useMutation({
    mutationFn: () =>
      api("/api/platform/backup/trigger", { method: "POST", body: "{}" }),
    onSuccess: (d) => {
      toast(`Backup created: ${(d as { backup_id?: string }).backup_id ?? "done"}`);
      qc.invalidateQueries({ queryKey: ["backup-list"] });
    },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const restoreBackup = useMutation({
    mutationFn: (backup_id: string) =>
      api(`/api/platform/backup/restore/${backup_id}`, { method: "POST", body: "{}" }),
    onSuccess: () => toast("Restore initiated"),
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const testAlert = useMutation({
    mutationFn: () =>
      api("/api/platform/control/alerts/test", {
        method: "POST",
        body: JSON.stringify({ message: "Test alert from CYRUS UI" }),
      }),
    onSuccess: () => toast("Test alert sent"),
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const backups = backupList?.backups ?? [];

  function formatBytes(b?: number) {
    if (b == null) return "—";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  function formatUptime(s?: number) {
    if (s == null) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const systemOk = healthData?.status === "ok" || healthData?.status === "healthy";

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-cyan-500 text-cyan-100 px-4 py-2 rounded-lg text-sm shadow-xl">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gauge className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Observability</h1>
            <p className="text-xs text-slate-400">System health · performance metrics · alerts · backup &amp; restore</p>
          </div>
        </div>
        <button
          onClick={() => { refetchHealth(); refetchPerf(); refetchBackups(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* System Health */}
      <div className={`border rounded-xl p-4 space-y-3 ${systemOk ? "bg-green-900/10 border-green-700/40" : "bg-red-900/10 border-red-700/40"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Server className="w-4 h-4 text-emerald-400" />
            <span className={systemOk ? "text-green-300" : "text-red-300"}>
              System Health — {loadingHealth ? "…" : healthData?.status?.toUpperCase() ?? "UNKNOWN"}
            </span>
          </div>
          {!loadingHealth && (
            systemOk
              ? <CheckCircle2 className="w-5 h-5 text-green-400" />
              : <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
        {loadingHealth ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900/60 rounded-lg p-2">
              <div className="text-slate-400">Uptime</div>
              <div className="text-white font-medium mt-0.5">{formatUptime(healthData?.uptime)}</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2">
              <div className="text-slate-400">Node ID</div>
              <div className="text-white font-mono truncate mt-0.5">{healthData?.node_id ?? "local"}</div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2">
              <div className="text-slate-400">Redis</div>
              <div className={`font-medium mt-0.5 flex items-center ${healthData?.redis_available ? "text-green-400" : "text-yellow-400"}`}>
                <StatusDot ok={healthData?.redis_available ?? false} />
                {healthData?.redis_available ? "Connected" : "Offline"}
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2">
              <div className="text-slate-400">AI Service</div>
              <div className={`font-medium mt-0.5 flex items-center ${systemOk ? "text-green-400" : "text-red-400"}`}>
                <StatusDot ok={systemOk} />
                {systemOk ? "Online" : "Degraded"}
              </div>
            </div>
          </div>
        )}

        {/* Subsystems */}
        {healthData?.subsystems && Object.keys(healthData.subsystems).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(healthData.subsystems).map(([name, status]) => (
              <span
                key={name}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${
                  status === "ok" || status === "running"
                    ? "bg-green-900/20 border-green-700/40 text-green-300"
                    : "bg-red-900/20 border-red-700/40 text-red-300"
                }`}
              >
                <StatusDot ok={status === "ok" || status === "running"} />
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Activity className="w-4 h-4 text-cyan-400" /> Performance Metrics
        </div>
        {loadingPerf ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Requests", value: perfData?.total_requests ?? "—" },
              { label: "Avg Latency", value: perfData?.avg_latency_ms != null ? `${perfData.avg_latency_ms.toFixed(1)}ms` : "—" },
              { label: "Error Rate", value: perfData?.error_rate != null ? `${(perfData.error_rate * 100).toFixed(2)}%` : "—" },
              { label: "Optimizer State", value: perfData?.optimization_state ?? "—" },
            ].map((m) => (
              <div key={m.label} className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400">{m.label}</div>
                <div className="text-white font-bold text-lg mt-0.5">{m.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Bell className="w-4 h-4 text-yellow-400" /> Alert System
          </div>
          <button
            onClick={() => testAlert.mutate()}
            disabled={testAlert.isPending}
            className="flex items-center gap-1 px-3 py-1 bg-yellow-800 hover:bg-yellow-700 disabled:opacity-50 rounded text-xs font-medium"
          >
            {testAlert.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
            Test Alert
          </button>
        </div>
        {loadingAlerts ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-400">Webhook</div>
              <div className={`mt-0.5 ${alertData?.webhook_url ? "text-green-400" : "text-slate-500"}`}>
                {alertData?.webhook_url ? "✓ Configured" : "Not configured"}
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-400">Total Alerts</div>
              <div className="text-white font-medium mt-0.5">{alertData?.alert_count ?? 0}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-2">
              <div className="text-slate-400">Error Threshold</div>
              <div className="text-white font-medium mt-0.5">
                {alertData?.error_rate_threshold != null
                  ? `${(alertData.error_rate_threshold * 100).toFixed(0)}%`
                  : "—"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Archive className="w-4 h-4 text-cyan-400" /> Backups
            <span className="text-slate-500 text-xs">({backups.length})</span>
          </div>
          <button
            onClick={() => triggerBackup.mutate()}
            disabled={triggerBackup.isPending}
            className="flex items-center gap-1 px-3 py-1 bg-cyan-800 hover:bg-cyan-700 disabled:opacity-50 rounded text-xs font-medium"
          >
            {triggerBackup.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Create Backup
          </button>
        </div>
        {loadingBackups ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading backups…
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No backups yet</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {backups.map((b) => (
              <div key={b.backup_id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-white truncate">{b.backup_id}</div>
                  {b.sha256 && (
                    <div className="text-xs text-slate-500 font-mono truncate">SHA256: {b.sha256.slice(0, 16)}…</div>
                  )}
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatBytes(b.size_bytes)} · {new Date(b.created_at).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Restore this backup? This will overwrite current data."))
                      restoreBackup.mutate(b.backup_id);
                  }}
                  disabled={restoreBackup.isPending}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded text-xs font-medium shrink-0"
                >
                  <RotateCcw className="w-3 h-3" /> Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
