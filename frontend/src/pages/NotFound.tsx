import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-blue-50 px-4 text-center">
      <h1 className="text-8xl font-bold text-blue-600">404</h1>

      <h2 className="mt-4 text-2xl font-semibold text-slate-800">
        Page not found
      </h2>

      <p className="mt-2 text-slate-500">
        The page you're looking for doesn't exist or may have been moved.
      </p>

      <Link
        to="/home"
        className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
      >
        Back to home
      </Link>
    </div>
  );
}