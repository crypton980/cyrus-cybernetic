import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, RefreshCw, Shield, User2 } from "lucide-react";

import { cyrusApi } from "../api/cyrusApi.js";
import { useCommandCenterStream } from "../hooks/useCommandCenterStream.js";
import { ApprovalPanel } from "./ApprovalPanel.js";
import { AuditPanel } from "./AuditPanel.js";
import { FusionPanel } from "./FusionPanel.js";
import IntelligenceFeed from "./IntelligenceFeed.js";
import { EmbodiedControl } from "./EmbodiedControl.js";
import { MetricsPanel } from "./MetricsPanel.js";
import { MissionControl } from "./MissionControl.js";
import { SystemStatus } from "./SystemStatus.js";

function operatorIdentity() {
  const name = localStorage.getItem("cyrus-display-name") || "OPERATOR";
  const role = localStorage.getItem("cyrus-user-role") || "user";
  return { name, role };
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const operator = useMemo(operatorIdentity, []);
  const isAdmin = operator.role === "admin";
  const streamState = useCommandCenterStream(true);
  const approvalsQuery = useQuery({ queryKey: ["pending-approvals"], queryFn: cyrusApi.getApprovals });
  const missionsQuery = useQuery({ queryKey: ["missions"], queryFn: cyrusApi.getMissions });
  const metricsQuery = useQuery({ queryKey: ["system-metrics"], queryFn: cyrusApi.getMetrics });

  const activeMissions = (missionsQuery.data || []).filter((mission) => mission.status === "running").length;

  return (
    <div className="relative min-h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.16),_transparent_30%),linear-gradient(180deg,#030712_0%,#02040a_48%,#02030a_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

      <div className="relative mx-auto max-w-[1680px] space-y-5">
        <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(7,12,23,0.9),rgba(12,18,33,0.7))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className="text-[11px] uppercase tracking-[0.4em] text-cyan-200/60">CYRUS Command Center</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Mission-grade control surface for live intelligence, approvals, and runtime state.</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
                This root interface is now wired to the actual CYRUS control plane. Every panel polls live backend state, shows operational context, and exposes operator actions where the platform supports them.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
              <div className="rounded-[1.5rem] border border-cyan-300/15 bg-cyan-300/5 p-4">
                <div className="flex items-center gap-2 text-cyan-100"><User2 className="h-4 w-4" />Operator</div>
                <p className="mt-3 text-xl font-semibold text-white">{operator.name}</p>
                <p className="mt-1 text-sm text-cyan-100/70">{isAdmin ? "Admin clearance" : "Operator clearance"}</p>
              </div>
              <div className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/5 p-4">
                <div className="flex items-center gap-2 text-emerald-100"><Radar className="h-4 w-4" />Active Missions</div>
                <p className="mt-3 text-xl font-semibold text-white">{activeMissions}</p>
                <p className="mt-1 text-sm text-emerald-100/70">Live directives tracked</p>
              </div>
              <div className="rounded-[1.5rem] border border-orange-300/15 bg-orange-300/5 p-4">
                <div className="flex items-center gap-2 text-orange-100"><Shield className="h-4 w-4" />Approvals</div>
                <p className="mt-3 text-xl font-semibold text-white">{approvalsQuery.data?.length || 0}</p>
                <p className="mt-1 text-sm text-orange-100/70">Awaiting review</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 transition hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 ${metricsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh all panels
            </button>
            <span className="rounded-full bg-white/5 px-3 py-2">Metrics samples: {metricsQuery.data?.summary.sampleCount || 0}</span>
            <span className={`rounded-full px-3 py-2 ${streamState.connected ? "bg-emerald-500/15 text-emerald-100" : "bg-amber-500/15 text-amber-100"}`}>
              Stream: {streamState.connected ? "connected" : "reconnecting"}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-2">
              Last sync: {streamState.lastEventAt ? new Date(streamState.lastEventAt).toLocaleTimeString() : "pending"}
            </span>
            {streamState.error && <span className="rounded-full bg-rose-500/15 px-3 py-2 text-rose-100">{streamState.error}</span>}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <IntelligenceFeed />
            <div className="grid gap-5 xl:grid-cols-2">
              <FusionPanel />
              <SystemStatus />
            </div>
          </div>

          <div className="space-y-5 xl:col-span-5">
            <MetricsPanel />
            <MissionControl operatorRole={operator.role} />
            <EmbodiedControl operatorRole={operator.role} />
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <ApprovalPanel operatorName={operator.name} isAdmin={isAdmin} />
          </div>
          <div className="xl:col-span-7">
            <AuditPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;