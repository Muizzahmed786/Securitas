import { Mail, ShieldCheck, CalendarDays, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  Card,
  Empty,
  PageHeading,
  formatDate,
  roleName,
} from "../components/UI";
export default function Profile() {
  const { user, permissions } = useAuth();
  if (!user) return null;
  const fields = [
    { label: "Email address", value: user.email, icon: Mail },
    { label: "Workspace role", value: roleName(user.role), icon: ShieldCheck },
    {
      label: "Member since",
      value: formatDate(user.created_at),
      icon: CalendarDays,
    },
    {
      label: "Account status",
      value: user.is_active ? "Active" : "Inactive",
      icon: UserRound,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="Your account"
        title="Account & permissions"
        description="View your account details and the actions allowed by your role."
      />
      <Card>
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
            {user.email[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="break-all text-xl font-bold text-slate-800">
              {user.email}
            </h2>
            <span className="badge mt-2 inline-block">
              {roleName(user.role)}
            </span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-slate-100 p-4">
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Icon size={15} />
                {label}
              </p>
              <p className="mt-2 break-all text-sm font-semibold text-slate-700">
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="section-heading">Your permissions</h2>
        <p className="mt-1 text-sm text-slate-400">
          The backend checks permissions on every protected operation.
        </p>
        {permissions.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="rounded-xl border border-blue-100 bg-blue-50/20 p-4"
              >
                <p className="break-all text-sm font-semibold text-blue-700">
                  {permission.name}
                </p>
                {permission.description && (
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {permission.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No permissions assigned"
            description="Ask your administrator to configure your role permissions."
          />
        )}
      </Card>
    </>
  );
}
