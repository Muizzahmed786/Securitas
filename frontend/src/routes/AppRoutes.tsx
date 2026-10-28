
import { Link, Navigate, Route, Routes } from "react-router-dom";

import Layout from "../components/ui/Layout";
import Auth from "../pages/Auth";
import Dashboard from "../components/admin/Dashboard";
import Upload from "../pages/Upload";
import Signatures from "../components/documents/Signatures";
import Keys from "../pages/Keys";
import Profile from "../components/admin/Profile";
import Landing from "../pages/Landing";
import Sharing from "../components/documents/Sharing";
import Audit from "../pages/Audit";

import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Landing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />

      {/* Redirect legacy URLs to their workspace equivalents. */}
      <Route
        path="/sharing"
        element={<Navigate to="/workspace/sharing" replace />}
      />
      <Route
        path="/documents"
        element={<Navigate to="/workspace/sharing" replace />}
      />
      <Route
        path="/audit"
        element={<Navigate to="/workspace/audit" replace />}
      />
      <Route
        path="/dashboard"
        element={<Navigate to="/workspace/dashboard" replace />}
      />
      <Route
        path="/upload"
        element={<Navigate to="/workspace/upload" replace />}
      />
      <Route
        path="/signatures"
        element={<Navigate to="/workspace/signatures" replace />}
      />
      <Route
        path="/keys"
        element={<Navigate to="/workspace/keys" replace />}
      />
      <Route
        path="/profile"
        element={<Navigate to="/workspace/profile" replace />}
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/workspace" element={<Layout />}>
          <Route
            index
            element={<Navigate to="dashboard" replace />}
          />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="sharing" element={<Sharing />} />

          <Route
            element={
              <ProtectedRoute permissions={["documents.upload"]} />
            }
          >
            <Route path="upload" element={<Upload />} />
          </Route>

          <Route
            element={
              <ProtectedRoute
                permissions={["documents.sign", "documents.verify"]}
              />
            }
          >
            <Route path="signatures" element={<Signatures />} />
          </Route>

          <Route
            element={
              <ProtectedRoute permissions={["crypto_keys.create"]} />
            }
          >
            <Route path="keys" element={<Keys />} />
          </Route>

          <Route
            element={
              <ProtectedRoute permissions={["audit.read"]} />
            }
          >
            <Route path="audit" element={<Audit />} />
          </Route>
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50">
            <h1 className="text-3xl font-bold text-slate-800">
              Page not found
            </h1>

            <Link to="/home" className="btn-primary">
              Back to home
            </Link>
          </div>
        }
      />
    </Routes>
  );
}
