import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search as SearchIcon,
  ShieldAlert,
  FileText,
  KeyRound,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { searchDocuments, type SearchResult } from "../../api/search.api";
import { errorMessage, stepUpChallenge } from "../../api/http";

type Challenge = { id: string; query: string; demoOtp?: string };

function classificationColor(level?: string) {
  switch (level?.toUpperCase()) {
    case "RESTRICTED":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "CONFIDENTIAL":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "INTERNAL":
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    case "PUBLIC":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    default:
      return "border-white/10 bg-white/5 text-neutral-400";
  }
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuery = challenge?.query ?? query.trim();
    if (!submittedQuery || busy) return;
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const found = await searchDocuments(
        submittedQuery,
        challenge?.id,
        challenge ? otp : undefined,
      );
      setResult(found);
      setChallenge(null);
      setOtp("");
    } catch (err) {
      const details = stepUpChallenge(err);
      if (details?.challenge_id) {
        setChallenge({
          id: details.challenge_id,
          query: submittedQuery,
          demoOtp: details.challenge_otp,
        });
        setOtp("");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setChallenge(null);
    setOtp("");
    setResult(null);
    setError("");
  }

  function copyDocId(id: string) {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <SearchIcon className="h-4 w-4" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Encrypted Content Search
          </h1>
        </div>
        <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
          Query indexed full-text content of encrypted documents with adaptive behavioral risk scoring.
        </p>
      </div>

      {/* Main Search Panel */}
      <form
        onSubmit={submit}
        className="max-w-3xl space-y-5 rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl"
      >
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-300">
            Keywords & Boolean Terms
          </label>
          <div className="relative">
            <input
              className="input-style pl-10 text-sm"
              value={query}
              maxLength={300}
              required
              disabled={busy || !!challenge}
              placeholder="e.g. annual financial audit quarterly projections"
              onChange={(event) => {
                setQuery(event.target.value);
                reset();
              }}
            />
            <SearchIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-500 pointer-events-none" />
          </div>
        </div>

        <p className="text-xs text-neutral-400">
          Scans content text extracted from PDF and DOCX archives. All keywords must match.
          Encrypted filenames and metadata are indexed separately.
        </p>

        {/* Adaptive Step-Up Auth Box */}
        {challenge && (
          <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 text-amber-300">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
              <div className="font-semibold text-xs sm:text-sm">
                Adaptive Risk Alert: Step-Up Authentication Required
              </div>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              Our continuous risk engine detected elevated query velocity or sensitive document access.
              Please confirm your identity with a 6-digit verification code.
            </p>

            {challenge.demoOtp && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span className="text-amber-200">
                  Demo Security OTP: <strong className="font-mono tracking-widest text-white">{challenge.demoOtp}</strong>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-amber-300">
                6-Digit Security Token
              </label>
              <input
                className="input-style max-w-xs font-mono text-base tracking-widest text-center"
                value={otp}
                inputMode="numeric"
                autoComplete="one-time-code"
                minLength={6}
                maxLength={6}
                required
                disabled={busy}
                placeholder="000000"
                onChange={(event) => setOtp(event.target.value)}
              />
            </div>

            <button
              type="button"
              className="text-xs text-neutral-400 underline hover:text-white transition-colors"
              disabled={busy}
              onClick={reset}
            >
              Cancel verification and edit query
            </button>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="btn-primary flex items-center gap-2"
          >
            {busy ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Searching Enclave…</span>
              </>
            ) : challenge ? (
              <>
                <KeyRound className="h-3.5 w-3.5" />
                <span>Verify Token & Search</span>
              </>
            ) : (
              <>
                <SearchIcon className="h-3.5 w-3.5" />
                <span>Run Encrypted Search</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search Results */}
      {result && (
        <section className="space-y-4 max-w-3xl" aria-live="polite">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-white">
              {result.documents.length} Matching {result.documents.length === 1 ? "Document" : "Documents"}
            </h2>
            <Link
              to="/workspace/sharing"
              className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>View All Documents</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {result.has_more && (
            <p className="text-xs text-neutral-400">
              Showing the top 100 results. Refine your query parameters to narrow down matches.
            </p>
          )}

          {result.documents.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#121218] p-8 text-center text-xs text-neutral-400">
              No indexed documents in your authorization scope contain all of these keywords.
            </div>
          )}

          <div className="space-y-3">
            {result.documents.map((doc) => (
              <div
                key={doc.id}
                className="group flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-[#121218] p-4 transition-all hover:border-white/20 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="font-medium text-xs text-white group-hover:text-amber-300 transition-colors break-words">
                      {doc.filename}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classificationColor(
                        doc.classification,
                      )}`}
                    >
                      {doc.classification}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
                      {doc.is_owner ? "Owner" : "Shared"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-neutral-400">
                    <span className="text-neutral-500">ID:</span>
                    <span className="text-neutral-300">{doc.id}</span>
                    <button
                      type="button"
                      onClick={() => copyDocId(doc.id)}
                      className="inline-flex items-center text-neutral-400 hover:text-white transition-colors"
                      title="Copy Document ID"
                    >
                      {copiedId === doc.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <Link
                  to="/workspace/sharing"
                  className="btn-secondary self-start sm:self-center shrink-0 flex items-center gap-1.5 text-[11px]"
                >
                  <span>Open in Documents</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
