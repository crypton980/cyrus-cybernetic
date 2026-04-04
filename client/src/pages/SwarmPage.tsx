import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plane,
  Radio,
  Target,
  Layers,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  Navigation,
  Shield,
  Plus,
} from "lucide-react";

interface DroneState {
  id: string;
  name: string;
  status: "active" | "idle" | "fault" | "pursuing";
  battery: number;
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  speed: number;
  task?: string;
  lastHeartbeat: number;
}

interface SwarmStateResponse {
  success: boolean;
  drones: DroneState[];
  formation: "circle" | "line" | "wedge" | "none";
  activePursuits: string[];
  totalDrones: number;
  activeDrones: number;
  timestamp: string;
}

interface NxiEvent {
  id: string;
  type: string;
  data: unknown;
  ts: number;
}

interface NxiResponse {
  success: boolean;
  events: NxiEvent[];
  totalEvents: number;
  timestamp: string;
}

const FORMATION_OPTIONS: Array<{ value: "circle" | "line" | "wedge" | "none"; label: string }> = [
  { value: "none", label: "None" },
  { value: "circle", label: "Circle" },
  { value: "line", label: "Line" },
  { value: "wedge", label: "Wedge" },
];

function statusIcon(status: DroneState["status"]) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "pursuing":
      return <Target className="w-4 h-4 text-cyan-400" />;
    case "idle":
      return <Activity className="w-4 h-4 text-gray-400" />;
    case "fault":
      return <XCircle className="w-4 h-4 text-red-400" />;
  }
}

function statusBadge(status: DroneState["status"]) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    pursuing: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    idle: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    fault: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return map[status] || map.idle;
}

