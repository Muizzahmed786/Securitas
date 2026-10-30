import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Share2,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Copy,
  Check,
} from "lucide-react";

import { errorMessage } from "../api/http";
import { risk } from "../api/risk";
import {
  rooms,
  roomChallenge,
  type RoomDetails as RoomData,
  type RoomDocument,
} from "../api/rooms";
import { useAuth } from "../context/AuthContext";

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

function formatSize(bytes?: number) {
  if (bytes == null || bytes === 0) return null;
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RoomDetails() {
  const { roomId = "" } = useParams();
  const { user, can } = useAuth();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [owned, setOwned] = useState<RoomDocument[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const [pending, setPending] = useState<{
    doc: RoomDocument;
    challengeId: string;
  } | null>(null);

  const [otp, setOtp] = useState("");

  useEffect(() => {
    let active = true;

    setRoom(null);
    setOwned([]);
    setSelected("");
    setPending(null);
    setError("");
    setNotice("");
    setLoading(true);

    Promise.all([
      rooms.get(roomId),
      rooms.documents(),
    ])
      .then(([details, documents]) => {
        if (!active) return;

        setRoom(details);

        setOwned(
          documents.filter(
            (doc) => String(doc.owner_id) === String(user?.id),
          ),
        );
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [roomId, user?.id]);

  async function share(event: FormEvent) {
    event.preventDefault();

    if (!selected || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await rooms.share(roomId, selected);

      setSelected("");
      setNotice("Document shared.");
      setRoom(await rooms.get(roomId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function download(
    doc: RoomDocument,
    token?: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const blob = await rooms.download(doc.id, token);

      saveFile(blob, doc.filename);

      setPending(null);
      setOtp("");
    } catch (err) {
      const challenge = roomChallenge(err);

      if (challenge) {
        setPending({
          doc,
          challengeId: challenge.id,
        });

        setOtp(challenge.otp);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();

    if (!pending || busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await risk.verifyStepUp(
        pending.challengeId,
        otp.trim(),
      );

      if (!result.step_up_token) {
        throw new Error("Verification did not return a token.");
      }

      await download(pending.doc, result.step_up_token);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleCopyId() {
    if (!room?.id) return;
    navigator.clipboard
      .writeText(room.id)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  const available = owned.filter(
    (doc) =>
      !room?.documents.some(
        (shared) => shared.id === doc.id,
      ),
  );

  return (
    <main className="space-y-6">
      {/* Top Navigation */}
      <div>
        <Link
          to="/workspace/rooms"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-neutral-300 transition hover:border-amber-500/40 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={14} className="text-amber-400" />
          <span>Back to Rooms</span>
        </Link>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Notice / Success Alert */}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-300"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex min-h-[300px] items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#121218] p-12 text-xs text-neutral-400 shadow-xl">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
          <span>Loading room enclave...</span>
        </div>
      )}

      {/* Room Details View */}
      {room && (
        <>
          {/* Header Card */}
          <header className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-xs font-mono font-medium text-amber-400 uppercase">
                    Active Enclave
                  </span>
                  {String(room.owner_id) === String(user?.id) ? (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-400">
                      Host (You)
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-mono text-neutral-400">
                      Member
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-light tracking-tight text-white sm:text-3xl">
                  {room.name}
                </h1>
                <p className="text-xs text-neutral-400">
                  Share this Enclave ID with teammates to grant collaborative access.
                </p>
              </div>

              {/* Room ID with copy button */}
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/60 p-2 sm:p-2.5">
                <div className="flex flex-col px-1">
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    Room ID
                  </span>
                  <code className="select-all font-mono text-xs text-neutral-200">
                    {room.id}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy Room ID"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-neutral-300 transition hover:bg-white/10 hover:text-white"
                >
                  {copied ? (
                    <Check size={14} className="text-emerald-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            </div>

            {/* Security Guarantee callout matching Landing page */}
            <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs">
              <span className="font-semibold text-amber-400">Security Guarantee: </span>
              <span className="text-neutral-300">
                Documents shared within this enclave are protected by envelope encryption (AES-256-GCM / RSA-OAEP). Decryption operations require verified authorization and are audited.
              </span>
            </div>
          </header>

          {/* Share Document Form */}
          {can("documents.share") && (
            <form
              onSubmit={(event) => void share(event)}
              className="space-y-4 rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-400">
                  <Share2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Share Document in Room
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Authorize room members to decrypt and download one of your documents.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="share-document-select"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Select Document from Vault
                </label>
                <select
                  id="share-document-select"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  required
                  className="input-style mt-1.5"
                >
                  <option value="" className="bg-[#121217] text-neutral-400">
                    -- Select a document to share --
                  </option>
                  {available.map((doc) => (
                    <option
                      key={doc.id}
                      value={doc.id}
                      className="bg-[#121217] text-white"
                    >
                      {doc.filename} ({doc.classification})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <p className="text-xs text-neutral-500">
                  Need to share a new file? Upload via your{" "}
                  <Link
                    to="/workspace/owner/upload"
                    className="text-amber-400 underline hover:text-amber-300"
                  >
                    Upload
                  </Link>{" "}
                  page, then return here.
                </p>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !selected}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Sharing...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      <span>Share in Room</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Adaptive Risk Step-Up Challenge Modal / Card */}
          {pending && (
            <form
              onSubmit={(event) => void verify(event)}
              className="space-y-4 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-6 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/20 p-2.5 text-amber-400">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Additional Verification Required
                  </h2>
                  <p className="text-xs text-neutral-300">
                    Adaptive risk evaluation flagged this access attempt. Enter your 6-digit one-time code to proceed with decryption.
                  </p>
                </div>
              </div>

              <div className="max-w-xs">
                <label
                  htmlFor="otp-verification-input"
                  className="block text-xs font-medium text-neutral-300"
                >
                  Verification Code (OTP)
                </label>
                <input
                  id="otp-verification-input"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  placeholder="000000"
                  className="mt-2 block w-full rounded-xl border border-amber-500/40 bg-black/60 px-4 py-2.5 text-center font-mono text-lg tracking-widest text-amber-300 placeholder-neutral-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={busy || !otp.trim()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verify & Download</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setOtp("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Shared Documents Section */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-2 text-amber-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Shared Documents
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Cryptographically protected files available to verified room members.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-mono text-neutral-400">
                  {room.documents.length}{" "}
                  {room.documents.length === 1 ? "document" : "documents"}
                </span>

                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");

                    try {
                      setRoom(await rooms.get(roomId));
                    } catch (err) {
                      setError(errorMessage(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <RefreshCw
                    size={13}
                    className={busy ? "animate-spin" : ""}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {room.documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#121218]/40 p-12 text-center shadow-xl">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-neutral-400">
                  <FileText className="h-6 w-6 text-amber-400/80" />
                </div>
                <h3 className="mt-4 text-sm font-medium text-white">
                  No documents shared yet
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-400">
                  Share an encrypted document from your vault above to allow other members in this room to download it.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {room.documents.map((doc) => (
                  <article
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#121218] p-4 transition hover:border-white/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-neutral-300">
                        <FileText size={20} className="text-amber-400/90" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {doc.filename}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-medium ${classificationColor(
                              doc.classification,
                            )}`}
                          >
                            {doc.classification}
                          </span>
                          {doc.file_size_bytes != null && (
                            <span className="font-mono text-[11px] text-neutral-400">
                              {formatSize(doc.file_size_bytes)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {can("documents.download") && (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busy}
                        onClick={() => void download(doc)}
                      >
                        <Download size={14} className="text-amber-400" />
                        <span>Download & Decrypt</span>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
