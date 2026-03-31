import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  Target,
  Map,
  Layers,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Crosshair,
  Navigation2,
  Grid3x3,
  Minus,
  ChevronRight,
  Zap,
  Globe,
  Shield,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DroneState {
  drone_id: string;
  position?: { lat: number; lng: number; alt: number };
  velocity?: { vx: number; vy: number; vz: number };
  battery_pct?: number;
  mode?: string;
  armed?: boolean;
  task?: string;
  status?: string;
  last_heartbeat?: number;
}

interface SwarmState {
  drones: Record<string, DroneState>;
  active_tasks: unknown[];
  fault_count?: number;
}

interface NxiEntity {
  entity_id: string;
  entity_type: string;
  position?: { lat: number; lng: number; alt: number };
  confidence?: number;
  last_seen?: number;
}

interface NxiState {
  entities?: Record<string, NxiEntity>;
  event_count?: number;
  last_update?: number;
}

interface OrchestratorStatus {
  running?: boolean;
  loop_running?: boolean;
  subsystems?: Record<string, string>;
  uptime_seconds?: number;
  loop_iterations?: number;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    ok: { color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    operational: { color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    degraded: { color: "text-amber-400 bg-amber-500/15 border-amber-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
    offline: { color: "text-red-400 bg-red-500/15 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
    error: { color: "text-red-400 bg-red-500/15 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = map[status] ?? map["offline"];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.color}`}>
      {s.icon}
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "cyan",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: string;
}) {
  const colors: Record<string, string> = {
    cyan: "bg-cyan-500/15 text-cyan-400",
    emerald: "bg-emerald-500/15 text-emerald-400",
    purple: "bg-purple-500/15 text-purple-400",
    amber: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
  };
  return (
    <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[rgba(235,235,245,0.5)] text-sm">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

// ── Swarm Page ────────────────────────────────────────────────────────────────

export function SwarmPage() {
  const [formationType, setFormationType] = useState<"circle" | "line" | "wedge">("wedge");
  const [trackTarget, setTrackTarget] = useState("");
  const queryClient = useQueryClient();

  // ── Data queries ────────────────────────────────────────────────────────────
  const swarmQuery = useQuery<SwarmState>({
    queryKey: ["/api/swarm/state"],
    queryFn: async () => {
      const res = await fetch("/api/swarm/state");
      if (!res.ok) throw new Error("Swarm service unavailable");
      return res.json();
    },
    refetchInterval: 2000,
    retry: 1,
  });

  const nxiQuery = useQuery<NxiState>({
    queryKey: ["/api/swarm/nxi"],
    queryFn: async () => {
      const res = await fetch("/api/swarm/nxi");
      if (!res.ok) throw new Error("NXI service unavailable");
      return res.json();
    },
    refetchInterval: 3000,
    retry: 1,
  });

  const orchQuery = useQuery<OrchestratorStatus>({
    queryKey: ["/api/orchestrator/status"],
    queryFn: async () => {
      const res = await fetch("/api/orchestrator/status");
      if (!res.ok) throw new Error("Orchestrator unavailable");
      return res.json();
    },
    refetchInterval: 5000,
    retry: 1,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const formationMut = useMutation({
    mutationFn: async (type: string) => {
      const res = await fetch("/api/swarm/formation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation_type: type }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] }),
  });

  const trackMut = useMutation({
    mutationFn: async (targetId: string) => {
      const res = await fetch("/api/swarm/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: targetId, target_type: "unknown" }),
      });
      return res.json();
    },
  });

  const eventMut = useMutation({
    mutationFn: async (event: { event_type: string; data?: Record<string, unknown> }) => {
      const res = await fetch("/api/swarm/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] }),
  });

  const restartMut = useMutation({
    mutationFn: async (module: string) => {
      const res = await fetch(`/api/orchestrator/restart/${module}`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/status"] }),
  });

  // ── Derived values ──────────────────────────────────────────────────────────
  const drones = Object.values(swarmQuery.data?.drones ?? {});
  const entities = Object.values(nxiQuery.data?.entities ?? {});
  const subsystems = Object.entries(orchQuery.data?.subsystems ?? {});
  const isServiceUp = !swarmQuery.isError;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-black p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              Swarm Intelligence
            </h1>
            <p className="text-[rgba(235,235,245,0.5)] mt-1">
              Multi-drone coordination · Pursuit engine · NXI world model
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
              isServiceUp
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              {isServiceUp ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isServiceUp ? "Connected" : "Service Offline"}
            </div>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] });
                queryClient.invalidateQueries({ queryKey: ["/api/swarm/nxi"] });
                queryClient.invalidateQueries({ queryKey: ["/api/orchestrator/status"] });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-lg transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Summary stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active Drones" value={drones.length} icon={Navigation2} accent="cyan" />
          <StatCard
            label="NXI Entities"
            value={entities.length}
            icon={Globe}
            accent="purple"
          />
          <StatCard
            label="Active Tasks"
            value={swarmQuery.data?.active_tasks?.length ?? 0}
            icon={Target}
            accent="emerald"
          />
          <StatCard
            label="Fault Count"
            value={swarmQuery.data?.fault_count ?? 0}
            icon={AlertTriangle}
            accent={swarmQuery.data?.fault_count ? "red" : "emerald"}
          />
        </div>

        {/* ── Main two-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Drone Fleet */}
          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Navigation2 className="w-4 h-4 text-cyan-400" />
              Drone Fleet
            </h2>
            {swarmQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : drones.length === 0 ? (
              <div className="text-center py-10 text-[rgba(235,235,245,0.4)]">
                <Navigation2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No drones registered</p>
                <p className="text-xs mt-1">Register a drone via the Aerospace page</p>
              </div>
            ) : (
              <div className="space-y-3">
                {drones.map((d) => (
                  <div
                    key={d.drone_id}
                    className="flex items-center gap-3 p-3 bg-[#2c2c2e] rounded-lg"
                  >
                    <div className="w-9 h-9 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                      <Navigation2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.drone_id}</p>
                      <p className="text-xs text-[rgba(235,235,245,0.4)]">
                        {d.task ?? "idle"} · {d.mode ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{d.battery_pct != null ? `${d.battery_pct}%` : "—"}</p>
                      <p className="text-[10px] text-[rgba(235,235,245,0.4)]">battery</p>
                    </div>
                    <StatusBadge status={d.status ?? (d.armed ? "ok" : "offline")} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formation Control */}
          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-purple-400" />
              Formation Control
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {(["circle", "line", "wedge"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormationType(f)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    formationType === f
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                      : "bg-[#2c2c2e] border-[rgba(84,84,88,0.65)] text-[rgba(235,235,245,0.6)] hover:border-purple-500/30"
                  }`}
                >
                  {f === "circle" && "⬤ "}
                  {f === "line" && "— "}
                  {f === "wedge" && "◤ "}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={() => formationMut.mutate(formationType)}
              disabled={formationMut.isPending || drones.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            >
              {formationMut.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
              Apply {formationType} formation
            </button>

            {formationMut.isSuccess && (
              <p className="text-xs text-emerald-400 mt-2 text-center">Formation command sent ✓</p>
            )}

            {/* Pursuit tracking */}
            <div className="mt-5 pt-5 border-t border-[rgba(84,84,88,0.65)]">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-red-400" />
                Pursuit Tracking
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={trackTarget}
                  onChange={(e) => setTrackTarget(e.target.value)}
                  placeholder="Target ID…"
                  className="flex-1 bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/50"
                />
                <button
                  onClick={() => { if (trackTarget) trackMut.mutate(trackTarget); }}
                  disabled={trackMut.isPending || !trackTarget}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {trackMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                  Track
                </button>
              </div>
              {trackMut.isSuccess && (
                <p className="text-xs text-emerald-400 mt-2">Pursuit task dispatched ✓</p>
              )}
            </div>
          </div>
        </div>

        {/* ── NXI World Model ── */}
        <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              NXI Global Intelligence Map
            </h2>
            <div className="flex items-center gap-3 text-xs text-[rgba(235,235,245,0.4)]">
              <span>Events: {nxiQuery.data?.event_count ?? 0}</span>
              {nxiQuery.data?.last_update && (
                <span>Updated {new Date(nxiQuery.data.last_update * 1000).toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          {nxiQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : entities.length === 0 ? (
            <div className="text-center py-10 text-[rgba(235,235,245,0.4)]">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entities tracked yet</p>
              <p className="text-xs mt-1">Entities appear when perception or swarm tracking detects them</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {entities.slice(0, 12).map((e) => (
                <div key={e.entity_id} className="flex items-center gap-3 p-3 bg-[#2c2c2e] rounded-lg">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Map className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{e.entity_id}</p>
                    <p className="text-[10px] text-[rgba(235,235,245,0.4)]">
                      {e.entity_type} · {e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
                    </p>
                  </div>
                  {e.position && (
                    <div className="text-right text-[10px] text-[rgba(235,235,245,0.4)]">
                      <p>{e.position.lat.toFixed(4)}</p>
                      <p>{e.position.lng.toFixed(4)}</p>
                    </div>
                  )}
                </div>
              ))}
              {entities.length > 12 && (
                <div className="flex items-center justify-center p-3 bg-[#2c2c2e] rounded-lg text-[rgba(235,235,245,0.4)] text-sm">
                  +{entities.length - 12} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── System Orchestrator ── */}
        <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              System Orchestrator
            </h2>
            <div className="flex items-center gap-2">
              {orchQuery.data?.loop_running ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Brain loop active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Brain loop stopped
                </span>
              )}
              {orchQuery.data?.uptime_seconds != null && (
                <span className="text-xs text-[rgba(235,235,245,0.4)]">
                  · up {Math.floor(orchQuery.data.uptime_seconds / 60)}m
                </span>
              )}
            </div>
          </div>

          {subsystems.length === 0 ? (
            <div className="text-center py-8 text-[rgba(235,235,245,0.4)]">
              <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Orchestrator data unavailable</p>
              <p className="text-xs mt-1">Start the CYRUS AI service to see subsystem status</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {subsystems.map(([name, status]) => (
                <div
                  key={name}
                  className="bg-[#2c2c2e] rounded-xl p-3 flex flex-col items-center gap-2"
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    status === "ok" ? "bg-emerald-400" :
                    status === "degraded" ? "bg-amber-400" : "bg-red-400"
                  }`} />
                  <p className="text-xs font-medium text-center capitalize">{name.replace(/_/g, " ")}</p>
                  <StatusBadge status={status === "ok" ? "ok" : status} />
                  <button
                    onClick={() => restartMut.mutate(name)}
                    disabled={restartMut.isPending}
                    className="text-[10px] text-[rgba(235,235,245,0.4)] hover:text-cyan-400 transition-colors"
                  >
                    restart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Event Bus Quick-Fire ── */}
        <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Event Bus — Quick Commands
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Formation Request", event: "formation_request", data: { formation_type: formationType } },
              { label: "State Query", event: "state_query", data: {} },
              { label: "Fault Ping", event: "drone_fault", data: { drone_id: "test", fault: "ping" } },
            ].map((cmd) => (
              <button
                key={cmd.event}
                onClick={() => eventMut.mutate({ event_type: cmd.event, data: cmd.data })}
                disabled={eventMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-[#2c2c2e] hover:bg-[#3c3c3e] border border-[rgba(84,84,88,0.65)] hover:border-cyan-500/30 rounded-lg text-sm transition-all disabled:opacity-50"
              >
                <ChevronRight className="w-3 h-3 text-cyan-400" />
                {cmd.label}
              </button>
            ))}
          </div>
          {eventMut.isSuccess && (
            <p className="text-xs text-emerald-400 mt-3">Event dispatched ✓</p>
          )}
        </div>

      </div>
    </div>
  );
}
