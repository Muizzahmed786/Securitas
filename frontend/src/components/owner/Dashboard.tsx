import { Link } from "react-router-dom";
import { Upload, Share2, PenLine, FileText, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

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
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Document Custody
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Owner Console
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Manage your sovereign encrypted documents and access grants.
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

      {can("documents.upload") && (
        <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <h2 className="text-base font-semibold text-white">
            Recent Upload Receipts
          </h2>

          {receipts.length === 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              No uploads during this session. Use the Upload tool to ingest new files.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {receipts.slice(0, 5).map((receipt) => (
                <li key={receipt.id} className="py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">
                      {receipt.filename}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-amber-400/80">
                      ID: {receipt.id}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                    Encrypted
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
