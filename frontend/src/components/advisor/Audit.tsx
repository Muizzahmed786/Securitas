import { useEffect, useState } from "react";
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  Ban,
  Filter,
  RefreshCw,
  Eye,
  Hash,
} from "lucide-react";
import { audit, errorMessage, type AuditEvent, type AuditStats } from "../api/client";
import {
  Alert,
  Card,
  PageHeading,
  Empty,
  Spinner,
  formatDate,
} from "../components/UI";

export default function Audit() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedMeta, setSelectedMeta] = useState<Record<string, any> | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [statsData, eventsData] = await Promise.all([
        audit.stats(),
        audit.events({
          action: actionFilter || undefined,
          status: statusFilter || undefined,
          limit: 50,
        }),
      ]);
      setStats(statsData);
      setEvents(eventsData);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [actionFilter, statusFilter]);

  return (
    <>
      <PageHeading
        eyebrow="Security Operations"
        title="Auditor Security Dashboard"
        description="Comprehensive audit trail, real-time risk decision telemetry, and verified zero-leak sanitization inspection."
      />

      <Alert message={error} />

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Activity size={20} />
            </span>
            <span className="rounded-full bg-blue-100/60 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              LIVE
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Audited Events
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
            {stats?.total_audit_events || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Security event records in PostgreSQL</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={20} />
            </span>
            <span className="rounded-full bg-emerald-100/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              PASSED
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Successful Actions
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600">
            {stats?.status_breakdown?.SUCCESS || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Authorized requests granted</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldAlert size={20} />
            </span>
            <span className="rounded-full bg-amber-100/60 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              CHALLENGED
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Step-Up Challenges
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-600">
            {stats?.status_breakdown?.CHALLENGED || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Adaptive risk thresholds triggered</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Ban size={20} />
            </span>
            <span className="rounded-full bg-rose-100/60 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              BLOCKED
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Policy Denials
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-rose-600">
            {(stats?.status_breakdown?.DENIED || 0) + (stats?.status_breakdown?.FAILURE || 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Access denied or integrity failures</p>
        </Card>
      </div>

      {/* RISK LEVEL DISTRIBUTION */}
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800">Risk Engine Telemetry & Incident Severity</h3>
        <p className="mt-0.5 text-xs text-slate-400">Distribution of evaluated actions by computed 6-factor risk level</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">LOW (0 - 30)</span>
            <p className="mt-1 text-xl font-bold text-emerald-900">{stats?.risk_distribution?.LOW || 0}</p>
            <p className="text-[11px] text-emerald-700">Normal operations (Allow)</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">MEDIUM (31 - 60)</span>
            <p className="mt-1 text-xl font-bold text-blue-900">{stats?.risk_distribution?.MEDIUM || 0}</p>
            <p className="text-[11px] text-blue-700">Monitored access (Allow)</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">HIGH (61 - 80)</span>
            <p className="mt-1 text-xl font-bold text-amber-900">{stats?.risk_distribution?.HIGH || 0}</p>
            <p className="text-[11px] text-amber-700">Challenged (Step-Up OTP)</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">CRITICAL (&gt; 80)</span>
            <p className="mt-1 text-xl font-bold text-rose-900">{stats?.risk_distribution?.CRITICAL || 0}</p>
            <p className="text-[11px] text-rose-700">Anomalous (Blocked)</p>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
            <Filter size={14} />
            Filters:
          </span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="documents.upload">documents.upload</option>
            <option value="documents.download">documents.download</option>
            <option value="documents.share">documents.share</option>
            <option value="documents.revoke">documents.revoke</option>
            <option value="documents.verify">documents.verify</option>
            <option value="auth.login">auth.login</option>
            <option value="auth.register">auth.register</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="CHALLENGED">CHALLENGED</option>
            <option value="DENIED">DENIED</option>
            <option value="FAILURE">FAILURE</option>
          </select>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh Audit Trail
        </button>
      </div>

      {/* AUDIT LOG TABLE */}
      <Card className="mt-4">
        {loading ? (
          <div className="py-12 text-center">
            <Spinner />
            <p className="mt-3 text-sm text-slate-500">Loading audit records...</p>
          </div>
        ) : events.length === 0 ? (
          <Empty title="No audit events matched" description="Try clearing filters to see all events." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">IP Address</th>
                  <th className="px-4 py-3 text-right">Sanitized Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {events.map((e) => (
                  <tr key={e.id} className="transition hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-sans text-xs text-slate-500">
                      {formatDate(e.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-sans font-medium text-slate-800">
                      {e.user_email || `User #${e.user_id || "Anonymous"}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {e.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          e.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : e.status === "CHALLENGED"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{e.ip_address || "127.0.0.1"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedMeta(e.metadata)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-sans font-medium text-blue-600 shadow-sm transition hover:bg-blue-50 hover:border-blue-300"
                      >
                        <Eye size={12} />
                        Inspect Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* METADATA INSPECTOR MODAL */}
      {selectedMeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Hash size={18} className="text-blue-600" />
                Sanitized Event Metadata
              </h3>
              <button
                onClick={() => setSelectedMeta(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 rounded-lg bg-emerald-50/70 p-3 text-xs text-emerald-800 border border-emerald-200">
              <strong>Verified Zero-Secret Guarantee:</strong> Passwords, JWT tokens, private keys, symmetric DEKs, and document contents are strictly redacted to <code>[REDACTED]</code>.
            </div>
            <pre className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-emerald-400">
              {JSON.stringify(selectedMeta, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedMeta(null)}
                className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
