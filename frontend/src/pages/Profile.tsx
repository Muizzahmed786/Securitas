import {
  CalendarDays,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  Shield,
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
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Identity & Access
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Account Profile
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Cryptographic entity details and assigned capability permissions.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-2xl font-bold text-amber-400 font-mono">
            {user.email[0]?.toUpperCase() ?? "U"}
          </div>

          <div className="min-w-0">
            <h2 className="break-all text-lg font-medium text-white">
              {user.email}
            </h2>
            <span className="mt-1.5 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-mono font-medium text-amber-400 uppercase">
              {roleName(user.role)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {details.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-white/[0.08] bg-black/40 p-4">
              <p className="flex items-center gap-2 text-xs text-neutral-400">
                <Icon size={14} className="text-amber-400/80" />
                <span>{label}</span>
              </p>
              <p className="mt-2 break-all text-sm font-medium text-neutral-100">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-400">
            <KeyRound size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Assigned Permissions
            </h2>
            <p className="text-xs text-neutral-400">
              Granular capabilities granted to your cryptographic session.
            </p>
          </div>
        </div>

        {permissions.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="rounded-xl border border-white/[0.08] bg-black/40 p-4 transition hover:border-white/20"
              >
                <p className="break-all font-mono text-xs font-semibold text-amber-300">
                  {permission.name}
                </p>
                {permission.description && (
                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    {permission.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-white/15 p-6 text-center text-neutral-500">
            <Shield size={24} className="mx-auto text-neutral-600 mb-2" />
            <p className="text-xs">No permissions assigned to this role</p>
          </div>
        )}
      </section>
    </main>
  );
}
