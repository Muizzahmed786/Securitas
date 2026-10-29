import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
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
      return "bg-green-50 text-green-700";
    case "CHALLENGED":
    case "STEP_UP_AUTH":
      return "bg-amber-50 text-amber-700";
    case "FAILURE":
    case "DENIED":
    case "BLOCK":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
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
      label: "Total audit events",
      value: stats?.total_audit_events ?? 0,
      icon: Activity,
    },
    {
      label: "Successful",
      value: successCount,
      icon: CheckCircle2,
    },
    {
      label: "Challenged or denied",
      value: challengedCount + deniedCount,
      icon: ShieldCheck,
    },
    {
      label: "Failures",
      value: failureCount,
      icon: AlertTriangle,
    },
  ];

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review document activity, access decisions, and security events.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || riskLoading}
          onClick={() => setRefreshCount((count) => count + 1)}
          className="flex items-center gap-2 rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border bg-white p-5">
            <Icon size={22} className="text-blue-600" />
            <p className="mt-3 text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {stats && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border bg-white p-5">
            <h2 className="font-semibold">Risk levels</h2>
            <div className="mt-3 space-y-2 text-sm">
              {Object.entries(stats.risk_distribution).length === 0 ? (
                <p className="text-slate-500">No risk events recorded.</p>
              ) : (
                Object.entries(stats.risk_distribution).map(([level, count]) => (
                  <p key={level} className="flex justify-between">
                    <span>{level}</span>
                    <strong>{count}</strong>
                  </p>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-5">
            <h2 className="font-semibold">Other security activity</h2>
            <p className="mt-3 flex justify-between text-sm">
              <span>Integrity failures</span>
              <strong>{stats.integrity_failures}</strong>
            </p>
            <h3 className="mt-4 text-sm font-medium">Top actions</h3>
            <div className="mt-2 space-y-2 text-sm">
              {Object.entries(stats.action_breakdown).map(([name, count]) => (
                <p key={name} className="flex justify-between gap-3">
                  <span className="break-all">{name}</span>
                  <strong>{count}</strong>
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">Audit events</h2>

        <form
          onSubmit={applyFilters}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="space-y-1 text-sm">
            <span>Action</span>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="e.g. documents.download"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <span>Status</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="CHALLENGED">Challenged</option>
              <option value="DENIED">Denied</option>
              <option value="FAILURE">Failure</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span>User ID</span>
            <input
              className="w-full rounded border px-3 py-2"
              type="number"
              min="1"
              placeholder="Any user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </label>

          <div className="flex items-end gap-2">
            <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              Apply
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded border px-4 py-2 text-sm"
            >
              Clear
            </button>
          </div>
        </form>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">Loading audit events…</p>
        ) : events.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">
            No events match these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Document</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap p-3">
                      {formatDate(event.timestamp)}
                    </td>
                    <td className="p-3">{event.action}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {event.user_email ?? event.user_id ?? "—"}
                    </td>
                    <td className="max-w-40 break-all p-3 text-xs">
                      {event.document_id ?? "—"}
                    </td>
                    <td className="p-3">
                      <details>
                        <summary className="cursor-pointer text-blue-700">
                          View
                        </summary>
                        <pre className="mt-2 max-w-xs overflow-x-auto whitespace-pre-wrap break-all text-xs">
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

        <div className="mt-4 flex items-center justify-between text-sm">
          <span>
            Showing {events.length === 0 ? 0 : offset + 1}–
            {offset + events.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || events.length < PAGE_SIZE}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded border px-3 py-2 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {canReadRisk && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Recent risk decisions</h2>
          <p className="mt-1 text-sm text-slate-500">
            The backend returns the 50 most recent risk events.
          </p>

          {riskError && (
            <p role="alert" className="mt-3 text-red-700">
              {riskError}
            </p>
          )}

          {riskLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading risk events…</p>
          ) : riskEvents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No risk events recorded.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {riskEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{event.action}</strong>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor(event.decision)}`}
                    >
                      {event.decision}
                    </span>
                  </div>

                  <p className="mt-2 text-slate-600">
                    Risk: {event.risk_level} ({event.risk_score}) · User ID:{" "}
                    {event.user_id} · {formatDate(event.timestamp)}
                  </p>
                  <p className="mt-1 text-slate-600">{event.reason}</p>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-700">
                      View six risk factors
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
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