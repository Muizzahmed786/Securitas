import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { RiskEvent } from "../../api/risk";

type AccessDecisionsChartProps = {
  events: RiskEvent[];
};

const DECISION_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  ALLOW: {
    label: "Allowed (Normal)",
    color: "#10b981",
    icon: CheckCircle2,
  },
  STEP_UP_AUTH: {
    label: "Step-Up Auth Required",
    color: "#f59e0b",
    icon: AlertTriangle,
  },
  BLOCK: {
    label: "Blocked Access",
    color: "#ef4444",
    icon: XCircle,
  },
  RESTRICT: {
    label: "Policy Restricted",
    color: "#8b5cf6",
    icon: ShieldCheck,
  },
};

export default function AccessDecisionsChart({
  events,
}: AccessDecisionsChartProps) {
  const { data, total } = useMemo(() => {
    const counts: Record<string, number> = {
      ALLOW: 0,
      STEP_UP_AUTH: 0,
      BLOCK: 0,
      RESTRICT: 0,
    };

    for (const ev of events) {
      const dec = (ev.decision || "ALLOW").toUpperCase();
      if (counts[dec] !== undefined) {
        counts[dec]++;
      } else {
        counts[dec] = (counts[dec] || 0) + 1;
      }
    }

    const totalCount = events.length;

    const chartItems = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => {
        const config = DECISION_CONFIG[key] || {
          label: key,
          color: "#a3a3a3",
          icon: ShieldCheck,
        };
        const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
        return {
          name: config.label,
          key,
          value: count,
          percentage,
          color: config.color,
        };
      });

    return { data: chartItems, total: totalCount };
  }, [events]);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#121218] p-8 text-center shadow-xl">
        <ShieldCheck className="h-8 w-8 text-neutral-500 mb-2" />
        <h3 className="text-sm font-semibold text-white">No Access Decisions</h3>
        <p className="mt-1 text-xs text-neutral-400 max-w-sm">
          Decision distribution will populate as users request and access encrypted documents.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Recorded Access Decisions
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Outcomes derived strictly from recorded access attempts ({total} total).
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 items-center">
        {/* Donut Chart */}
        <div className="relative h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} stroke="#121218" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-2.5 text-xs shadow-xl space-y-1">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="font-mono text-neutral-300">
                        {item.value} attempts ({item.percentage}%)
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Centered count */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-mono text-2xl font-bold text-white">{total}</span>
            <span className="text-[10px] uppercase tracking-wider text-neutral-400">
              Decisions
            </span>
          </div>
        </div>

        {/* Legend with percentages */}
        <div className="space-y-2.5">
          {data.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-[#0c0c10] px-3.5 py-2 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-neutral-200">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <span className="text-white font-semibold">{item.value}</span>
                <span className="text-neutral-500 text-[11px]">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
