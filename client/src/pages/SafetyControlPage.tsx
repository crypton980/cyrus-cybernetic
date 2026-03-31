import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  RefreshCw,
  Loader2,
  FileText,
  Hash,
  Clock,
} from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  event_type: string;
  actor?: string;
  target?: string;
  hash: string;
  prev_hash?: string;
  details?: Record<string, unknown>;
}

interface AuditStats {
  total_entries: number;
  chain_valid: boolean;
  first_entry?: string;
  last_entry?: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
}

interface LockdownState {
  locked: boolean;
  reason?: string;
  enabled_at?: string;
}

interface PendingAction {
  action_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function SafetyControlPage() {
  const qc = useQueryClient();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState("Manual lockdown via UI");
  const [auditMax, setAuditMax] = useState(50);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  const { data: auditData, isLoading: loadingAudit, refetch: refetchAudit } =
    useQuery<AuditResponse>({
      queryKey: ["audit-log", auditMax],
      queryFn: () => api(`/api/platform/control/audit?max_entries=${auditMax}`),
      refetchInterval: 20_000,
    });

  const { data: auditStats, isLoading: loadingStats } = useQuery<AuditStats>({
    queryKey: ["audit-stats"],
    queryFn: () => api("/api/platform/control/audit/stats"),
    refetchInterval: 30_000,
  });

  const { data: lockdownData, isLoading: loadingLockdown, refetch: refetchLockdown } =
    useQuery<LockdownState>({
      queryKey: ["lockdown-state"],
      queryFn: () => api("/api/platform/control/lockdown"),
      refetchInterval: 10_000,
    });

  const { data: pendingData, isLoading: loadingPending, refetch: refetchPending } =
    useQuery<{ pending_actions: PendingAction[] }>({
      queryKey: ["pending-actions-safety"],
      queryFn: () => api("/api/platform/control/pending-actions"),
      refetchInterval: 8_000,
    });

  const verifyChain = useMutation({
    mutationFn: () => api("/api/platform/control/audit/verify", { method: "POST", body: "{}" }),
    onSuccess: (d) => toast(`Chain: ${d.valid ? "✓ VALID" : "✗ TAMPERED"} (${d.checked} entries)`),
    onError: (e) => toast(`Verify error: ${(e as Error).message}`),
  });

  const enableLockdown = useMutation({
    mutationFn: () =>
      api("/api/platform/control/lockdown/enable", {
        method: "POST",
        body: JSON.stringify({ reason: lockReason }),
      }),
    onSuccess: () => { toast("🔒 LOCKDOWN ENABLED"); refetchLockdown(); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const disableLockdown = useMutation({
    mutationFn: () =>
      api("/api/platform/control/lockdown/disable", {
        method: "POST",
        body: JSON.stringify({ reason: "Disabled via UI" }),
      }),
    onSuccess: () => { toast("🔓 Lockdown lifted"); refetchLockdown(); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const approveAction = useMutation({
    mutationFn: (action_id: string) =>
      api(`/api/platform/control/approve/${action_id}`, { method: "POST", body: "{}" }),
    onSuccess: () => { toast("Action approved"); qc.invalidateQueries({ queryKey: ["pending-actions-safety"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const rejectAction = useMutation({
    mutationFn: (action_id: string) =>
      api(`/api/platform/control/reject/${action_id}`, { method: "POST", body: "{}" }),
    onSuccess: () => { toast("Action rejected"); qc.invalidateQueries({ queryKey: ["pending-actions-safety"] }); },
    onError: (e) => toast(`Error: ${(e as Error).message}`),
  });

  const entries = auditData?.entries ?? [];
  const pending = pendingData?.pending_actions ?? [];
  const locked = lockdownData?.locked ?? false;

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white p-6 space-y-6">
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-cyan-500 text-cyan-100 px-4 py-2 rounded-lg text-sm shadow-xl">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Safety &amp; Audit</h1>
            <p className="text-xs text-slate-400">SHA-256 hash-chained audit log · HITL approval gate · lockdown control</p>
          </div>
        </div>
        <button
          onClick={() => { refetchAudit(); refetchPending(); refetchLockdown(); }}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Audit Stats + Lockdown row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audit Stats */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" /> Audit Chain
            </span>
            <button
              onClick={() => verifyChain.mutate()}
              disabled={verifyChain.isPending}
              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            >
              {verifyChain.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
              Verify
            </button>
          </div>
          {loadingStats ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 rounded-lg p-2">
                <div className="text-slate-400">Total Entries</div>
                <div className="text-white font-bold text-lg">{auditStats?.total_entries ?? "—"}</div>
              </div>
              <div className={`rounded-lg p-2 ${auditStats?.chain_valid ? "bg-green-900/30 border border-green-700/40" : "bg-red-900/30 border border-red-700/40"}`}>
                <div className="text-slate-400">Chain Integrity</div>
                <div className={`font-bold text-sm flex items-center gap-1 mt-1 ${auditStats?.chain_valid ? "text-green-400" : "text-red-400"}`}>
                  {auditStats?.chain_valid ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {auditStats?.chain_valid ? "VALID" : "COMPROMISED"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lockdown Control */}
        <div className={`border rounded-xl p-4 space-y-3 ${locked ? "bg-red-900/20 border-red-600/50" : "bg-slate-900 border-slate-700"}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {locked ? <Lock className="w-4 h-4 text-red-400" /> : <Unlock className="w-4 h-4 text-green-400" />}
            <span className={locked ? "text-red-300" : "text-slate-300"}>
              System Lockdown — {loadingLockdown ? "…" : locked ? "ACTIVE" : "Inactive"}
            </span>
          </div>
          {locked && lockdownData?.reason && (
            <div className="text-xs text-red-300 bg-red-900/30 rounded-lg px-3 py-2">
              Reason: {lockdownData.reason}
            </div>
          )}
          {!locked && (
            <input
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Lockdown reason…"
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
          )}
          <button
            onClick={() => locked ? disableLockdown.mutate() : enableLockdown.mutate()}
            disabled={enableLockdown.isPending || disableLockdown.isPending}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              locked
                ? "bg-green-700 hover:bg-green-600"
                : "bg-red-700 hover:bg-red-600"
            } disabled:opacity-50`}
          >
            {(enableLockdown.isPending || disableLockdown.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
            {locked ? <><Unlock className="w-3 h-3" /> Disable Lockdown</> : <><Lock className="w-3 h-3" /> Enable Lockdown</>}
          </button>
        </div>
      </div>

      {/* Pending HITL Actions */}
      {(loadingPending || pending.length > 0) && (
        <div className="bg-yellow-900/20 border border-yellow-600/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-yellow-300">
            <AlertTriangle className="w-4 h-4" /> Pending HITL Actions
            <span className="text-yellow-500">({pending.length})</span>
          </div>
          {loadingPending ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="text-xs text-slate-500">No pending actions</div>
          ) : (
            <div className="space-y-2">
              {pending.map((a) => (
                <div key={a.action_id} className="flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white">{a.action_type}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{a.action_id}</div>
                    {a.created_at && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                        <Clock className="w-2.5 h-2.5" /> {new Date(a.created_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => approveAction.mutate(a.action_id)}
                      className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-xs font-medium"
                    >Approve</button>
                    <button
                      onClick={() => rejectAction.mutate(a.action_id)}
                      className="px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-medium"
                    >Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Log */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" /> Audit Log
          </span>
          <select
            value={auditMax}
            onChange={(e) => setAuditMax(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
          >
            <option value={20}>Last 20</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={200}>Last 200</option>
          </select>
        </div>
        {loadingAudit ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading audit log…
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">No audit entries</div>
        ) : (
          <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
            {entries.map((e, i) => (
              <div key={e.id ?? i} className="px-4 py-2 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="text-cyan-400 font-semibold">{e.event_type}</span>
                  {e.actor && <span className="text-slate-400">by {e.actor}</span>}
                  {e.target && <span className="text-slate-500">→ {e.target}</span>}
                </div>
                <div className="text-slate-600 truncate text-[10px] mt-0.5">
                  <Hash className="w-2.5 h-2.5 inline mr-1" />{e.hash}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
