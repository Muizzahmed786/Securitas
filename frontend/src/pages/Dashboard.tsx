import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Upload,
  KeyRound,
  PenLine,
  ArrowRight,
  FileText,
  LockKeyhole,
  UserRound,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  Card,
  PageHeading,
  Empty,
  formatDate,
  roleName,
} from "../components/UI";
export default function Dashboard() {
  const { user, permissions, receipts, can } = useAuth();
  const stats = [
    {
      label: "Your workspace",
      value: roleName(user?.role || ""),
      icon: UserRound,
      color: "bg-blue-50 text-blue-600",
      sub: "Role assigned to your account",
    },
    {
      label: "Permissions",
      value: permissions.length,
      icon: ShieldCheck,
      color: "bg-violet-50 text-violet-600",
      sub: "Actions allowed by your role",
    },
    {
      label: "Uploads this session",
      value: receipts.length,
      icon: FileText,
      color: "bg-emerald-50 text-emerald-600",
      sub: "Successful uploads since sign-in",
    },
    {
      label: "Document encryption",
      value: "AES-256-GCM",
      icon: LockKeyhole,
      color: "bg-amber-50 text-amber-600",
      sub: "With RSA-protected document keys",
    },
  ];
  const actions = [
    {
      to: "/workspace/upload",
      label: "Upload a document",
      desc: "Protect a PDF or Word document with encrypted storage.",
      icon: Upload,
      show: can("documents.upload"),
    },
    {
      to: "/workspace/signatures",
      label: "Digital signatures",
      desc: "Manage signing keys, sign documents, or check signatures.",
      icon: PenLine,
      show: can("documents.sign") || can("documents.verify"),
    },
    {
      to: "/workspace/keys",
      label: "Initialize encryption",
      desc: "Create the system wrapping key before the first upload.",
      icon: KeyRound,
      show: can("crypto_keys.create"),
    },
  ].filter((action) => action.show);
  return (
    <>
      <PageHeading
        eyebrow="Overview"
        title="Your secure workspace"
        description={`Welcome back${user?.email ? ", " + user.email : ""}. Manage document security from one place.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color, sub }) => (
          <Card key={label}>
            <span
              className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}
            >
              <Icon size={20} />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-800">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-400">{sub}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="section-heading">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-400">
            Available for your account permissions.
          </p>
          <div className="mt-5 space-y-3">
            {actions.length ? (
              actions.map(({ to, label, desc, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-4 rounded-xl border border-blue-100 p-4 transition hover:bg-blue-50/60"
                >
                  <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
                    <Icon size={21} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {label}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      {desc}
                    </p>
                  </div>
                  <ArrowRight
                    size={17}
                    className="ml-auto shrink-0 text-blue-500"
                  />
                </Link>
              ))
            ) : (
              <Empty
                title="No document actions assigned"
                description="Your administrator can configure your role permissions."
              />
            )}
          </div>
        </Card>
        <Card>
          <span className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600">
            <ShieldCheck size={24} />
          </span>
          <h2 className="section-heading">Protection at each step</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Document contents are encrypted before persistent storage. RSA key
            wrapping protects each file's encryption key.
          </p>
          <div className="mt-5 space-y-3">
            {[
              "Authenticated access",
              "Role-based permissions",
              "Encrypted uploads",
              "Digital signature tools",
            ].map((label) => (
              <p
                key={label}
                className="flex items-center gap-2 text-xs text-slate-600"
              >
                <CheckCircle2 size={15} className="text-emerald-500" />
                {label}
              </p>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="section-heading">Recent uploads this session</h2>
        <p className="mt-1 text-xs text-slate-400">
          Upload receipts are kept until you refresh or sign out.
        </p>
        {receipts.length ? (
          <div className="mt-4 divide-y divide-slate-100">
            {receipts.slice(0, 5).map((receipt) => (
              <div key={receipt.id} className="flex items-center gap-3 py-4">
                <FileText size={21} className="shrink-0 text-blue-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-700">
                    {receipt.filename}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(receipt.created_at)}
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-600">
                  ENCRYPTED
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No uploads this session"
            description="Your next successful upload will appear here."
          />
        )}
      </Card>
    </>
  );
}
