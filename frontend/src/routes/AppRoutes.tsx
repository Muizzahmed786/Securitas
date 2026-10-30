import { Navigate, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

import Landing from "../pages/Landing";
import Login from "../pages/Login";
import Register from "../pages/Register";
import NotFound from "../pages/NotFound";
import Profile from "../pages/Profile";

import ProtectedRoute from "./ProtectedRoute";
import Layout from "../components/ui/Layout";

import AdminDashboard from "../components/admin/Dashboard";
import EncryptionSetup from "../components/admin/EncryptionSetup";
import OwnerDashboard from "../components/owner/Dashboard";
import Upload from "../components/owner/Upload";
import EmployeeDashboard from "../components/employee/Dashboard";
import AdvisorDashboard from "../components/advisor/Dashboard";
import Audit from "../components/advisor/Audit";
import Sharing from "../components/documents/Sharing";
import Signatures from "../components/documents/Signatures";
import Search from "../components/documents/Search";

function DashboardForRole() {
  const { user, permissionsLoading } = useAuth();

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-neutral-400">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121218] px-6 py-4 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span className="text-xs font-medium">Loading workspace…</span>
        </div>
      </div>
    );
  }

  switch (user?.role.toUpperCase()) {
    case "ADMIN":
      return <AdminDashboard />;

    case "OWNER":
    case "DOCUMENT_OWNER":
      return <OwnerDashboard />;

    case "EMPLOYEE":
      return <EmployeeDashboard />;

    case "SECURITY_AUDITOR":
    case "ADVISOR":
      return <AdvisorDashboard />;

    default:
      return (
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-8 text-center text-sm text-neutral-400">
          Your account does not have a recognized role.
        </div>
      );
  }
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated workspace */}
      <Route element={<ProtectedRoute />}>
        <Route path="/workspace" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardForRole />} />
          <Route path="profile" element={<Profile />} />

          {/* Admin feature */}
          <Route
            element={
              <ProtectedRoute permissions={["crypto_keys.create"]} />
            }
          >
            <Route
              path="admin/encryption"
              element={<EncryptionSetup />}
            />
          </Route>

          {/* Owner feature */}
          <Route
            element={
              <ProtectedRoute permissions={["documents.upload"]} />
            }
          >
            <Route path="owner/upload" element={<Upload />} />
          </Route>

          {/* Auditor feature */}
          <Route
            element={
              <ProtectedRoute permissions={["audit.read"]} />
            }
          >
            <Route path="advisor/audit" element={<Audit />} />
          </Route>

          {/* Shared document list */}
          <Route
            element={
              <ProtectedRoute
                permissions={["documents.read", "documents.verify"]}
              />
            }
          >
            <Route path="sharing" element={<Sharing />} />
          </Route>

          {/* Encrypted content search */}
          <Route
            element={
              <ProtectedRoute
                permissions={["documents.search", "documents.read"]}
              />
            }
          >
            <Route path="search" element={<Search />} />
          </Route>

          {/* Shared signing and verification */}
          <Route
            element={
              <ProtectedRoute
                permissions={["documents.sign", "documents.verify"]}
              />
            }
          >
            <Route path="signatures" element={<Signatures />} />
          </Route>

          {/* Keep legacy role URLs working */}
          <Route
            element={<ProtectedRoute allowedRoles={["ADMIN"]} />}
          >
            <Route path="admin" element={<AdminDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["OWNER", "DOCUMENT_OWNER"]}
              />
            }
          >
            <Route path="owner" element={<OwnerDashboard />} />
          </Route>

          <Route
            element={<ProtectedRoute allowedRoles={["EMPLOYEE"]} />}
          >
            <Route path="employee" element={<EmployeeDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                allowedRoles={["SECURITY_AUDITOR", "ADVISOR"]}
              />
            }
          >
            <Route path="advisor" element={<AdvisorDashboard />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
