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

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/workspace" replace />;
  }

  if (permissions && permissionsLoading) {
    return <div>Loading permissions...</div>;
  }

  if (permissions && !permissions.some(can)) {
    return <Navigate to="/workspace" replace />;
  }

  return <Outlet />;
}