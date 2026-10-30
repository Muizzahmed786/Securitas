import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  audit,
  type AuditEvent,
  type AuditFilters,
  type AuditStats,
} from "../../api/audit";
import { risk, type RiskEvent } from "../../api/risk";
import { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";
import SecurityActivityChart from "../security/SecurityActivityChart";

const PAGE_SIZE = 50;

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
}

function statusColor(status: string) {
  switch (status) {
    case "SUCCESS":
    case "ALLOW":
      return "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "CHALLENGED":
    case "STEP_UP_AUTH":
      return "border border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "FAILURE":
    case "DENIED":
    case "BLOCK":
      return "border border-red-500/30 bg-red-500/10 text-red-400";
    default:
      return "border border-white/10 bg-white/5 text-neutral-400";
  }
}

export default function Audit() {
  const { can } = useAuth();
  const canReadRisk = can("risk.read");

  const [stats, setStats] = useState<AuditStats | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);

  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [filters, setFilters] = useState<AuditFilters>({});
  const [offset, setOffset] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(false);
  const [error, setError] = useState("");
  const [riskError, setRiskError] = useState("");

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    Promise.all([
      audit.stats(),
      audit.events({ ...filters, limit: PAGE_SIZE, offset }),
    ])
      .then(([nextStats, nextEvents]) => {
        if (!active) return;
        setStats(nextStats);
        setEvents(nextEvents);
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
  }, [filters, offset, refreshCount]);

  useEffect(() => {
    if (!canReadRisk) return;

    let active = true;
    setRiskLoading(true);
    setRiskError("");

    risk.events()
      .then((items) => {
        if (active) setRiskEvents(items);
      })
      .catch((err) => {
        if (active) setRiskError(errorMessage(err));
      })
      .finally(() => {
        if (active) setRiskLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canReadRisk, refreshCount]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedUserId = userId.trim() ? Number(userId) : undefined;

    if (
      parsedUserId !== undefined &&
      (!Number.isInteger(parsedUserId) || parsedUserId <= 0)
    ) {
      setError("User ID must be a positive whole number.");
      return;
    }

    setOffset(0);
    setFilters({
      action: action.trim() || undefined,
      status: status || undefined,
      user_id: parsedUserId,
    });
    setRefreshCount((count) => count + 1);
  }

  function clearFilters() {
    setAction("");
    setStatus("");
    setUserId("");
    setOffset(0);
    setFilters({});
    setRefreshCount((count) => count + 1);
  }

  const successCount = stats?.status_breakdown.SUCCESS ?? 0;
  const challengedCount = stats?.status_breakdown.CHALLENGED ?? 0;
  const deniedCount = stats?.status_breakdown.DENIED ?? 0;
  const failureCount = stats?.status_breakdown.FAILURE ?? 0;

  const cards = [
    {
      label: "Total Audit Events",
      value: stats?.total_audit_events ?? 0,
      icon: Activity,
      color: "text-amber-400",
    },
    {
      label: "Successful Operations",
      value: successCount,
      icon: CheckCircle2,
      color: "text-emerald-400",
    },
    {
      label: "Challenged / Step-Up",
      value: challengedCount + deniedCount,
      icon: ShieldCheck,
      color: "text-amber-400",
    },
    {
      label: "Cryptographic Failures",
      value: failureCount,
      icon: AlertTriangle,
      color: "text-red-400",
    },
  ];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
            Immutable Oversight
          </p>
          <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
            Audit Ledger
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Append-only security events with automated secret and key sanitization.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || riskLoading}
          onClick={() => setRefreshCount((count) => count + 1)}
          className="btn-secondary text-xs flex items-center gap-2"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <p role="alert">{error}</p>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#121218] p-5 shadow-xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              <Icon size={18} className={color} />
            </span>
            <p className="mt-3 text-xs text-neutral-400">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Stats Breakdown */}
      {stats && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Risk Decision Distribution
            </h2>
            <div className="mt-4 space-y-2.5 text-xs">
              {Object.entries(stats.risk_distribution).length === 0 ? (
                <p className="text-neutral-500">No risk events recorded in baseline.</p>
              ) : (
                Object.entries(stats.risk_distribution).map(([level, count]) => (
                  <div key={level} className="flex justify-between border-b border-white/[0.05] pb-2">
                    <span className="text-neutral-300">{level}</span>
                    <strong className="font-mono text-white">{count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Tamper & Activity Diagnostics
            </h2>
            <div className="mt-4 flex justify-between border-b border-white/[0.05] pb-2 text-xs">
              <span className="text-neutral-300">Integrity Signature Failures</span>
              <strong className="font-mono text-amber-400">{stats.integrity_failures}</strong>
            </div>
            <h3 className="mt-4 text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Top Audited Operations
            </h3>
            <div className="mt-2 space-y-2 text-xs">
              {Object.entries(stats.action_breakdown).map(([name, count]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setAction(name);
                    setOffset(0);
                    setFilters((f) => ({ ...f, action: name }));
                    setRefreshCount((c) => c + 1);
                  }}
                  className="flex w-full justify-between gap-3 border-b border-white/[0.04] pb-1.5 text-left transition hover:text-amber-400 group"
                  title={`Filter ledger by ${name}`}
                >
                  <span className="font-mono text-neutral-300 group-hover:text-amber-400 underline decoration-dotted underline-offset-2">
                    {name}
                  </span>
                  <strong className="font-mono text-white">{count}</strong>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Security Activity Timeline Chart */}
      <SecurityActivityChart events={events} />

      {/* Audit Events Table Section */}
      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Security Event Ledger
          </h2>
          <span className="text-xs text-neutral-400 font-mono">
            {events.length} Loaded
          </span>
        </div>

        {/* Filters Form */}
        <form
          onSubmit={applyFilters}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl border border-white/[0.08] bg-black/40 p-4"
        >
          <div className="space-y-1">
            <label className="field-label">Action Filter</label>
            <input
              className="input-style text-xs"
              placeholder="e.g. documents.download"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="field-label">Outcome Status</label>
            <select
              className="input-style text-xs cursor-pointer"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="CHALLENGED">Challenged (Step-Up)</option>
              <option value="DENIED">Denied</option>
              <option value="FAILURE">Cryptographic Failure</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="field-label">User ID</label>
            <input
              className="input-style text-xs"
              type="number"
              min="1"
              placeholder="Numeric ID"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary text-xs flex-1 justify-center">
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary text-xs"
            >
              Clear
            </button>
          </div>
        </form>

        {loading ? (
          <p className="py-8 text-center text-xs text-neutral-400">Loading audit records…</p>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-xs text-neutral-500">
            No audit records match the applied criteria.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>User Identity</th>
                  <th>Document ID</th>
                  <th>Sanitized Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap font-mono text-xs text-neutral-400">
                      {formatDate(event.timestamp)}
                    </td>
                    <td className="font-mono text-xs font-semibold text-white">
                      {event.action}
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${statusColor(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="text-xs text-neutral-300">
                      {event.user_email ?? event.user_id ?? "—"}
                    </td>
                    <td className="max-w-36 truncate font-mono text-[10px] text-amber-400/80">
                      {event.document_id ?? "—"}
                    </td>
                    <td>
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-amber-400 hover:text-amber-300">
                          Inspect
                        </summary>
                        <pre className="mt-2 max-w-xs whitespace-pre-wrap break-all rounded-lg border border-white/10 bg-black/60 p-2 font-mono text-[10px] text-neutral-300 no-scrollbar">
                          {JSON.stringify(event.metadata ?? {}, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>
            Events {events.length === 0 ? 0 : offset + 1}–
            {offset + events.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || events.length < PAGE_SIZE}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {/* Risk Engine Telemetry */}
      {canReadRisk && (
        <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Adaptive Risk Decisions Telemetry
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              Evaluated in real-time across IP velocity, time anomalies, and data classification.
            </p>
          </div>

          {riskError && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <p role="alert">{riskError}</p>
            </div>
          )}

          {riskLoading ? (
            <p className="py-4 text-xs text-neutral-400">Loading risk events…</p>
          ) : riskEvents.length === 0 ? (
            <p className="py-4 text-xs text-neutral-500">No recent risk events recorded.</p>
          ) : (
            <div className="space-y-3">
              {riskEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-xl border border-white/[0.08] bg-black/40 p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-white">{event.action}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${statusColor(event.decision)}`}
                    >
                      {event.decision}
                    </span>
                  </div>

                  <p className="text-neutral-400">
                    Risk Level: <strong className="text-amber-400">{event.risk_level}</strong> (Score: {event.risk_score}) · User ID: {event.user_id} · {formatDate(event.timestamp)}
                  </p>
                  <p className="text-neutral-300">{event.reason}</p>

                  <details className="pt-1">
                    <summary className="cursor-pointer text-amber-400 hover:text-amber-300">
                      Inspect 6 Behavioral Factors
                    </summary>
                    <pre className="mt-2 rounded-lg border border-white/10 bg-black/60 p-3 font-mono text-[10px] text-neutral-300 whitespace-pre-wrap break-all no-scrollbar">
                      {JSON.stringify(event.factors, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
