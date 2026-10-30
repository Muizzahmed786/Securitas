import { Link } from "react-router-dom";
import { Upload, Share2, PenLine, FileText, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SharingStatusChart from "../security/SharingStatusChart";
import CryptoPerformanceChart from "../security/CryptoPerformanceChart";

export default function Dashboard() {
  const { receipts, can } = useAuth();

  const actions = [
    {
      to: "/workspace/owner/upload",
      title: "Upload & Encrypt Document",
      description: "AES-256-GCM envelope encryption with classification tagging.",
      icon: Upload,
      visible: can("documents.upload"),
    },
    {
      to: "/workspace/sharing",
      title: "Manage Document Vault & Sharing",
      description: "View encrypted documents and grant time-bounded access.",
      icon: Share2,
      visible: can("documents.read") || can("documents.verify"),
    },
    {
      to: "/workspace/signatures",
      title: "Digital Signatures",
      description: "Generate client RSA-PSS signing keys and sign original documents.",
      icon: PenLine,
      visible: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Document Custody
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Owner Console
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Manage your sovereign encrypted documents, cryptographic verifications, and sharing grants.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
              <FileText size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Uploads This Session</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-white">
                {receipts.length} Documents
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Upload size={20} />
            </span>
            <div>
              <p className="text-xs text-neutral-400">Cryptographic Invariants</p>
              <p className="mt-1 font-mono text-xs font-semibold text-neutral-200">
                AES-GCM DEK + RSA-OAEP KEK
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sharing Status Breakdown */}
      <SharingStatusChart />

      {/* Cryptographic Execution Benchmark */}
      <CryptoPerformanceChart />

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white">
          Document Operations
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
