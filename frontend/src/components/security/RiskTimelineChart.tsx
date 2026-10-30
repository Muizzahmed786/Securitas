import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { ShieldAlert, Info } from "lucide-react";
import type { RiskEvent } from "../../api/risk";

type RiskTimelineChartProps = {
  events: RiskEvent[];
  policy: Record<string, unknown> | null;
  selectedEventId?: string | null;
  onSelectEvent?: (event: RiskEvent) => void;
};

export default function RiskTimelineChart({
  events,
  policy,
  selectedEventId,
  onSelectEvent,
}: RiskTimelineChartProps) {
  const lowMax = Number(policy?.low_max ?? 30);
  const mediumMax = Number(policy?.medium_max ?? 60);
  const highMax = Number(policy?.high_max ?? 80);

  // Sort chronologically ascending for the timeline
  const chartData = useMemo(() => {
    return [...events]
      .filter((e) => e.risk_score !== null && e.risk_score !== undefined)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      .map((e) => {
        const date = new Date(e.timestamp);
        const timeLabel = isNaN(date.getTime())
          ? "—"
          : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return {
          id: e.id,
          rawEvent: e,
          timeLabel,
          timestamp: e.timestamp,
          score: Number(e.risk_score),
          level: e.risk_level,
          decision: e.decision,
          action: e.action,
        };
      });
  }, [events]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121218] p-8 text-center shadow-xl">
        <ShieldAlert className="h-8 w-8 text-neutral-500 mb-2" />
        <h3 className="text-sm font-semibold text-white">No Scored Attempts Recorded</h3>
        <p className="mt-1 text-xs text-neutral-400 max-w-sm">
          Risk evaluations will appear on this timeline as access and download actions are evaluated by the behavioral engine.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Recorded Risk Scores Over Time
            </h2>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
              Live Telemetry
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Recorded access scores plotted against configured policy thresholds. Click a point to inspect factor breakdown.
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            Allow (&le;{lowMax})
          </span>
          <span className="inline-flex items-center gap-1 text-blue-400">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Monitor (&le;{mediumMax})
          </span>
          <span className="inline-flex items-center gap-1 text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Step-Up (&le;{highMax})
          </span>
          <span className="inline-flex items-center gap-1 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-500"></span>
            Block (&gt;{highMax})
          </span>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
            onClick={(state: any) => {
              const payload = state?.activePayload?.[0]?.payload?.rawEvent as RiskEvent | undefined;
              if (payload && onSelectEvent) {
                onSelectEvent(payload);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="timeLabel"
              stroke="#737373"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              ticks={[0, 30, 60, 80, 100]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const isSelected = selectedEventId === d.id;
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-3 text-xs shadow-2xl space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-white">
                        Risk Score: {d.score}/100
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                          d.decision === "ALLOW"
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : d.decision === "STEP_UP_AUTH"
                            ? "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                            : "border border-red-500/20 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {d.decision}
                      </span>
                    </div>
                    <p className="text-neutral-400 text-[11px]">
                      Action: <span className="font-mono text-neutral-200">{d.action}</span>
                    </p>
                    <p className="text-neutral-500 text-[10px]">
                      Time: {new Date(d.timestamp).toLocaleString()}
                    </p>
                    {isSelected && (
                      <p className="text-amber-400 text-[10px] font-semibold pt-1">
                        &bull; Currently Selected in Factor Inspector
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {/* Policy Threshold Lines */}
            <ReferenceLine
              y={lowMax}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <ReferenceLine
              y={mediumMax}
              stroke="#3b82f6"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />
            <ReferenceLine
              y={highMax}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeOpacity={0.6}
            />

            <Line
              type="monotone"
              dataKey="score"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const isSelected = selectedEventId === payload.id;
                let fill = "#10b981";
                if (payload.score > highMax) fill = "#ef4444";
                else if (payload.score > mediumMax) fill = "#f59e0b";
                else if (payload.score > lowMax) fill = "#3b82f6";

                return (
                  <circle
                    key={payload.id}
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : 4}
                    fill={fill}
                    stroke={isSelected ? "#ffffff" : "#121218"}
                    strokeWidth={isSelected ? 2 : 1}
                    className="cursor-pointer transition-all hover:scale-125"
                  />
                );
              }}
              activeDot={{ r: 7, stroke: "#ffffff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-500">
        <Info className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span>
          Horizontal reference lines mark policy thresholds. Values exceeding {highMax} require OTP step-up verification or block access.
        </span>
      </div>
    </div>
  );
}
