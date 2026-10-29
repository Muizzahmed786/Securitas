import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
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

  // A tool must match both the user's role and their permissions.
  const items = [
    {
      to: "/workspace/dashboard",
      label: "Dashboard",
      visible: true,
    },
    {
      to: "/workspace/sharing",
      label: "Documents",
      visible:
        (isOwner || isEmployee || isAuditor) &&
        (can("documents.read") || can("documents.verify")),
    },
    {
      to: "/workspace/owner/upload",
      label: "Upload Document",
      visible: isOwner && can("documents.upload"),
    },
    {
      to: "/workspace/signatures",
      label: isOwner ? "Digital Signatures" : "Verify Signatures",
      visible:
        (isOwner && (can("documents.sign") || can("documents.verify"))) ||
        ((isEmployee || isAuditor) && can("documents.verify")),
    },
    {
      to: "/workspace/admin/encryption",
      label: "Encryption Setup",
      visible: isAdmin && can("crypto_keys.create"),
    },
    {
      to: "/workspace/advisor/audit",
      label: "Audit Logs",
      visible: (isAdmin || isAuditor) && can("audit.read"),
    },
    {
      to: "/workspace/profile",
      label: "My Account",
      visible: true,
    },
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
      <div className="flex h-full flex-col">
        <div className="border-b px-6 py-7">
          <p className="text-lg font-bold">Securitas</p>
          <p className="text-sm">Document Security</p>
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-2 overflow-y-auto p-4">
          {items.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? "block border px-4 py-3 font-bold underline"
                  : "block px-4 py-3"
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 border-t p-4">
          <p className="break-all text-sm">{user?.email}</p>
          <button type="button" disabled={busy} onClick={signOut} className="w-full border px-3 py-2">
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r md:block">
        {sidebar()}
      </aside>

      {!open && (
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-40 border bg-white p-2 md:hidden"
        >
          Menu
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-white md:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-white md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-2 border px-2"
            >
              Close
            </button>
            {sidebar()}
          </aside>
        </>
      )}

      <div className="min-w-0 flex-1">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b p-4 pl-24 md:px-8">
          <span>Secure Document Workspace</span>
          <span className="text-sm">{roleName(user?.role)}</span>
        </header>
        <div className="mx-auto max-w-7xl p-5 md:p-8">
          {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
          {permissionError && (
            <div className="mb-4 space-y-2">
              <p role="alert" className="text-red-700">{permissionError}</p>
              <button type="button" onClick={() => void reloadPermissions()} className="border px-3 py-2">
                Retry permissions
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
