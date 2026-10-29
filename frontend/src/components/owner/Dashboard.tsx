import { Link } from "react-router-dom";
import { Upload, Share2, PenLine, FileText } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, receipts, can } = useAuth();

  const actions = [
    {
      to: "/workspace/owner/upload",
      title: "Upload Document",
      description: "Upload and encrypt a document.",
      icon: Upload,
      visible: can("documents.upload"),
    },
    {
      to: "/workspace/sharing",
      title: "Manage Document Sharing",
      description: "View documents and manage their access grants.",
      icon: Share2,
      visible: can("documents.read") || can("documents.verify"),
    },
    {
      to: "/workspace/signatures",
      title: "Digital Signatures",
      description: "Sign or verify documents where permitted.",
      icon: PenLine,
      visible: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.visible);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome, {user?.email}. Manage your documents securely.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-5">
        <FileText className="mb-3 text-blue-600" size={24} />
        <p className="text-sm text-slate-500">Uploads this session</p>
        <p className="mt-2 text-2xl font-bold">{receipts.length}</p>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">Document Management</h2>

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
              No document actions are available for your permissions.
            </p>
          )}
        </div>
      </section>

      {can("documents.upload") && (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-lg font-semibold">Recent Uploads</h2>

          {receipts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No uploads during this session.
            </p>
          ) : (
            <ul className="mt-3 divide-y">
              {receipts.slice(0, 5).map((receipt) => (
                <li key={receipt.id} className="py-3">
                  <p className="truncate text-sm font-medium">
                    {receipt.filename}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    ID: {receipt.id}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}