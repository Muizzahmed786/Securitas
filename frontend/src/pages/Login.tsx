import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
    <main className="mx-auto max-w-md p-6">
      <Link to="/home" className="underline">Securitas</Link>
      <h1 className="my-4 text-2xl font-bold">Welcome Back</h1>
      <p className="mb-4">Sign in to access your secure document workspace.</p>

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
            placeholder="Enter your password"
            autoComplete="current-password"
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

        <button type="submit" disabled={busy} className="block w-full border p-2">
          {busy ? "Please wait…" : "Sign in"}
        </button>

        <p>
          Don't have an account?{" "}
          <Link
            to="/register"
            className="underline"
            onClick={() => {
              clearMessages();
              setPassword("");
            }}
          >
            Sign up
          </Link>
        </p>
      </form>

      <p className="mt-6 text-sm">Securitas · Secure document management</p>
    </main>
  );
}
