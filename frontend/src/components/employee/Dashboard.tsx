import { Link } from "react-router-dom";
import { FileText, Share2, PenLine, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/sharing",
      title: "Accessible Documents",
      description: "View documents shared with your account.",
      icon: Share2,
      show: true,
    },
    {
      to: "/workspace/signatures",
      title: "Digital Signatures",
      description: "Sign or verify documents where permitted.",
      icon: PenLine,
      show: can("documents.sign") || can("documents.verify"),
    },
  ].filter((action) => action.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Employee Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome, {user?.email}. Access your authorized documents and tools.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <FileText className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Available permissions</p>
          <p className="mt-2 text-2xl font-bold">{permissions.length}</p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <ShieldCheck className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Account status</p>
          <p className="mt-2 text-lg font-semibold">Signed in</p>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">My Workspace</h2>

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
        </div>
      </section>
    </div>
  );
}