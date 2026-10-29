import { useEffect, useState, type FormEvent } from "react";
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

  const button = "rounded border px-3 py-2 text-sm disabled:opacity-50";
  const input = "w-full rounded border px-3 py-2";
  const panel = "rounded-lg border bg-white p-5";

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
    return canDownload && (isOwner(doc) || doc.permission === "DOWNLOAD");
  }

  async function accessFile(doc: DocumentItem, action: FileAction, token?: string) {
    if (action === "download") {
      const blob = await documents.download(doc.id, token);
      saveBlob(blob, doc.filename);
      setMessage(`Downloaded ${doc.filename}.`);
      return;
    }

    const blob = await documents.view(doc.id, token);
    setPreview({ doc, url: URL.createObjectURL(blob) });
  }

  async function openFile(doc: DocumentItem, action: FileAction) {
    clearMessages();
    setBusy(`${action}-${doc.id}`);

    try {
      await accessFile(doc, action);
    } catch (err) {
      const challenge = stepUpChallenge(err);

      if (challenge?.challenge_id) {
        setPending({
          doc,
          action,
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
      const { step_up_token } = await risk.verifyStepUp(
        pending.challengeId,
        otp.trim(),
      );
      await accessFile(pending.doc, pending.action, step_up_token);
      setPending(null);
      setOtp("");
    } catch (err) {
      setStepUpError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function downloadEncrypted(doc: DocumentItem) {
    clearMessages();
    setBusy(`encrypted-${doc.id}`);

    try {
      saveBlob(await documents.downloadEncrypted(doc.id), `${doc.filename}.enc`);
      setMessage(`Downloaded encrypted copy of ${doc.filename}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
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

  async function openSharing(doc: DocumentItem) {
    clearMessages();
    setSharingDoc(doc);
    setShares([]);
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

      setShares(await sharing.list(sharingDoc.id));
      setRecipientEmail("");
      setExpiresAt("");
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
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Documents & Sharing</h1>
          <p className="text-sm text-slate-500">
            Access documents, manage shares, and verify integrity.
          </p>
        </div>
        <button
          type="button"
          className={button}
          disabled={loading}
          onClick={() => void loadDocuments()}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {message && <p role="status" className="text-green-700">{message}</p>}

      {loading ? (
        <p>Loading documents…</p>
      ) : docList.length === 0 ? (
        <p>No accessible documents found.</p>
      ) : (
        <div className="space-y-3">
          {docList.map((doc) => (
            <section key={doc.id} className={panel}>
              <h2 className="break-all font-semibold">{doc.filename}</h2>
              <p className="mt-1 break-all text-xs text-slate-500">
                ID: {doc.id}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {doc.classification} · {formatSize(doc.file_size_bytes)}
                {" · "}{formatDate(doc.created_at)}
                {" · "}{doc.permission ?? "Accessible"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
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
                    Download
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
                      Verify
                    </button>
                    <button
                      type="button"
                      className={button}
                      disabled={Boolean(busy)}
                      onClick={() => void downloadEncrypted(doc)}
                    >
                      Download encrypted
                    </button>
                  </>
                )}

                {isOwner(doc) && canShare && (
                  <button
                    type="button"
                    className={button}
                    disabled={Boolean(busy)}
                    onClick={() => void openSharing(doc)}
                  >
                    Manage sharing
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {preview && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Document preview">
          <div className="mb-3 flex justify-between gap-3">
            <h2 className="font-semibold">{preview.doc.filename}</h2>
            <button type="button" className={button} onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
          <iframe
            title={`Preview of ${preview.doc.filename}`}
            src={preview.url}
            className="h-[70vh] w-full border"
          />
        </section>
      )}

      {verified && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Verification results">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">Verification: {verified.doc.filename}</h2>
            <button type="button" className={button} onClick={() => setVerified(null)}>
              Close
            </button>
          </div>

          <p className="mt-3">
            Document integrity:{" "}
            <strong>
              {verified.result.document_integrity_valid ? "Valid" : "Failed"}
            </strong>
          </p>
          <p className="mt-1 text-sm">
            SHA-256: {verified.result.content_hash}
          </p>

          {!verified.result.has_signatures && (
            <p className="mt-3">No signatures recorded.</p>
          )}

          {verified.result.signatures.map((signature) => (
            <div key={signature.id} className="mt-3 rounded border p-3 text-sm">
              <p>
                Signature:{" "}
                <strong>
                  {signature.cryptographically_valid ? "Valid" : "Invalid"}
                </strong>
              </p>
              <p>Signer ID: {signature.signer_id}</p>
              <p>Key status: {signature.key_status}</p>
              {!signature.key_usable_now && (
                <p className="text-amber-700">
                  This key cannot be used for new signatures.
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {sharingDoc && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Manage sharing">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">Sharing: {sharingDoc.filename}</h2>
            <button
              type="button"
              className={button}
              disabled={Boolean(busy)}
              onClick={() => setSharingDoc(null)}
            >
              Close
            </button>
          </div>

          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={grantAccess}>
            <label className="space-y-1 text-sm">
              <span>Recipient email</span>
              <input
                className={input}
                type="email"
                required
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Permission</span>
              <select
                className={input}
                value={permission}
                onChange={(event) =>
                  setPermission(event.target.value as "READ" | "DOWNLOAD")
                }
              >
                <option value="READ">Read</option>
                <option value="DOWNLOAD">Download</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span>Expires at (optional)</span>
              <input
                className={input}
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </label>

            <div className="flex items-end">
              <button className={button} disabled={Boolean(busy)}>
                {busy === "share" ? "Sharing…" : "Grant access"}
              </button>
            </div>
          </form>

          <h3 className="mt-6 font-semibold">Access grants</h3>
          {busy === "shares" && <p>Loading grants…</p>}
          {shares.length === 0 && busy !== "shares" && (
            <p className="mt-2 text-sm text-slate-500">No grants found.</p>
          )}

          <div className="mt-2 space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
                <div>
                  <p>{share.recipient_email} · {share.permission}</p>
                  <p className="text-slate-500">
                    {share.status} · Expires: {formatDate(share.expires_at)}
                  </p>
                </div>

                {canRevoke && share.status === "ACTIVE" && (
                  <button
                    type="button"
                    className={button}
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

      {pending && (
        <section className={panel} role="dialog" aria-modal="true" aria-label="Step-up verification">
          <h2 className="font-semibold">Verify your identity</h2>
          <p className="mt-2 text-sm">
            Enter the one-time code to {pending.action} {pending.doc.filename}.
          </p>

          {pending.demoOtp && (
            <p className="mt-2 text-sm text-amber-700">
              Demo code supplied by the current backend: {pending.demoOtp}
            </p>
          )}

          {stepUpError && (
            <p role="alert" className="mt-2 text-red-700">{stepUpError}</p>
          )}

          <form className="mt-4 flex flex-wrap gap-2" onSubmit={verifyOtp}>
            <input
              className={input}
              aria-label="One-time code"
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
            <button className={button} disabled={busy === "otp"}>
              {busy === "otp" ? "Verifying…" : "Verify and continue"}
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