import { useEffect, useState, type FormEvent } from "react";
import { FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { documents, saveBlob, type DocumentItem, type DocumentVerification } from "../../api/documents";
import { sharing, type DocumentShare } from "../../api/sharing";
import { risk } from "../../api/risk";
import { errorMessage, stepUpChallenge } from "../../api/http";
import { useAuth } from "../../context/AuthContext";

type FileAction = "view" | "download";

type PendingAccess = {
  doc: DocumentItem;
  action: FileAction;
  challengeId: string;
  demoOtp?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatSize(bytes?: number) {
  if (bytes == null) return "—";
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function Sharing() {
  const { user, can } = useAuth();

  const [docList, setDocList] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState<{ doc: DocumentItem; url: string } | null>(null);
  const [verified, setVerified] = useState<{
    doc: DocumentItem;
    result: DocumentVerification;
  } | null>(null);

  const [sharingDoc, setSharingDoc] = useState<DocumentItem | null>(null);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [permission, setPermission] = useState<"READ" | "DOWNLOAD">("READ");
  const [expiresAt, setExpiresAt] = useState("");

  const [pending, setPending] = useState<PendingAccess | null>(null);
  const [otp, setOtp] = useState("");
  const [stepUpError, setStepUpError] = useState("");

  const canRead = can("documents.read");
  const canDownload = can("documents.download");
  const canVerify = can("documents.verify");
  const canShare = can("documents.share");
  const canRevoke = can("documents.revoke");

  const button = "btn-secondary text-xs disabled:opacity-40";
  const input = "input-style text-xs";
  const panel = "rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-4";

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  async function loadDocuments() {
    setLoading(true);
    setError("");

    try {
      setDocList(await documents.list());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function clearMessages() {
    setError("");
    setMessage("");
  }

  function isOwner(doc: DocumentItem) {
    return doc.is_owner === true || String(doc.owner_id) === String(user?.id);
  }

  function mayRead(doc: DocumentItem) {
    return (
      canRead &&
      (isOwner(doc) ||
        doc.permission === "READ" ||
        doc.permission === "DOWNLOAD")
    );
  }

  function mayDownload(doc: DocumentItem) {
    return (
      canDownload &&
      (isOwner(doc) || doc.permission === "DOWNLOAD")
    );
  }

  async function openFile(doc: DocumentItem, fileAction: FileAction, stepUpToken?: string) {
    clearMessages();
    setBusy(`${fileAction}-${doc.id}`);

    try {
      const blob =
        fileAction === "view"
          ? await documents.view(doc.id, stepUpToken)
          : await documents.download(doc.id, stepUpToken);

      if (fileAction === "view") {
        if (preview) URL.revokeObjectURL(preview.url);
        const url = URL.createObjectURL(blob);
        setPreview({ doc, url });
      } else {
        saveBlob(blob, doc.filename);
        setMessage(`Downloaded ${doc.filename}.`);
      }

      setPending(null);
      setOtp("");
      setStepUpError("");
    } catch (err) {
      const challenge = stepUpChallenge(err);
      if (challenge && challenge.challenge_id) {
        setPending({
          doc,
          action: fileAction,
          challengeId: challenge.challenge_id,
          demoOtp: challenge.challenge_otp,
        });
        setOtp("");
        setStepUpError("");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy("");
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;

    setBusy("otp");
    setStepUpError("");

    try {
      const { step_up_token } = await risk.verifyStepUp(pending.challengeId, otp.trim());
      await openFile(pending.doc, pending.action, step_up_token);
    } catch (err) {
      setStepUpError(errorMessage(err));
      setBusy("");
    }
  }

  async function verifyDocument(doc: DocumentItem) {
    clearMessages();
    setBusy(`verify-${doc.id}`);

    try {
      setVerified({ doc, result: await documents.verify(doc.id) });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function downloadEncrypted(doc: DocumentItem) {
    clearMessages();
    setBusy(`encrypted-${doc.id}`);

    try {
      const blob = await documents.downloadEncrypted(doc.id);
      saveBlob(blob, `${doc.filename}.enc`);
      setMessage(`Downloaded encrypted payload for ${doc.filename}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function openSharing(doc: DocumentItem) {
    clearMessages();
    setSharingDoc(doc);
    setRecipientEmail("");
    setPermission("READ");
    setExpiresAt("");
    setBusy("shares");

    try {
      setShares(await sharing.list(doc.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function grantAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sharingDoc) return;

    clearMessages();
    setBusy("share");

    try {
      await sharing.create(sharingDoc.id, {
        recipient_email: recipientEmail.trim(),
        permission,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      setRecipientEmail("");
      setExpiresAt("");
      setShares(await sharing.list(sharingDoc.id));
      setMessage("Document access granted.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function revokeAccess(share: DocumentShare) {
    if (!sharingDoc) return;

    clearMessages();
    setBusy(`revoke-${share.id}`);

    try {
      await sharing.revoke(sharingDoc.id, share.id);
      setShares(await sharing.list(sharingDoc.id));
      setMessage("Document access revoked.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
            Cryptographic Vault
          </p>
          <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
            Documents & Sharing
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Access encrypted files, grant revocable time-bounded access, and verify mathematical integrity.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs flex items-center gap-1.5"
          disabled={loading}
          onClick={() => void loadDocuments()}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>{loading ? "Loading…" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <p role="alert">{error}</p>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <p role="status">{message}</p>
        </div>
      )}

      {loading ? (
        <p className="py-8 text-center text-xs text-neutral-400">Loading vault documents…</p>
      ) : docList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-neutral-500">
          <FileText size={32} className="mx-auto text-neutral-600 mb-3" />
          <p className="text-sm">No accessible documents found in this vault.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {docList.map((doc) => (
            <section key={doc.id} className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl transition hover:border-white/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="break-all text-base font-semibold text-white">{doc.filename}</h2>
                  <p className="mt-1 font-mono text-[10px] text-amber-400/80">
                    ID: {doc.id}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase ${classificationColor(doc.classification)}`}>
                  {doc.classification}
                </span>
              </div>

              <p className="mt-3 text-xs text-neutral-400">
                {formatSize(doc.file_size_bytes)} · {formatDate(doc.created_at)} ·{" "}
                <span className="text-neutral-200">{doc.permission ?? "Accessible"}</span>
              </p>

              <div className="mt-5 flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
                {mayRead(doc) && doc.mime_type === "application/pdf" && (
                  <button
                    type="button"
                    className={button}
                    disabled={Boolean(busy)}
                    onClick={() => void openFile(doc, "view")}
                  >
                    View PDF
                  </button>
                )}

                {mayDownload(doc) && (
                  <button
                    type="button"
                    className={button}
                    disabled={Boolean(busy)}
                    onClick={() => void openFile(doc, "download")}
                  >
                    Download Decrypted
                  </button>
                )}

                {canVerify && (
                  <>
                    <button
                      type="button"
                      className={button}
                      disabled={Boolean(busy)}
                      onClick={() => void verifyDocument(doc)}
                    >
                      Verify Integrity
                    </button>
                    <button
                      type="button"
                      className={button}
                      disabled={Boolean(busy)}
                      onClick={() => void downloadEncrypted(doc)}
                    >
                      Download Ciphertext (.enc)
                    </button>
                  </>
                )}

                {isOwner(doc) && canShare && (
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={Boolean(busy)}
                    onClick={() => void openSharing(doc)}
                  >
                    Manage Access Grants
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Document preview">
          <div className="flex justify-between items-center gap-3 border-b border-white/[0.08] pb-3">
            <h2 className="font-semibold text-white text-sm">{preview.doc.filename}</h2>
            <button type="button" className={button} onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          <iframe
            title={`Preview of ${preview.doc.filename}`}
            src={preview.url}
            className="h-[70vh] w-full rounded-xl border border-white/10 bg-black/60"
          />
        </section>
      )}

      {/* Verification Result Dialog */}
      {verified && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Verification results">
          <div className="flex justify-between items-center gap-3 border-b border-white/[0.08] pb-3">
            <h2 className="font-semibold text-white text-sm">
              Verification: {verified.doc.filename}
            </h2>
            <button type="button" className={button} onClick={() => setVerified(null)}>
              Close
            </button>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-black/40 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span>Cryptographic Integrity:</span>
              <strong className={verified.result.document_integrity_valid ? "text-emerald-400 font-mono" : "text-red-400 font-mono"}>
                {verified.result.document_integrity_valid ? "VALID (0-Bit Tampering Detected)" : "FAILED (Integrity Compromised)"}
              </strong>
            </div>
            <p className="font-mono text-[11px] text-neutral-400 break-all">
              SHA-256 Digest: <span className="text-amber-300">{verified.result.content_hash}</span>
            </p>
          </div>

          {!verified.result.has_signatures && (
            <p className="text-xs text-neutral-400">No cryptographic digital signatures recorded on this file.</p>
          )}

          {verified.result.signatures.map((signature) => (
            <div key={signature.id} className="rounded-xl border border-white/[0.08] bg-black/40 p-4 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-white">Signer ID: {signature.signer_id}</span>
                <span className={signature.cryptographically_valid ? "font-mono text-emerald-400" : "font-mono text-red-400"}>
                  {signature.cryptographically_valid ? "RSA-PSS VALID" : "INVALID SIGNATURE"}
                </span>
              </div>
              <p className="text-neutral-400 font-mono text-[10px]">Key Status: {signature.key_status}</p>
              {!signature.key_usable_now && (
                <p className="text-amber-400 text-[11px]">
                  Note: This key has been retired or revoked for subsequent signing.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Sharing Management Modal */}
      {sharingDoc && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Manage sharing">
          <div className="flex justify-between items-center gap-3 border-b border-white/[0.08] pb-3">
            <h2 className="font-semibold text-white text-sm">
              Grant Time-Bounded Access: {sharingDoc.filename}
            </h2>
            <button
              type="button"
              className={button}
              disabled={Boolean(busy)}
              onClick={() => setSharingDoc(null)}
            >
              Close
            </button>
          </div>

          <form className="grid gap-3 sm:grid-cols-2 rounded-xl border border-white/[0.08] bg-black/40 p-4" onSubmit={grantAccess}>
            <div className="space-y-1">
              <label className="field-label">Recipient User Email</label>
              <input
                className={input}
                type="email"
                required
                placeholder="colleague@tenant.com"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">Permission Level</label>
              <select
                className={input}
                value={permission}
                onChange={(event) =>
                  setPermission(event.target.value as "READ" | "DOWNLOAD")
                }
              >
                <option value="READ">READ (In-Browser Decryption)</option>
                <option value="DOWNLOAD">DOWNLOAD (Save Local File)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="field-label">Expiration Date & Time (Optional)</label>
              <input
                className={input}
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </div>

            <div className="flex items-end">
              <button className="btn-primary text-xs w-full justify-center" disabled={Boolean(busy)}>
                {busy === "share" ? "Enforcing Share…" : "Grant Cryptographic Access"}
              </button>
            </div>
          </form>

          <h3 className="font-semibold text-white text-xs uppercase tracking-wider pt-2">
            Existing Access Grants
          </h3>
          {busy === "shares" && <p className="text-xs text-neutral-400">Loading active grants…</p>}
          {shares.length === 0 && busy !== "shares" && (
            <p className="text-xs text-neutral-500">No active access grants found for this document.</p>
          )}

          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/40 p-3.5 text-xs">
                <div>
                  <p className="font-medium text-white">{share.recipient_email} · <span className="font-mono text-amber-400">{share.permission}</span></p>
                  <p className="text-neutral-500 text-[11px]">
                    Status: {share.status} · Expires: {formatDate(share.expires_at)}
                  </p>
                </div>

                {canRevoke && share.status === "ACTIVE" && (
                  <button
                    type="button"
                    className="btn-secondary text-xs text-red-400 hover:text-red-300 border-red-500/30"
                    disabled={Boolean(busy)}
                    onClick={() => void revokeAccess(share)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step-Up Challenge Dialog */}
      {pending && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Step-up verification">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">Adaptive Step-Up Verification</h2>
            <p className="text-xs text-neutral-400">
              The real-time risk scorer detected an anomaly on this operation. Enter your 6-digit one-time code to {pending.action} <strong className="text-white">{pending.doc.filename}</strong>.
            </p>
          </div>

          {pending.demoOtp && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 font-mono">
              Demo Code: <span className="font-bold select-all text-white">{pending.demoOtp}</span>
            </div>
          )}

          {stepUpError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle size={14} className="shrink-0 text-red-400" />
              <p role="alert">{stepUpError}</p>
            </div>
          )}

          <form className="flex flex-wrap gap-2.5" onSubmit={verifyOtp}>
            <input
              className="input-style text-center font-mono tracking-widest text-base max-w-44"
              aria-label="One-time code"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="••••••"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
            <button className="btn-primary text-xs" disabled={busy === "otp"}>
              {busy === "otp" ? "Verifying…" : "Verify and Continue"}
            </button>
            <button
              type="button"
              className={button}
              disabled={busy === "otp"}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
