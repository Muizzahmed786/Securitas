import { Navigate, Outlet } from "react-router-dom";
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

  if (loading) return <p>Loading account…</p>;
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
    if (permissionsLoading) return <p>Loading permissions…</p>;

    if (!permissions.some((permission) => can(permission))) {
      return <Navigate to="/workspace/dashboard" replace />;
    }
  }

  return <Outlet />;
}