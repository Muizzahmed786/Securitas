import { Navigate, Route, Routes, Link } from "react-router-dom";
import Layout from "../components/Layout";
import Auth from "../pages/Auth";
import Dashboard from "../pages/Dashboard";
import Upload from "../pages/Upload";
import Signatures from "../pages/Signatures";
import Keys from "../pages/Keys";
import Profile from "../pages/Profile";
import Landing from "../pages/Landing";
import ProtectedRoute from "./ProtectedRoute";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Landing />} />
      <Route path="/login" element={<Auth />} />
      <Route path="/register" element={<Auth register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/workspace" element={<Layout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route
            element={<ProtectedRoute permissions={["documents.upload"]} />}
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
            element={<ProtectedRoute permissions={["crypto_keys.create"]} />}
          >
            <Route path="keys" element={<Keys />} />
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
