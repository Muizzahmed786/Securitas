import { Link } from "react-router-dom";
import { ShieldCheck, KeyRound, Share2, PenLine, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SecurityDashboard from "../security/SecurityDashboard";

export default function Dashboard() {
  const { permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/admin/encryption",
      title: "Encryption Setup",
      description: "Initialize or rotate tenant RSA-OAEP document wrapping keys (KEK).",
      icon: KeyRound,
      visible: can("crypto_keys.create"),
    },
    {
      to: "/workspace/sharing",
      title: "Document Vault & Sharing",
      description: "Inspect encrypted files, grant time-bound access, and enforce classification.",
      icon: Share2,
      visible: can("documents.read") || can("documents.share"),
    },
    {
      to: "/workspace/signatures",
      title: "Digital Signatures & Keys",
      description: "Generate client RSA-PSS signing keys and verify document non-repudiation.",
      icon: PenLine,
      visible: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          System Administration
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Admin Console
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Tenant encryption keys, authorization topology, and cryptographic security operations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Assigned RBAC Capabilities</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">
                {permissions.length} Granted
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <KeyRound size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Payload Encryption Standard</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">
                AES-256-GCM
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Security Analytics & Behavioral Graphs */}
      <SecurityDashboard />

      {/* Management Tools */}
      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white">
          Cryptographic Management Tools
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
