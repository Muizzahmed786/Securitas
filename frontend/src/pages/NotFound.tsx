import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#08080a] px-4 text-center text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
          style={{
            background: "radial-gradient(circle, rgba(217, 119, 6, 0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative max-w-md space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
          <Shield className="h-6 w-6" />
        </div>

        <h1 className="font-mono text-7xl font-light text-white tracking-widest sm:text-8xl">
          4<span className="text-amber-400">0</span>4
        </h1>

        <h2 className="text-xl font-medium text-white">
          Cryptographic Path Not Found
        </h2>

        <p className="text-xs text-neutral-400">
          The requested resource does not exist in this tenant's index or has been securely shredded.
        </p>

        <div className="pt-4">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-semibold text-black transition hover:bg-neutral-200"
          >
            <ArrowLeft size={14} />
            <span>Return to Vault</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
