import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(2);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function clearMessages() {
    setError("");
    setNotice("");
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

      await auth.register(email, password, role);
      setPassword("");
      setNotice("Account created. You can now sign in.");
      navigate("/login");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Link to="/home" className="underline">Securitas</Link>
      <h1 className="my-4 text-2xl font-bold">Create Account</h1>
      <p className="mb-4">Your secure document workspace starts here.</p>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {user && (
          <div className="space-y-2 border p-3">
            <p>You are currently signed in as: {user.email} ({user.role})</p>
            <Link to="/workspace/dashboard" className="block underline">
              Continue to Workspace
            </Link>
            <button type="button" onClick={handleSignOut} className="border px-3 py-2">
              Sign Out
            </button>
          </div>
        )}

        {error && <p role="alert" className="text-red-700">{error}</p>}

        {notice && <p role="status">{notice}</p>}

        <label className="block">
          Email address
          <input
            className="mt-1 block w-full border p-2"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block">
          Password
          <input
            className="mt-1 block w-full border p-2"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button
          type="button"
          aria-pressed={showPassword}
          onClick={() => setShowPassword(!showPassword)}
          className="underline"
        >
          {showPassword ? "Hide password" : "Show password"}
        </button>

        <label className="block">
          Select Workspace Role
          <select
            className="mt-1 block w-full border p-2"
            value={role}
            onChange={(event) => setRole(Number(event.target.value))}
          >
            <option value={2}>Document Owner</option>
            <option value={3}>Employee</option>
            <option value={4}>Security Auditor</option>
            <option value={1}>Administrator</option>
          </select>
        </label>

        <button type="submit" disabled={busy} className="block w-full border p-2">
          {busy ? "Please wait…" : "Create account"}
        </button>

        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            className="underline"
            onClick={() => {
              clearMessages();
              setPassword("");
            }}
          >
            Sign in
          </Link>
        </p>
      </form>

      <p className="mt-6 text-sm">Securitas · Secure document management</p>
    </main>
  );
}
