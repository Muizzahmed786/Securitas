import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Activity,
  Cpu,
  Share2,
  RefreshCw,
  AlertCircle,
  Sliders,
} from "lucide-react";
import { risk, type RiskEvent } from "../../api/risk";
import { audit, type AuditEvent } from "../../api/audit";
import { errorMessage } from "../../api/http";

import RiskTimelineChart from "./RiskTimelineChart";
import RiskFactorRadarChart from "./RiskFactorRadarChart";
import AccessDecisionsChart from "./AccessDecisionsChart";
import SecurityActivityChart from "./SecurityActivityChart";
import CryptoPerformanceChart from "./CryptoPerformanceChart";
import SharingStatusChart from "./SharingStatusChart";

type SecurityTab = "risk" | "activity" | "crypto" | "sharing";

export default function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<SecurityTab>("risk");

  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [riskPolicy, setRiskPolicy] = useState<Record<string, unknown> | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      risk.events().catch(() => [] as RiskEvent[]),
      risk.policy().catch(() => null),
      audit.events({ limit: 100 }).catch(() => [] as AuditEvent[]),
    ])
      .then(([rEvents, policy, aEvents]) => {
        if (!active) return;
        setRiskEvents(rEvents);
        setRiskPolicy(policy);
        setAuditEvents(aEvents);
        if (rEvents.length > 0) {
          setSelectedEvent(rEvents[0]);
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Derived telemetry metrics
  const avgScore =
    riskEvents.length > 0
      ? (
          riskEvents.reduce((acc, ev) => acc + (Number(ev.risk_score) || 0), 0) /
          riskEvents.length
        ).toFixed(1)
      : "0.0";

  const stepUpCount = riskEvents.filter(
    (ev) => ev.decision === "STEP_UP_AUTH",
  ).length;

  const totalAudits = auditEvents.length;

  return (
    <div className="space-y-6">
      {/* Telemetry Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Security Analytics & Behavioral Intelligence
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Real-time telemetry, continuous risk engine evaluation, cryptographic benchmarks, and audit verification.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="btn-secondary self-start sm:self-center flex items-center gap-2 text-xs"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin text-amber-400" : ""}`}
          />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Ribbons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-4 shadow-xl">
          <span className="text-[11px] text-neutral-400 font-medium">
            Evaluated Attempts
          </span>
          <p className="mt-1 font-mono text-xl font-bold text-white">
            {riskEvents.length}
          </p>
          <span className="text-[10px] text-emerald-400">Continuous scoring</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-4 shadow-xl">
          <span className="text-[11px] text-neutral-400 font-medium">
            Avg Recorded Risk
          </span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-400">
            {avgScore}
            <span className="text-xs text-neutral-500 font-normal"> / 100</span>
          </p>
          <span className="text-[10px] text-neutral-400">Baseline composite</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-4 shadow-xl">
          <span className="text-[11px] text-neutral-400 font-medium">
            Step-Up Challenges
          </span>
          <p className="mt-1 font-mono text-xl font-bold text-amber-400">
            {stepUpCount}
          </p>
          <span className="text-[10px] text-amber-400/80">Adaptive triggers</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-4 shadow-xl">
          <span className="text-[11px] text-neutral-400 font-medium">
            Audit Ledger Invariants
          </span>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {totalAudits}
          </p>
          <span className="text-[10px] text-neutral-400">Append-only records</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 overflow-x-auto no-scrollbar gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("risk")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "risk"
              ? "border-amber-400 text-white"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Risk Scores & Factors (Graphs 1-3)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "activity"
              ? "border-amber-400 text-white"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Security Activity Timeline (Graph 4)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("crypto")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "crypto"
              ? "border-amber-400 text-white"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" />
          <span>Encryption Performance (Graph 5)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sharing")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === "sharing"
              ? "border-amber-400 text-white"
              : "border-transparent text-neutral-400 hover:text-white"
          }`}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Document Sharing Status (Graph 6)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "risk" && (
          <>
            {/* Graph 1: Risk Score Over Time */}
            <RiskTimelineChart
              events={riskEvents}
              policy={riskPolicy}
              selectedEventId={selectedEvent?.id}
              onSelectEvent={(ev) => setSelectedEvent(ev)}
            />

            {/* Graphs 2 & 3: Factor Breakdown & Access Decisions */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RiskFactorRadarChart
                  event={selectedEvent}
                  eventsList={riskEvents}
                  onSelectEvent={(ev) => setSelectedEvent(ev)}
                />
              </div>
              <div className="lg:col-span-1">
                <AccessDecisionsChart events={riskEvents} />
              </div>
            </div>
          </>
        )}

        {activeTab === "activity" && (
          <SecurityActivityChart events={auditEvents} />
        )}

        {activeTab === "crypto" && <CryptoPerformanceChart />}

        {activeTab === "sharing" && <SharingStatusChart />}
      </div>
    </div>
  );
}
