import { Link } from "react-router-dom";
import { Activity, ShieldCheck, PenLine, Share2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user, permissions, can } = useAuth();

  const actions = [
    {
      to: "/workspace/advisor/audit",
      title: "Audit Logs",
      description: "Review available security events and audit records.",
      icon: Activity,
      show: can("audit.read"),
    },
    {
      to: "/workspace/signatures",
      title: "Verify Signatures",
      description: "Verify document signatures where permitted.",
      icon: PenLine,
      show: can("documents.verify"),
    },
    {
      to: "/workspace/sharing",
      title: "Accessible Documents",
      description: "View documents available to your account.",
      icon: Share2,
      show: true,
    },
  ].filter((action) => action.show);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Auditor Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome, {user?.email}. Review security and compliance activity.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-white p-5">
          <Activity className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Audit access</p>
          <p className="mt-2 text-lg font-semibold">
            {can("audit.read") ? "Available" : "Not granted"}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-5">
          <ShieldCheck className="mb-3 text-blue-600" size={24} />
          <p className="text-sm text-slate-500">Assigned permissions</p>
          <p className="mt-2 text-2xl font-bold">{permissions.length}</p>
        </div>
      </div>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">Security Tools</h2>

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
              No security tools are available for your permissions.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}