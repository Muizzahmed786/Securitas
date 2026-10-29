import {
  CalendarDays,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

function roleName(role: string) {
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Profile() {
  const { user, permissions } = useAuth();

  if (!user) return null;

  const details = [
    { label: "Email address", value: user.email, icon: Mail },
    { label: "Workspace role", value: roleName(user.role), icon: ShieldCheck },
    { label: "Member since", value: formatDate(user.created_at), icon: CalendarDays },
    {
      label: "Account status",
      value: user.is_active ? "Active" : "Inactive",
      icon: UserRound,
    },
  ];

  return (
    <main className="space-y-6">
      <div>
        <p className="text-sm font-medium text-blue-600">Your account</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">Profile</h1>
        <p className="mt-2 text-sm text-slate-500">
          View your account information and assigned permissions.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
            {user.email[0]?.toUpperCase() ?? "U"}
          </div>

          <div className="min-w-0">
            <h2 className="break-all text-xl font-bold text-slate-800">
              {user.email}
            </h2>
            <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {roleName(user.role)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-slate-100 p-4">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Icon size={16} />
                {label}
              </p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <KeyRound size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              Your permissions
            </h2>
            <p className="text-sm text-slate-500">
              Actions available to your account.
            </p>
          </div>
        </div>

        {permissions.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <p className="break-all text-sm font-semibold text-slate-700">
                  {permission.name}
                </p>
                {permission.description && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {permission.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <ShieldCheck size={28} className="mx-auto text-slate-400" />
            <p className="mt-2 font-medium text-slate-700">
              No permissions assigned
            </p>
          </div>
        )}
      </section>
    </main>
  );
}