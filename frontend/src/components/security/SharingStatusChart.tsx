import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";
import { Share2, Clock, Ban, CheckCircle2, ArrowRight } from "lucide-react";
import { sharing, type SharesSummary } from "../../api/sharing";
import { errorMessage } from "../../api/http";

export default function SharingStatusChart() {
  const [summary, setSummary] = useState<SharesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    sharing
      .summary()
      .then((data) => {
        if (active) setSummary(data);
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
  }, []);

  if (loading) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-white/10 bg-[#121218] p-6 text-xs text-neutral-400">
        Loading document sharing statistics…
      </div>
    );
  }

  if (error || !summary) {
    return null;
  }

  const { active_shares, expired_shares, revoked_shares, total_shares } = summary;

  const data = [
    {
      name: "Active Grants",
      key: "active",
      value: active_shares,
      color: "#10b981",
      icon: CheckCircle2,
      description: "Unrevoked grants within valid expiration window",
    },
    {
      name: "Expired Grants",
      key: "expired",
      value: expired_shares,
      color: "#f59e0b",
      icon: Clock,
      description: "Passed time-bounded expiration timestamp",
    },
    {
      name: "Revoked Grants",
      key: "revoked",
      value: revoked_shares,
      color: "#ef4444",
      icon: Ban,
      description: "Explicitly revoked by document owner",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              Document Sharing Status Breakdown
            </h2>
            <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
              {summary.scope === "SYSTEM_WIDE" ? "System Enclave" : "Your Documents"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-400">
            Categorized by verified database state: Active, Expired, and Owner-Revoked grants.
          </p>
        </div>

        <Link
          to="/workspace/sharing"
          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          <span>Manage Shares</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {total_shares === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Share2 className="h-8 w-8 text-neutral-500 mb-2" />
          <h3 className="text-sm font-semibold text-white">No Document Shares Created</h3>
          <p className="mt-1 text-xs text-neutral-400 max-w-sm">
            When you share documents with team members, their active, expired, and revoked states will appear here.
          </p>
        </div>
      ) : (
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
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      stroke="#121218"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload;
                    const pct = Math.round((item.value / total_shares) * 100);
                    return (
                      <div className="rounded-xl border border-white/10 bg-[#0c0c10] p-2.5 text-xs shadow-xl space-y-1">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="font-mono text-neutral-300">
                          {item.value} shares ({pct}%)
                        </p>
                        <p className="text-[10px] text-neutral-500">
                          {item.description}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered count */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-mono text-2xl font-bold text-white">
                {total_shares}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                Shares
              </span>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <div>
                  <span className="font-medium text-white">Active Grants</span>
                  <p className="text-[10px] text-neutral-400">Valid access window</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-emerald-400">
                {active_shares}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <div>
                  <span className="font-medium text-white">Expired Grants</span>
                  <p className="text-[10px] text-neutral-400">Time window elapsed</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-amber-400">
                {expired_shares}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-400" />
                <div>
                  <span className="font-medium text-white">Revoked Grants</span>
                  <p className="text-[10px] text-neutral-400">Explicitly withdrawn</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-red-400">
                {revoked_shares}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

