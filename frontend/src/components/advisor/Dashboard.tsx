import { Link } from "react-router-dom";
import { Activity, ShieldCheck, PenLine, Share2, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SecurityDashboard from "../security/SecurityDashboard";

export default function Dashboard() {
  const { permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/advisor/audit",
      title: "Immutable Audit Ledger",
      description: "Inspect tamper-evident event logs with automated secret redaction.",
      icon: Activity,
      visible: can("audit.read"),
    },
    {
      to: "/workspace/signatures",
      title: "Cryptographic Verification",
      description: "Mathematically verify document integrity and RSA-PSS signatures.",
      icon: PenLine,
      visible: can("documents.verify"),
    },
    {
      to: "/workspace/sharing",
      title: "Document Vault & Access Grants",
      description: "Review active document classifications and time-bounded shares.",
      icon: Share2,
      visible: can("documents.read") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Independent Oversight
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Security Auditor Console
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Independent compliance review, cryptographic audit trails, and continuous risk intelligence.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <Activity size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Audit Ledger Invariants</p>
              <p className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                APPEND-ONLY · REDACTION ENFORCED
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Assigned Inspection Roles</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">
                {permissions.length} Capabilities
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Security Intelligence & Behavioral Graphs */}
      <SecurityDashboard />

      {/* Quick Links Section */}
      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white">
          Auditor Verification Tools
        </h2>

        <div className="mt-4 space-y-3">
          {actions.map(({ to, title, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/40 p-4 transition hover:border-amber-500/30 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-amber-400">
                  <Icon size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-medium text-white">{title}</h3>
                  <p className="text-xs text-neutral-400">{description}</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-500" />
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
