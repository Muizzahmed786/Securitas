import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { searchDocuments, type SearchResult } from "../../api/search.api";
import { errorMessage, stepUpChallenge } from "../../api/http";

type Challenge = { id: string; query: string; demoOtp?: string };

export default function Search() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedQuery = challenge?.query ?? query.trim();
    if (!submittedQuery || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const found = await searchDocuments(submittedQuery, challenge?.id, challenge ? otp : undefined);
      setResult(found);
      setChallenge(null);
      setOtp("");
    } catch (err) {
      const details = stepUpChallenge(err);
      if (details?.challenge_id) {
        setChallenge({ id: details.challenge_id, query: submittedQuery, demoOtp: details.challenge_otp });
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

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search document contents</h1>
        <p className="mt-2 text-sm text-slate-600">
          Find documents you own or can currently access. All entered words must occur
          in the content; capitalization does not matter.
        </p>
      </div>
      <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-lg border bg-white p-5">
        <label className="block space-y-2">
          <span className="font-medium">Keywords</span>
          <input className="w-full rounded border px-3 py-2" value={query}
            maxLength={300} required disabled={busy || !!challenge}
            placeholder="For example: annual budget"
            onChange={(event) => { setQuery(event.target.value); reset(); }} />
        </label>
        <p className="text-sm text-slate-500">
          Searches indexed text from PDF and DOCX files. Filenames are not searched.
          Scanned PDFs without text, legacy DOC files and failed indexes are excluded.
        </p>
        {challenge && (
          <div className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4">
            <p>Additional verification is required for this search.</p>
            {challenge.demoOtp && (
              <p className="font-mono">Demo verification code: {challenge.demoOtp}</p>
            )}
            <label className="block space-y-2">
              <span>Six-digit verification code</span>
              <input className="w-full rounded border bg-white px-3 py-2" value={otp}
                inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6}
                required disabled={busy} onChange={(event) => setOtp(event.target.value)} />
            </label>
            <button type="button" className="underline" disabled={busy} onClick={reset}>
              Cancel verification and start another search
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy || !query.trim()} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Searching…" : challenge ? "Verify and search" : "Search"}
        </button>
      </form>
      {result && (
        <section className="space-y-4" aria-live="polite">
          <h2 className="text-lg font-semibold">{result.documents.length} matching documents</h2>
          {result.has_more && <p>Showing the newest 100 matches. Add keywords to narrow your search.</p>}
          {result.documents.length === 0 && <p>No indexed documents accessible to you contain all these words.</p>}
          <ul className="space-y-3">
            {result.documents.map((doc) => (
              <li key={doc.id} className="space-y-2 rounded-lg border bg-white p-4">
                <p className="break-words font-semibold">{doc.filename}</p>
                <p className="text-sm text-slate-600">{doc.classification} · {doc.is_owner ? "Owned by you" : "Shared with you"}</p>
                <p className="break-all text-xs text-slate-500">Document ID: {doc.id}</p>
                <p className="text-sm">Use this ID in Documents to view or download with the existing access checks.</p>
              </li>
            ))}
          </ul>
          <Link to="/workspace/sharing" className="inline-block text-blue-700 underline">Open Documents</Link>
        </section>
      )}
    </main>
  );
}
