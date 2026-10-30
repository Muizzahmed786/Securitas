import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type ProtectedRouteProps = {
  allowedRoles?: string[];
  permissions?: string[];
};

export default function ProtectedRoute({
  allowedRoles,
  permissions,
}: ProtectedRouteProps) {
  const { user, loading, permissionsLoading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080a] text-neutral-400">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121218] px-6 py-4 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span className="text-xs font-medium">Authenticating session…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (
    allowedRoles &&
    !allowedRoles.some(
      (role) => role.toUpperCase() === user.role.toUpperCase(),
    )
  ) {
    return <Navigate to="/workspace/dashboard" replace />;
  }

  if (permissions) {
    if (permissionsLoading) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center text-neutral-400">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121218] px-6 py-4 shadow-xl">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
            <span className="text-xs font-medium">Authorizing capabilities…</span>
          </div>
        </div>
      );
    }

    if (!permissions.some((permission) => can(permission))) {
      return <Navigate to="/workspace/dashboard" replace />;
    }
  }

  return <Outlet />;
}
