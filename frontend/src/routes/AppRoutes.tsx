import { Routes, Route, Navigate } from "react-router-dom";

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

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected workspace */}
      <Route element={<ProtectedRoute />}>
        <Route path="/workspace" element={<Layout />}>
          <Route
            index
            element={<Navigate to="dashboard" replace />}
          />

          {/* Redirect to the current user's dashboard */}
          <Route
            path="dashboard"
            element={<Navigate to="/workspace/profile" replace />}
          />

          {/* Shared profile for every authenticated role */}
          <Route path="profile" element={<Profile />} />

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route
              path="admin/encryption"
              element={<EncryptionSetup />}
            />
          </Route>

          {/* Owner routes */}
          <Route element={<ProtectedRoute allowedRoles={["owner"]} />}>
            <Route path="owner" element={<OwnerDashboard />} />
            <Route path="owner/upload" element={<Upload />} />
          </Route>

          {/* Employee routes */}
          <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
            <Route path="employee" element={<EmployeeDashboard />} />
          </Route>

          {/* Advisor routes */}
          <Route element={<ProtectedRoute allowedRoles={["advisor"]} />}>
            <Route path="advisor" element={<AdvisorDashboard />} />
            <Route path="advisor/audit" element={<Audit />} />
          </Route>

          {/* Shared document features */}
          <Route path="sharing" element={<Sharing />} />

          <Route
            element={
              <ProtectedRoute
                permissions={["documents.sign", "documents.verify"]}
              />
            }
          >
            <Route path="signatures" element={<Signatures />} />
          </Route>
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}