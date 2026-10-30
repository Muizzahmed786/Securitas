import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Activity, ArrowUpRight, Clock } from "lucide-react";
import type { AuditEvent } from "../../api/audit";

type SecurityActivityChartProps = {
  events: AuditEvent[];
};

export default function SecurityActivityChart({
  events,
}: SecurityActivityChartProps) {
  const [groupBy, setGroupBy] = useState<"hour" | "day">("hour");

  // Group events into chronological intervals
  const chartData = useMemo(() => {
    if (!events.length) return [];

    const buckets: Record<
      string,
      {
        label: string;
        timestamp: number;
        success: number;
        challenged: number;
        failure: number;
        total: number;
      }
    > = {};

    for (const ev of events) {
      if (!ev.timestamp) continue;
      const date = new Date(ev.timestamp);
      if (isNaN(date.getTime())) continue;

      let key: string;
      let label: string;

      if (groupBy === "hour") {
        // Group by YYYY-MM-DD HH:00
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const h = String(date.getHours()).padStart(2, "0");
        key = `${y}-${m}-${d} ${h}:00`;
        label = `${h}:00`;
      } else {
        // Group by YYYY-MM-DD
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        key = `${y}-${m}-${d}`;
        label = `${m}/${d}`;
      }

      if (!buckets[key]) {
        buckets[key] = {
          label,
          timestamp: date.getTime(),
          success: 0,
          challenged: 0,
          failure: 0,
          total: 0,
        };
      }

      const status = (ev.status || "").toUpperCase();
      if (status === "SUCCESS") {
        buckets[key].success++;
      } else if (status === "CHALLENGED") {
        buckets[key].challenged++;
      } else {
        // FAILURE or DENIED
        buckets[key].failure++;
      }
      buckets[key].total++;
    }

    return Object.values(buckets).sort((a, b) => a.timestamp - b.timestamp);
  }, [events, groupBy]);

  const totalEvents = events.length;
  const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (totalEvents === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121218] p-8 text-center shadow-xl">
        <Activity className="h-8 w-8 text-neutral-500 mb-2" />
        <h3 className="text-sm font-semibold text-white">No Audit Events Logged</h3>
        <p className="mt-1 text-xs text-neutral-400 max-w-sm">
          Security actions across the authentication, document vault, and authorization layers will appear on this activity timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4">
      {/* Header with Grouping Toggle & Link */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Security Activity Over Time
            </h2>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
              {totalEvents} Recorded Events
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3 w-3 text-neutral-500" />
            <span>Timezone: {timeZoneName} (Stored as UTC in database)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-white/10 bg-[#0c0c10] p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                groupBy === "hour"
                  ? "bg-white text-neutral-900"
                  : "text-neutral-400 hover:text-white"
              }`}
              onClick={() => setGroupBy("hour")}
            >
              By Hour
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                groupBy === "day"
                  ? "bg-white text-neutral-900"
                  : "text-neutral-400 hover:text-white"
              }`}
              onClick={() => setGroupBy("day")}
            >
              By Day
            </button>
          </div>

          <Link
            to="/workspace/advisor/audit"
            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>Ledger</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              stroke="#737373"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-3 text-xs shadow-2xl space-y-1.5">
                    <p className="font-semibold text-white">Period: {d.label}</p>
                    <div className="space-y-1 font-mono text-[11px]">
                      <p className="text-emerald-400">
                        &bull; Successful: {d.success}
                      </p>
                      <p className="text-amber-400">
                        &bull; Step-Up Challenged: {d.challenged}
                      </p>
                      <p className="text-red-400">
                        &bull; Denied / Failed: {d.failure}
                      </p>
                    </div>
                    <p className="border-t border-white/5 pt-1 text-neutral-400 text-[10px]">
                      Total Actions: {d.total}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingBottom: 10 }}
            />
            <Bar
              dataKey="success"
              name="Success"
              stackId="a"
              fill="#10b981"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="challenged"
              name="Challenged (Step-Up)"
              stackId="a"
              fill="#f59e0b"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failure"
              name="Denied / Failed"
              stackId="a"
              fill="#ef4444"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

