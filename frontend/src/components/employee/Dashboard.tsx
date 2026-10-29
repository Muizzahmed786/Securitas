import { Link } from "react-router-dom";
import { FileText, Share2, PenLine, ShieldCheck, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/sharing",
      title: "Accessible Documents",
      description: "Inspect encrypted documents shared with your account.",
      icon: Share2,
      visible: can("documents.read") || can("documents.verify"),
    },
    {
      to: "/workspace/signatures",
      title: "Verify Digital Signatures",
      description: "Perform mathematical non-repudiation checks on received files.",
      icon: PenLine,
      visible: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Tenant Member
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Employee Console
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Access shared documents under cryptographic RBAC and adaptive risk monitoring.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <FileText size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Authorized Capabilities</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">
                {permissions.length} Roles
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Session Security State</p>
              <p className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                ACTIVE · ZERO-LEAK SESSION
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white">
          Workspace Operations
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
