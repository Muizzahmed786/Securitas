import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  FileText,
  Upload,
  PenTool,
  Key,
  ClipboardList,
  User,
  LogOut,
  Menu,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  Presentation,
} from "lucide-react";
import { auth } from "../../api/auth";
import { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";

function roleName(role?: string) {
  return (role || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Layout() {
  const { user, setUser, can, permissionError, reloadPermissions } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.role === "DOCUMENT_OWNER";
  const isEmployee = user?.role === "EMPLOYEE";
  const isAuditor = user?.role === "SECURITY_AUDITOR";

  const items = [
    {
      to: "/workspace/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      visible: true,
    },
    {
      to: "/workspace/sharing",
      label: "Documents",
      icon: FileText,
      visible:
        (isOwner || isEmployee || isAuditor) &&
        (can("documents.read") || can("documents.verify")),
    },
    {
      to: "/workspace/search",
      label: "Search Enclave",
      icon: Search,
      visible:
        (isOwner || isEmployee || isAuditor) &&
        (can("documents.search") || can("documents.read")),
    },
    {
      to: "/workspace/owner/upload",
      label: "Upload Document",
      icon: Upload,
      visible: isOwner && can("documents.upload"),
    },
    {
      to: "/workspace/signatures",
      label: isOwner ? "Digital Signatures" : "Verify Signatures",
      icon: PenTool,
      visible:
        (isOwner && (can("documents.sign") || can("documents.verify"))) ||
        ((isEmployee || isAuditor) && can("documents.verify")),
    },
    {
      to: "/workspace/admin/encryption",
      label: "Encryption Setup",
      icon: Key,
      visible: isAdmin && can("crypto_keys.create"),
    },
    {
      to: "/workspace/advisor/audit",
      label: "Audit Logs",
      icon: ClipboardList,
      visible: (isAdmin || isAuditor) && can("audit.read"),
    },
    {
      to: "/workspace/profile",
      label: "My Account",
      icon: User,
      visible: true,
    },
    {
      to: "/workspace/rooms",
      label: "Rooms",
      icon: Presentation,
      visible: true,
    }
  ].filter((item) => item.visible);

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await auth.logout();
      setUser(null);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function sidebar() {
    return (
      <div className="flex h-full flex-col bg-[#0c0c10] text-neutral-200">
        {/* Brand Header */}
        <div className="border-b border-white/[0.08] p-6">
          <Link
            to="/home"
            className="flex items-center gap-2.5 text-sm font-semibold tracking-[0.25em] text-white uppercase transition hover:opacity-90"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Shield className="h-4 w-4" />
            </span>
            securitas
          </Link>
          <p className="mt-2 text-[11px] uppercase tracking-wider text-neutral-500">
            Document Security Vault
          </p>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Main navigation" className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-white/[0.08] text-white font-semibold border-l-2 border-amber-400"
                    : "text-neutral-400 hover:bg-white/[0.03] hover:text-white"
                }`
              }
            >
              <Icon size={16} className="shrink-0 text-amber-400/80" />
              <span>{label}</span>
            </NavLink>
            
          ))}
        </nav>

        {/* User Account & Sign Out */}
        <div className="border-t border-white/[0.08] p-4 space-y-3">
          <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-neutral-200">
              {user?.email}
            </p>
            <div className="mt-1.5 inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 uppercase">
              {roleName(user?.role)}
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
          >
            <LogOut size={14} />
            <span>{busy ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#08080a] text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 right-1/4 h-[500px] w-[500px] rounded-full blur-[130px]"
          style={{
            background: "radial-gradient(circle, rgba(217, 119, 6, 0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.08] md:block">
        {sidebar()}
      </aside>

      {/* Mobile Menu Trigger */}
      {!open && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-40 rounded-lg border border-white/10 bg-[#0c0c10] p-2 text-neutral-300 md:hidden"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile Drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r border-white/[0.08] bg-[#0c0c10] md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-lg border border-white/10 p-1.5 text-neutral-400 hover:text-white"
            >
              <X size={16} />
            </button>
            {sidebar()}
          </aside>
        </>
      )}

      {/* Main Workspace Area */}
      <div className="relative min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#08080a]/80 px-6 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-2 pl-12 md:pl-0">
            <span className="text-xs uppercase tracking-widest text-neutral-400">
              Workspace Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-mono font-medium text-amber-300">
              {roleName(user?.role)}
            </span>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5 md:p-8">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              <AlertCircle size={16} className="shrink-0 text-red-400" />
              <p role="alert">{error}</p>
            </div>
          )}
          {permissionError && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
                <p role="alert">{permissionError}</p>
              </div>
              <button
                type="button"
                onClick={() => void reloadPermissions()}
                className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-200 hover:bg-amber-500/30"
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