export function SwarmPage() {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [registerName, setRegisterName] = useState("");
  const droneCounter = useRef(0);

  const { data: swarmData, isLoading, isFetching, refetch } = useQuery<SwarmStateResponse>({
    queryKey: ["/api/swarm/state"],
    queryFn: async () => {
      const res = await fetch("/api/swarm/state");
      if (!res.ok) throw new Error("Failed to fetch swarm state");
      return res.json();
    },
    refetchInterval: 4000,
  });

  const { data: nxiData } = useQuery<NxiResponse>({
    queryKey: ["/api/swarm/nxi"],
    queryFn: async () => {
      const res = await fetch("/api/swarm/nxi");
      if (!res.ok) throw new Error("Failed to fetch NXI events");
      return res.json();
    },
    refetchInterval: 4000,
  });

  const { data: orchestratorData } = useQuery({
    queryKey: ["/api/orchestrator/health"],
    queryFn: async () => {
      const res = await fetch("/api/orchestrator/health");
      if (!res.ok) throw new Error("Orchestrator unavailable");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const formationMutation = useMutation({
    mutationFn: async (formation: string) => {
      const res = await fetch("/api/swarm/formation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formation }),
      });
      if (!res.ok) throw new Error("Failed to set formation");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] }),
  });

  const trackMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/swarm/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id }),
      });
      if (!res.ok) throw new Error("Failed to initiate pursuit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/nxi"] });
      setTargetId("");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (name: string) => {
      droneCounter.current += 1;
      const id = `drone-${Date.now()}-${droneCounter.current}`;
      const res = await fetch("/api/swarm/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      if (!res.ok) throw new Error("Failed to register drone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/swarm/state"] });
      setRegisterName("");
    },
  });

  const drones = swarmData?.drones || [];
  const formation = swarmData?.formation || "none";

  return (
    <div className="h-full overflow-y-auto bg-black p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-700 rounded-xl flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              Swarm Intelligence
            </h1>
            <p className="text-[rgba(235,235,245,0.5)] mt-1">
              Drone fleet management · Formation · Pursuit · NXI world model
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-[#2c2c2e] hover:bg-[#3c3c3e] rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <Plane className="w-4 h-4 text-cyan-400" />
              </div>
              <span className="text-[rgba(235,235,245,0.5)] text-sm">Fleet</span>
            </div>
            <p className="text-3xl font-bold">{swarmData?.totalDrones ?? "—"}</p>
          </div>

          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-[rgba(235,235,245,0.5)] text-sm">Active</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{swarmData?.activeDrones ?? "—"}</p>
          </div>

          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-orange-400" />
              </div>
              <span className="text-[rgba(235,235,245,0.5)] text-sm">Pursuits</span>
            </div>
            <p className="text-3xl font-bold text-orange-400">{swarmData?.activePursuits.length ?? "—"}</p>
          </div>

          <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-[rgba(235,235,245,0.5)] text-sm">NXI Events</span>
            </div>
            <p className="text-3xl font-bold text-purple-400">{nxiData?.totalEvents ?? "—"}</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Drone Fleet */}
          <div className="lg:col-span-2 bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plane className="w-5 h-5 text-cyan-400" />
                Drone Fleet
              </h2>
              {/* Register drone */}
              <div className="flex gap-2">
                <input
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="Drone name…"
                  className="px-3 py-1.5 text-sm bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => registerName.trim() && registerMutation.mutate(registerName.trim())}
                  disabled={!registerName.trim() || registerMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/30 text-cyan-300 rounded-lg text-sm disabled:opacity-40 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              </div>
            ) : drones.length === 0 ? (
              <p className="text-center text-[rgba(235,235,245,0.4)] py-8">No drones registered</p>
            ) : (
              <div className="space-y-3">
                {drones.map((drone) => (
                  <div
                    key={drone.id}
                    className="bg-[#2c2c2e] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-700 to-blue-800 rounded-xl flex items-center justify-center">
                        <Plane className="w-5 h-5 text-cyan-200" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{drone.name}</p>
                        <p className="text-xs text-[rgba(235,235,245,0.4)]">{drone.id}</p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium ${statusBadge(drone.status)}`}>
                      {statusIcon(drone.status)}
                      <span className="capitalize">{drone.status}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 sm:w-64">
                      <div className="bg-[#1c1c1e] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase">Battery</p>
                        <p className={`text-sm font-bold ${drone.battery > 30 ? "text-emerald-400" : "text-red-400"}`}>
                          {drone.battery.toFixed(0)}%
                        </p>
                      </div>
                      <div className="bg-[#1c1c1e] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase">Alt</p>
                        <p className="text-sm font-bold">{drone.altitude.toFixed(0)}m</p>
                      </div>
                      <div className="bg-[#1c1c1e] rounded-lg p-2 text-center">
                        <p className="text-[10px] text-[rgba(235,235,245,0.4)] uppercase">Speed</p>
                        <p className="text-sm font-bold">{drone.speed.toFixed(1)}m/s</p>
                      </div>
                    </div>

                    {drone.task && (
                      <p className="text-xs text-cyan-300/70 italic">{drone.task}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-5">

            {/* Formation */}
            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                <Layers className="w-5 h-5 text-purple-400" />
                Formation
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {FORMATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => formationMutation.mutate(opt.value)}
                    disabled={formationMutation.isPending}
                    className={`py-2 rounded-lg text-sm font-medium transition-all ${
                      formation === opt.value
                        ? "bg-purple-600/40 border border-purple-500/60 text-purple-200"
                        : "bg-[#2c2c2e] border border-transparent hover:border-purple-500/30 text-[rgba(235,235,245,0.7)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[rgba(235,235,245,0.4)]">
                Active: <span className="text-purple-300 capitalize">{formation}</span>
              </p>
            </div>

            {/* Pursuit */}
            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-orange-400" />
                Pursuit / Track
              </h2>
              <div className="flex gap-2">
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Target ID…"
                  className="flex-1 px-3 py-2 text-sm bg-[#2c2c2e] border border-[rgba(84,84,88,0.65)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                />
                <button
                  onClick={() => targetId.trim() && trackMutation.mutate(targetId.trim())}
                  disabled={!targetId.trim() || trackMutation.isPending}
                  className="px-3 py-2 bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500/30 text-orange-300 rounded-lg text-sm disabled:opacity-40 transition-colors"
                >
                  Track
                </button>
              </div>
              {swarmData?.activePursuits && swarmData.activePursuits.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs text-[rgba(235,235,245,0.4)] mb-1">Active pursuits:</p>
                  {swarmData.activePursuits.map((t) => (
                    <div key={t} className="flex items-center gap-2 text-xs text-orange-300">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Orchestrator */}
            <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-cyan-400" />
                Orchestrator Status
              </h2>
              {orchestratorData ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[rgba(235,235,245,0.5)]">Health</span>
                    <span className="font-semibold text-emerald-400">
                      {orchestratorData.overallHealth ?? orchestratorData.health ?? "—"}%
                    </span>
                  </div>
                  {orchestratorData.operational !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[rgba(235,235,245,0.5)]">Operational</span>
                      <span className="font-semibold">{orchestratorData.operational}</span>
                    </div>
                  )}
                  {orchestratorData.degraded !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[rgba(235,235,245,0.5)]">Degraded</span>
                      <span className="font-semibold text-amber-400">{orchestratorData.degraded}</span>
                    </div>
                  )}
                  {orchestratorData.offline !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[rgba(235,235,245,0.5)]">Offline</span>
                      <span className="font-semibold text-red-400">{orchestratorData.offline}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[rgba(235,235,245,0.4)] text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Orchestrator data unavailable
                </div>
              )}
            </div>
          </div>
        </div>

        {/* NXI Event Feed */}
        <div className="bg-[#1c1c1e] border border-[rgba(84,84,88,0.65)] rounded-xl p-5">
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
            <Navigation className="w-5 h-5 text-purple-400" />
            NXI World Model — Event Feed
          </h2>
          {!nxiData || nxiData.events.length === 0 ? (
            <p className="text-[rgba(235,235,245,0.4)] text-sm">No events yet. Initiate a pursuit or set a formation to generate NXI events.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {nxiData.events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 bg-[#2c2c2e] rounded-lg">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-purple-300 capitalize">{ev.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[rgba(235,235,245,0.4)] truncate">
                      {JSON.stringify(ev.data)}
                    </p>
                  </div>
                  <p className="text-[10px] text-[rgba(235,235,245,0.3)] shrink-0">
                    {new Date(ev.ts).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
