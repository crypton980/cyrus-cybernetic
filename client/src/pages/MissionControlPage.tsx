import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flag,
  Play,
  Square,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ChevronRight,
  Target,
  ListChecks,
  Clipboard,
} from "lucide-react";

interface MissionRecord {
  mission_id: string;
  name: string;
  status: "active" | "pending" | "completed" | "failed" | "aborted";
  steps_total: number;
  steps_done: number;
  created_at: string;
  completed_at?: string;
  meta?: Record<string, unknown>;
}

interface MissionListResponse {
  missions: MissionRecord[];
  total: number;
}

interface PendingAction {
  action_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  expires_at?: string;
}

const STATUS_COLOR: Record<string, string> = {
  active: "text-cyan-400",
  pending: "text-yellow-400",
  completed: "text-green-400",
  failed: "text-red-400",
  aborted: "text-slate-400",
};

const STATUS_ICON = {
  active: <Play className="w-3 h-3" />,
  pending: <Clock className="w-3 h-3" />,
  completed: <CheckCircle2 className="w-3 h-3" />,
  failed: <AlertTriangle className="w-3 h-3" />,
  aborted: <Square className="w-3 h-3" />,
};

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function MissionControlPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newMissionName, setNewMissionName] = useState("");
  const [newMissionSteps, setNewMissionSteps] = useState(3);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  const { data: missionsData, isLoading: loadingMissions, refetch: refetchMissions } = useQuery<MissionListResponse>({
    queryKey: ["mission-list", statusFilter],
    queryFn: () =>
      api(`/api/platform/mission/list?status=${statusFilter !== "all" ? statusFilter : ""}&limit=50`),
    refetchInterval: 10_000,
  });

  const { data: pendingData, isLoading: loadingPending, refetch: refetchPending } = useQuery<{ pending_actions: PendingAction[] }>({
    queryKey: ["pending-actions"],
    queryFn: () => api("/api/platform/control/pending-actions"),
    refetchInterval: 8_000,
  });

  const startMission = useMutation({
    mutationFn: (body: { name: string; steps: number }) =>
      api("/api/platform/mission/start", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast("Mission started");
      setNewMissionName("");
      qc.invalidateQueries({ queryKey: ["mission-list"] });
    },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const stopMission = useMutation({
    mutationFn: (mission_id: string) =>
      api("/api/platform/mission/stop", { method: "POST", body: JSON.stringify({ mission_id }) }),
    onSuccess: () => { toast("Mission stopped"); qc.invalidateQueries({ queryKey: ["mission-list"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const completeMission = useMutation({
    mutationFn: (mission_id: string) =>
      api("/api/platform/mission/complete", { method: "POST", body: JSON.stringify({ mission_id }) }),
    onSuccess: () => { toast("Mission completed"); qc.invalidateQueries({ queryKey: ["mission-list"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const approveAction = useMutation({
    mutationFn: (action_id: string) =>
      api(`/api/platform/control/approve/${action_id}`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { toast("Action approved"); qc.invalidateQueries({ queryKey: ["pending-actions"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const rejectAction = useMutation({
    mutationFn: (action_id: string) =>
      api(`/api/platform/control/reject/${action_id}`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { toast("Action rejected"); qc.invalidateQueries({ queryKey: ["pending-actions"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const missions = missionsData?.missions ?? [];
  const pending = pendingData?.pending_actions ?? [];

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-cyan-900 border border-cyan-500 text-cyan-100 px-4 py-2 rounded-lg text-sm shadow-xl">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flag className="w-6 h-6 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Mission Control</h1>
            <p className="text-xs text-slate-400">HITL-gated mission management · audit-chained</p>
          </div>
        </div>
        <button
          onClick={() => { refetchMissions(); refetchPending(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Start Mission */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Clipboard className="w-4 h-4 text-cyan-400" /> New Mission
        </div>
        <div className="flex gap-3 flex-wrap">
          <input
            value={newMissionName}
            onChange={(e) => setNewMissionName(e.target.value)}
            placeholder="Mission name…"
            className="flex-1 min-w-[180px] bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Steps:</span>
            <input
              type="number"
              min={1}
              max={50}
              value={newMissionSteps}
              onChange={(e) => setNewMissionSteps(Number(e.target.value))}
              className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            onClick={() => startMission.mutate({ name: newMissionName || "Unnamed", steps: newMissionSteps })}
            disabled={startMission.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            {startMission.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Start Mission
          </button>
        </div>
      </div>

      {/* HITL Pending Actions */}
      {pending.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-300">
            <AlertTriangle className="w-4 h-4" />
            HITL Pending Actions ({pending.length})
          </div>
          <div className="space-y-2">
            {pending.map((a) => (
              <div key={a.action_id} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-white">{a.action_type}</div>
                  <div className="text-xs text-slate-400 font-mono">ID: {a.action_id.slice(0, 8)}…</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveAction.mutate(a.action_id)}
                    disabled={approveAction.isPending}
                    className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-medium"
                  >Approve</button>
                  <button
                    onClick={() => rejectAction.mutate(a.action_id)}
                    disabled={rejectAction.isPending}
                    className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-medium"
                  >Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mission List */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <ListChecks className="w-4 h-4 text-cyan-400" /> Missions
            <span className="text-xs text-slate-500">({missions.length})</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loadingMissions ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading missions…
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">No missions found</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {missions.map((m) => {
              const pct = m.steps_total > 0 ? Math.round((m.steps_done / m.steps_total) * 100) : 0;
              return (
                <div key={m.mission_id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Target className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{m.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{m.mission_id.slice(0, 10)}…</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:block w-28">
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>{m.steps_done}/{m.steps_total} steps</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <span className={`flex items-center gap-1 text-xs font-medium ${STATUS_COLOR[m.status] ?? "text-slate-400"}`}>
                      {STATUS_ICON[m.status]} {m.status}
                    </span>

                    {m.status === "active" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => completeMission.mutate(m.mission_id)}
                          className="px-2 py-1 bg-green-800 hover:bg-green-700 rounded text-xs"
                          title="Complete"
                        ><CheckCircle2 className="w-3 h-3" /></button>
                        <button
                          onClick={() => stopMission.mutate(m.mission_id)}
                          className="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs"
                          title="Stop"
                        ><Square className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
