import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, ArrowRight, LogOut } from "lucide-react";
import { auth, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, Spinner } from "../components/UI";

export default function Auth({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(4); // Default to Security Auditor for quick access
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await auth.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (new TextEncoder().encode(password).length > 72)
        throw new Error("Password must not exceed 72 UTF-8 bytes.");
      if (register) {
        await auth.register(email, password, role);
        setPassword("");
        setNotice("Account created successfully! You can now sign in.");
        // Clear previous user session if any
        setUser(null);
        navigate("/login");
      } else {
        const loggedInUser = await auth.login(email, password);
        setUser(loggedInUser);
        navigate("/workspace/dashboard");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/home"
          className="mb-7 flex items-center justify-center gap-3 text-xl font-bold text-slate-800"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <ShieldCheck size={23} />
          </span>
          Securitas
        </Link>

        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-blue-100 bg-white p-8 shadow-xl"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-800">
              {register ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {register
                ? "Register a new secure workspace account."
                : "Sign in to access your secure document workspace."}
            </p>
          </div>

          {/* ACTIVE SESSION BANNER WITH 1-CLICK SWITCH ACCOUNT */}
          {user && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
              <p className="font-semibold text-slate-800">
                You are currently signed in as:
              </p>
              <p className="mt-0.5 font-bold text-blue-700 truncate">
                {user.email} <span className="font-semibold text-slate-600">({user.role})</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  to="/workspace/dashboard"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Continue to Workspace
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          <Alert message={error} />
          <Alert message={notice} success />

          <label className="field-label">
            Email address
            <input
              className="input-style"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field-label">
            Password
            <div className="relative">
              <input
                className="input-style pr-12"
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 8 characters"
                autoComplete={register ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 hover:text-blue-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {register && (
            <label className="field-label">
              Select Workspace Role
              <select
                className="input-style font-medium text-slate-800"
                value={role}
                onChange={(e) => setRole(Number(e.target.value))}
              >
                <option value={4}>Security Auditor (Auditor Dashboard & Risk Telemetry)</option>
                <option value={2}>Document Owner (Upload, Encrypt, Share & Sign)</option>
                <option value={3}>Employee (Read, Download & Verify)</option>
                <option value={1}>Administrator (Full Access & Policies)</option>
              </select>
            </label>
          )}

          <button disabled={busy} className="btn-primary w-full">
            {busy ? <Spinner /> : <ArrowRight size={17} />}
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-500">
            {register ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link
              to={register ? "/login" : "/register"}
              onClick={() => {
                setError("");
                setNotice("");
                setPassword("");
              }}
              className="font-medium text-blue-600 hover:text-blue-700 underline"
            >
              {register ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          Securitas · Secure document management
        </p>
      </div>
    </div>
  );
}
