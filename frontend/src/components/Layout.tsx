import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Upload,
  PenLine,
  KeyRound,
  UserRound,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { auth, errorMessage } from "../api/client";
import { Alert, roleName } from "./UI";

export default function Layout() {
  const { user, setUser, can, permissionError, reloadPermissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const items = [
    {
      to: "/workspace/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: "/workspace/upload",
      label: "Document Upload",
      icon: Upload,
      show: can("documents.upload"),
    },
    {
      to: "/workspace/signatures",
      label: "Digital Signatures",
      icon: PenLine,
      show: can("documents.sign") || can("documents.verify"),
    },
    {
      to: "/workspace/keys",
      label: "Encryption Setup",
      icon: KeyRound,
      show: can("crypto_keys.create"),
    },
    {
      to: "/workspace/profile",
      label: "My Account",
      icon: UserRound,
      show: true,
    },
  ].filter((item) => item.show);
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await auth.logout();
      setUser(null);
      navigate("/login", { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function sidebar() {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <ShieldCheck size={22} />
          </span>
          <div>
            <span className="text-lg font-bold tracking-wide text-slate-800">
              Securitas
            </span>
            <p className="mt-1 text-[10px] uppercase tracking-[.2em] text-slate-400">
              Document Security
            </p>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="flex-1 space-y-2 overflow-y-auto px-4 py-6"
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate px-4 text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={() => void signOut()}
            disabled={busy}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            {busy ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen bg-blue-50/40">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white shadow-sm md:block">
        {sidebar()}
      </aside>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        className="fixed left-4 top-4 z-50 rounded-xl border border-slate-200 bg-white p-2.5 shadow md:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <>
          <button
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          />
          <aside className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-slate-200 bg-white shadow-2xl md:hidden">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 p-2 text-slate-400"
            >
              <X size={18} />
            </button>
            {sidebar()}
          </aside>
        </>
      )}
      <div className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between gap-4 border-b border-blue-100 bg-white/80 px-6 pl-20 md:px-8">
          <span className="text-sm font-medium text-slate-500">
            Secure Document Workspace
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600">
            {roleName(user?.role || "")}
          </span>
        </header>
        <main className="mx-auto max-w-7xl space-y-5 p-5 md:p-8">
          {error && <Alert message={error} />}
          {permissionError && (
            <div className="space-y-2">
              <Alert message={permissionError} />
              <button
                className="btn-secondary"
                onClick={() => void reloadPermissions()}
              >
                <RefreshCw size={15} />
                Retry permissions
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
