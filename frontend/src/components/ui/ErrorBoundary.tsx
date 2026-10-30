import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log component boundary error safely without leaking credentials
    console.error("Securitas Error Boundary caught error:", error.message, errorInfo.componentStack);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#08080a] p-4 text-neutral-200">
          <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#121218] p-8 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h2 className="mt-5 text-xl font-semibold tracking-tight text-white">
              Application Error Encountered
            </h2>

            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
              An unexpected interface error occurred. Session tokens and cryptographic assets remain protected.
            </p>

            {this.state.error && (
              <div className="mt-4 rounded-xl border border-white/5 bg-black/40 p-3 text-left font-mono text-[11px] text-neutral-400 break-all max-h-28 overflow-y-auto no-scrollbar">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="btn-primary inline-flex items-center gap-2 py-2 px-4 text-xs font-semibold"
              >
                <RefreshCw size={13} />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="btn-secondary inline-flex items-center gap-2 py-2 px-4 text-xs font-semibold"
              >
                <Home size={13} />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

