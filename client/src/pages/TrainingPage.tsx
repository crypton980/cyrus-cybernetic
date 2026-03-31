import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  Zap,
  Database,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Cpu,
} from "lucide-react";

interface TrainingStats {
  dataset?: {
    total_examples?: number;
    example_count?: number;
    file?: string;
    size_bytes?: number;
    quality_pass?: number;
    quality_fail?: number;
    categories?: Record<string, number>;
  };
  job?: {
    status?: string;
    started_at?: string;
    completed_at?: string;
    examples?: number;
  } | null;
  auto_train?: boolean;
  versions?: Array<{ name: string; path: string; created_at?: string }>;
  node_id?: string;
  total_examples?: number;
  training_jobs?: number;
  auto_train_enabled?: boolean;
  cooldown_remaining?: number;
  model_mode?: string;
}

interface ModelStatus {
  model_mode: string;
  local_model?: string;
  local_model_loaded: boolean;
  openai_configured: boolean;
  current_model?: string;
  checkpoint?: string;
}

interface DatasetStats {
  total_records?: number;
  example_count?: number;
  quality_pass?: number;
  quality_fail?: number;
  categories?: Record<string, number>;
  file?: string;
  size_bytes?: number;
}

interface Checkpoint {
  id: string;
  name: string;
  path: string;
  created_at: string;
  size_mb?: number;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-white font-bold text-xl mt-0.5">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function TrainingPage() {
  const qc = useQueryClient();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [forceRetrain, setForceRetrain] = useState(false);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  const { data: trainingStats, isLoading: loadingTraining, refetch: refetchTraining } =
    useQuery<TrainingStats>({
      queryKey: ["training-stats"],
      queryFn: () => api("/api/platform/training/stats"),
      refetchInterval: 15_000,
    });

  const { data: modelStatus, isLoading: loadingModel, refetch: refetchModel } =
    useQuery<ModelStatus>({
      queryKey: ["model-status"],
      queryFn: () => api("/api/platform/model/status"),
      refetchInterval: 20_000,
    });

  const { data: datasetStats, isLoading: loadingDataset } =
    useQuery<DatasetStats>({
      queryKey: ["dataset-stats"],
      queryFn: () => api("/api/platform/training/dataset/stats"),
      refetchInterval: 30_000,
    });

  const { data: checkpointsData, isLoading: loadingCheckpoints } =
    useQuery<{ checkpoints: Checkpoint[] }>({
      queryKey: ["model-checkpoints"],
      queryFn: () => api("/api/platform/model/checkpoints"),
      refetchInterval: 60_000,
    });

  const triggerTraining = useMutation({
    mutationFn: () =>
      api("/api/platform/training/trigger", {
        method: "POST",
        body: JSON.stringify({ force: forceRetrain }),
      }),
    onSuccess: (d) => {
      toast(`Training: ${d.triggered ? "✓ Triggered" : d.reason ?? "Not triggered"}`);
      qc.invalidateQueries({ queryKey: ["training-stats"] });
    },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const checkpoints = checkpointsData?.checkpoints ?? [];
  const qPass = datasetStats?.quality_pass ?? 0;
  const qFail = datasetStats?.quality_fail ?? 0;
  const qTotal = qPass + qFail;
  const qPct = qTotal > 0 ? Math.round((qPass / qTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-cyan-500 text-cyan-100 px-4 py-2 rounded-lg text-sm shadow-xl">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Training &amp; Model</h1>
            <p className="text-xs text-slate-400">Self-improving platform · fine-tuning · checkpoint management</p>
          </div>
        </div>
        <button
          onClick={() => { refetchTraining(); refetchModel(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Model Status */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Cpu className="w-4 h-4 text-purple-400" /> Active Model
        </div>
        {loadingModel ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Mode" value={modelStatus?.model_mode ?? "—"} />
            <Metric label="OpenAI" value={modelStatus?.openai_configured ? "✓ Ready" : "✗ Not set"} />
            <Metric label="Local Model" value={modelStatus?.local_model_loaded ? "✓ Loaded" : "Unloaded"} sub={modelStatus?.local_model} />
            <Metric label="Current" value={modelStatus?.current_model ?? modelStatus?.model_mode ?? "—"} />
          </div>
        )}
      </div>

      {/* Training Stats + Trigger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Training Stats
          </div>
          {loadingTraining ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Examples" value={trainingStats?.dataset?.total_examples ?? trainingStats?.dataset?.example_count ?? trainingStats?.total_examples ?? "—"} />
              <Metric label="Jobs Run" value={trainingStats?.training_jobs ?? (trainingStats?.versions?.length ?? "—")} />
              <Metric label="Auto-Train" value={(trainingStats?.auto_train ?? trainingStats?.auto_train_enabled) ? "Enabled" : "Disabled"} />
              <Metric
                label="Job Status"
                value={trainingStats?.job?.status ?? (trainingStats?.cooldown_remaining ? `Cooldown ${Math.round(trainingStats.cooldown_remaining)}s` : "Ready")}
              />
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Zap className="w-4 h-4 text-yellow-400" /> Trigger Training
          </div>
          <p className="text-xs text-slate-400">
            Manually trigger a fine-tuning run. CYRUS auto-trains when it has
            accumulated enough quality examples and the cooldown has elapsed.
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={forceRetrain}
              onChange={(e) => setForceRetrain(e.target.checked)}
              className="w-3 h-3"
            />
            Force (bypass cooldown &amp; min-examples check)
          </label>
          <button
            onClick={() => triggerTraining.mutate()}
            disabled={triggerTraining.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            {triggerTraining.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Play className="w-3 h-3" />
            )}
            Trigger Training Run
          </button>
        </div>
      </div>

      {/* Dataset Quality */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Database className="w-4 h-4 text-cyan-400" /> Dataset Quality
        </div>
        {loadingDataset ? (
          <div className="text-xs text-slate-500">Loading…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Total Records" value={datasetStats?.total_records ?? datasetStats?.example_count ?? "—"} />
              <Metric label="Quality Pass" value={qPass} sub={`${qPct}% pass rate`} />
              <Metric label="Quality Fail" value={qFail} />
            </div>
            {qTotal > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Quality gate</span>
                  <span>{qPct}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${qPct >= 70 ? "bg-green-500" : qPct >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${qPct}%` }}
                  />
                </div>
              </div>
            )}
            {datasetStats?.categories && Object.keys(datasetStats.categories).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(datasetStats.categories).map(([cat, cnt]) => (
                  <span key={cat} className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">
                    {cat}: <span className="text-white font-medium">{cnt as number}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Checkpoints */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 text-sm font-semibold text-slate-300">
          <BookOpen className="w-4 h-4 text-cyan-400" /> Model Checkpoints
        </div>
        {loadingCheckpoints ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No checkpoints saved yet</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {checkpoints.map((ck) => (
              <div key={ck.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{ck.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{ck.path}</div>
                </div>
                <div className="text-right">
                  {ck.size_mb != null && (
                    <div className="text-xs text-slate-400">{ck.size_mb.toFixed(1)} MB</div>
                  )}
                  <div className="text-xs text-slate-500">
                    {new Date(ck.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
