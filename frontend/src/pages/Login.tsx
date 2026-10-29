import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import { auth, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function clearMessages() {
    setError("");
  }

  async function handleSignOut() {
    clearMessages();
    try {
      await auth.logout();
      setUser(null);
      setPassword("");
    } catch {
      setError("Sign-out request failed. Please try again.");
    }
  }

  async function submit() {
    setBusy(true);
    clearMessages();

    try {
      if (new TextEncoder().encode(password).length > 72) {
        throw new Error("Password must not exceed 72 UTF-8 bytes.");
      }

      const loggedInUser = await auth.login(email, password);
      setUser(loggedInUser);
      navigate("/workspace/dashboard");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#08080a] px-4 py-12 text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(217, 119, 6, 0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      <main className="relative w-full max-w-md">
        {/* Card Container */}
        <div className="rounded-2xl border border-white/10 bg-[#121218]/90 p-8 shadow-2xl backdrop-blur-xl">
          {/* Header Brand */}
          <div className="text-center">
            <Link
              to="/home"
              className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.25em] text-white uppercase transition hover:opacity-90"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400">
                <Shield className="h-4 w-4" />
              </span>
              securitas
            </Link>
            <h1 className="mt-5 text-2xl font-light tracking-tight text-white">
              Sign in to <span className="font-semibold">Vault</span>
            </h1>
            <p className="mt-2 text-xs text-neutral-400">
              Zero-knowledge envelope encryption & cryptographic verification.
            </p>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {user && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300 space-y-2">
                <p>
                  Already signed in as: <strong>{user.email}</strong> ({user.role})
                </p>
                <div className="flex gap-2 pt-1">
                  <Link
                    to="/workspace/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 font-semibold text-black hover:bg-amber-400"
                  >
                    <span>Dashboard</span>
                    <ArrowRight size={12} />
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-full border border-amber-500/40 px-3 py-1 text-amber-300 hover:bg-amber-500/20"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
                <AlertCircle size={15} className="shrink-0 text-red-400" />
                <p role="alert">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="field-label flex items-center gap-1.5">
                <Mail size={13} className="text-amber-400/80" />
                <span>Email address</span>
              </label>
              <input
                className="input-style"
                type="email"
                placeholder="auditor@enterprise.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="field-label flex items-center gap-1.5">
                  <Lock size={13} className="text-amber-400/80" />
                  <span>Password</span>
                </label>
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                  <span>{showPassword ? "Hide" : "Show"}</span>
                </button>
              </div>
              <input
                className="input-style"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full justify-center py-3 text-xs tracking-wider uppercase font-semibold disabled:opacity-50"
            >
              {busy ? "Authenticating…" : "Unlock Vault"}
            </button>

            <div className="pt-2 text-center text-xs text-neutral-400">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-medium text-amber-400 hover:text-amber-300 underline underline-offset-4"
                onClick={() => {
                  clearMessages();
                  setPassword("");
                }}
              >
                Register Tenant
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px] text-neutral-600">
          Securitas · Cryptographic Zero-Trust Architecture
        </p>
      </main>
    </div>
  );
}
