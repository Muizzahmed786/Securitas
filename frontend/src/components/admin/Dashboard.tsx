import { Link } from "react-router-dom";
import { ShieldCheck, KeyRound, Share2, PenLine } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/admin/encryption",
      title: "Encryption Setup",
      description: "Initialize the document wrapping key.",
      icon: KeyRound,
      visible: can("crypto_keys.create"),
    },
    {
      to: "/workspace/sharing",
      title: "Document Sharing",
      description: "View documents and manage access.",
      icon: Share2,
      visible: can("documents.read") || can("documents.share"),
    },
    {
      to: "/workspace/signatures",
      title: "Digital Signatures",
      description: "Sign or verify documents.",
      icon: PenLine,
      visible: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome, {user?.email}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <ShieldCheck className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Assigned permissions</p>
          <p className="mt-2 text-2xl font-bold">{permissions.length}</p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <KeyRound className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">
            Document encryption algorithm
          </p>
          <p className="mt-2 text-lg font-semibold">AES-256-GCM</p>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">System Tools</h2>

        <div className="mt-4 space-y-3">
          {actions.map(({ to, title, description, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-slate-50"
            >
              <Icon size={22} className="shrink-0 text-blue-600" />
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
            </Link>
          ))}

          {actions.length === 0 && (
            <p className="text-sm text-slate-500">
              No system tools are available for your permissions.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}