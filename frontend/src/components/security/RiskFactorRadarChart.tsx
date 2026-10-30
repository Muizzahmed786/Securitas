import { useMemo } from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from "recharts";
import { Sliders, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { RiskEvent } from "../../api/risk";

type RiskFactorRadarChartProps = {
  event: RiskEvent | null;
  eventsList?: RiskEvent[];
  onSelectEvent?: (event: RiskEvent) => void;
};

const FACTOR_METADATA: Record<string, { label: string; defaultWeight: number }> = {
  download_anomaly: { label: "Download Anomaly", defaultWeight: 0.25 },
  access_frequency_anomaly: { label: "Access Velocity", defaultWeight: 0.20 },
  time_anomaly: { label: "Time/Hours Anomaly", defaultWeight: 0.15 },
  document_sensitivity: { label: "Doc Sensitivity", defaultWeight: 0.15 },
  sharing_anomaly: { label: "Sharing Volume", defaultWeight: 0.15 },
  authentication_anomaly: { label: "Auth Failures", defaultWeight: 0.10 },
};

export default function RiskFactorRadarChart({
  event,
  eventsList = [],
  onSelectEvent,
}: RiskFactorRadarChartProps) {
  const factorsData = useMemo(() => {
    if (!event || !event.factors) return [];

    const rawFactors = event.factors as Record<
      string,
      {
        score?: number;
        weight?: number;
        weighted_score?: number;
        explanation?: string;
      }
    >;

    return Object.entries(FACTOR_METADATA).map(([key, meta]) => {
      const recorded = rawFactors[key] || {};
      const score = Number(recorded.score ?? 0);
      const weight = Number(recorded.weight ?? meta.defaultWeight);
      const weighted_score = Number(
        recorded.weighted_score ?? Math.round(score * weight * 100) / 100,
      );
      const explanation =
        recorded.explanation || "No anomaly detected within normal baseline.";

      return {
        key,
        subject: meta.label,
        score,
        weight: Math.round(weight * 100),
        weighted_score,
        explanation,
      };
    });
  }, [event]);

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121218] p-8 text-center shadow-xl">
        <Sliders className="h-8 w-8 text-neutral-500 mb-2" />
        <h3 className="text-sm font-semibold text-white">No Attempt Selected</h3>
        <p className="mt-1 text-xs text-neutral-400 max-w-sm">
          Select an access attempt from the timeline or history to inspect its six behavioral factor contributions.
        </p>
      </div>
    );
  }

  const decisionBadge = (decision: string) => {
    switch (decision) {
      case "ALLOW":
        return {
          icon: CheckCircle2,
          color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
          text: "Permitted (ALLOW)",
        };
      case "STEP_UP_AUTH":
        return {
          icon: AlertTriangle,
          color: "border-amber-500/20 bg-amber-500/10 text-amber-400",
          text: "Step-Up Required (HIGH)",
        };
      case "BLOCK":
        return {
          icon: XCircle,
          color: "border-red-500/20 bg-red-500/10 text-red-400",
          text: "Access Blocked (CRITICAL)",
        };
      default:
        return {
          icon: ShieldCheck,
          color: "border-white/10 bg-white/5 text-neutral-300",
          text: decision,
        };
    }
  };

  const badge = decisionBadge(event.decision);
  const BadgeIcon = badge.icon;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-6">
      {/* Header & Attempt Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Six Risk Factors Breakdown
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${badge.color}`}
            >
              <BadgeIcon className="h-3 w-3" />
              {badge.text}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Weighted contribution of each behavioral vector evaluated for request{" "}
            <span className="font-mono text-neutral-300">
              {event.id.slice(0, 8)}...
            </span>
          </p>
        </div>

        {eventsList.length > 0 && onSelectEvent && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-neutral-400">Select Attempt:</label>
            <select
              className="rounded-lg border border-white/10 bg-[#0c0c10] px-2.5 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
              value={event.id}
              onChange={(e) => {
                const found = eventsList.find((ev) => ev.id === e.target.value);
                if (found) onSelectEvent(found);
              }}
            >
              {eventsList.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-[#0c0c10] text-white">
                  Score {ev.risk_score} · {ev.action} (
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  )
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary Score Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-white/5 bg-[#0c0c10] p-4 text-xs">
        <div>
          <span className="text-[11px] text-neutral-400">Final Risk Score</span>
          <p className="mt-1 font-mono text-lg font-bold text-amber-400">
            {event.risk_score}
            <span className="text-xs text-neutral-500 font-normal"> / 100</span>
          </p>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400">Risk Severity</span>
          <p className="mt-1 font-mono text-sm font-semibold text-white">
            {event.risk_level}
          </p>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400">Target Action</span>
          <p className="mt-1 font-mono text-xs text-neutral-300 truncate">
            {event.action}
          </p>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400">Evaluated At</span>
          <p className="mt-1 font-mono text-xs text-neutral-300">
            {new Date(event.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Visual Chart & Linear Contribution Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2 items-center">
        {/* Radar Diagram */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={factorsData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="subject"
                stroke="#a3a3a3"
                fontSize={10}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                stroke="rgba(255,255,255,0.15)"
                fontSize={9}
              />
              <Radar
                name="Raw Factor Score"
                dataKey="score"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.25}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-3 text-xs shadow-2xl space-y-1">
                      <p className="font-semibold text-white">{d.subject}</p>
                      <p className="text-amber-400 text-xs">
                        Raw Score: {d.score}/100 (Weight: {d.weight}%)
                      </p>
                      <p className="text-emerald-400 text-xs font-mono">
                        Contribution: +{d.weighted_score} pts
                      </p>
                      <p className="text-neutral-400 text-[11px] max-w-xs pt-1">
                        {d.explanation}
                      </p>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Factor Contributions List */}
        <div className="space-y-3">
          <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">
            Calculated Linear Contributions
          </span>
          <div className="space-y-2">
            {factorsData.map((f) => (
              <div
                key={f.key}
                className="rounded-xl border border-white/5 bg-[#0c0c10] p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{f.subject}</span>
                    <span className="rounded bg-white/5 px-1.5 py-0.2 text-[10px] font-mono text-neutral-400">
                      {f.weight}% Weight
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-neutral-400 text-[11px]">
                      Raw: {f.score}
                    </span>
                    <span className="text-amber-400 font-semibold">
                      +{f.weighted_score.toFixed(2)} pts
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                    style={{ width: `${Math.min(100, f.score)}%` }}
                  />
                </div>

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {f.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-neutral-400">
        <strong className="text-neutral-300">Engine Invariant:</strong> The final risk score is calculated directly as the linear sum of all six weighted scores (
        <span className="font-mono text-amber-400">
          &sum; (raw_score &times; weight)
        </span>
        ) bounded to [0, 100].
      </div>
    </div>
  );
}

