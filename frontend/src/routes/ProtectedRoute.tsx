import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/UI";
import {
  Navigate,
  Outlet,
  Link,
} from "react-router-dom";
export default function ProtectedRoute({ permissions }: { permissions?: string[] }) {
  const { user, loading, permissionsLoading, can, permissionError } = useAuth();
  if (loading)
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center gap-2 bg-blue-50 text-sm text-slate-500"
      >
        <Spinner />
        Opening your workspace…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (permissions && permissionsLoading)
    return (
      <div
        role="status"
        className="flex items-center gap-2 p-8 text-sm text-slate-500"
      >
        <Spinner />
        Loading permissions…
      </div>
    );
  if (permissions && !permissions.some(can))
    return (
      <div className="p-8">
        <h1 className="text-xl font-bold text-slate-800">
          This action is unavailable
        </h1>
        <p className="my-4 text-sm text-slate-500">
          {permissionError ||
            "Your account does not have permission to use this page."}
        </p>
        <Link to="/workspace/dashboard" className="btn-secondary">
          Back to dashboard
        </Link>
      </div>
    );
  return <Outlet />;
}