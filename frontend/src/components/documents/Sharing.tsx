import { useEffect, useState } from "react";

import {
  documents,
  signatures,
  risk,
  errorMessage,
  saveBlob,
  type DocumentItem,
  type DocumentShare,
  type Verification,
} from "../../api/client";
import { useAuth } from "../../context/AuthContext";


export default function Sharing() {
  const { user, can } = useAuth();
  const [docList, setDocList] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sharing Modal State
  const [sharingDoc, setSharingDoc] = useState<DocumentItem | null>(null);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sharePermission, setSharePermission] = useState<"READ" | "DOWNLOAD">("DOWNLOAD");
  const [expiresAt, setExpiresAt] = useState("");
  const [submittingShare, setSubmittingShare] = useState(false);

  // Document Reader / Preview Modal State
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null);
  const [viewBlobUrl, setViewBlobUrl] = useState<string | null>(null);
  const [viewTextContent, setViewTextContent] = useState<string | null>(null);
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);

  // Signature Verification Modal State
  const [verifyModalDoc, setVerifyModalDoc] = useState<DocumentItem | null>(null);
  const [verificationResult, setVerificationResult] = useState<Verification | null>(null);
  const [loadingVerifyId, setLoadingVerifyId] = useState<string | null>(null);
  const [downloadingEncryptedId, setDownloadingEncryptedId] = useState<string | null>(null);

  // Step-Up Auth Modal State
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"download" | "view">("download");
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [pendingFilename, setPendingFilename] = useState<string>("");
  const [challengeId, setChallengeId] = useState<string>("");
  const [riskScore, setRiskScore] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<string>("");
  const [riskReason, setRiskReason] = useState<string>("");
  const [otpInput, setOtpInput] = useState<string>("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [stepUpError, setStepUpError] = useState("");

  const canShare = can("documents.share");
  const canVerify = can("documents.verify");

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const data = await documents.list();
      setDocList(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function openSharingModal(doc: DocumentItem) {
    setSharingDoc(doc);
    setShares([]);
    setLoadingShares(true);
    setRecipientEmail("");
    setExpiresAt("");
    try {
      const activeShares = await documents.shares(doc.id);
      setShares(activeShares);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingShares(false);
    }
  }

  async function handleGrantShare() {
    if (!sharingDoc || !recipientEmail.trim()) return;

    setSubmittingShare(true);
    setError("");
    setSuccess("");
    try {
      let expIso = null;
      if (expiresAt) {
        expIso = new Date(expiresAt).toISOString();
      }
      await documents.share(sharingDoc.id, recipientEmail.trim(), sharePermission, expIso);
      setSuccess(`Access granted to ${recipientEmail} (${sharePermission})`);
      setRecipientEmail("");
      setExpiresAt("");
      const updated = await documents.shares(sharingDoc.id);
      setShares(updated);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmittingShare(false);
    }
  }

  async function handleRevoke(share: DocumentShare) {
    if (!sharingDoc) return;
    setError("");
    setSuccess("");
    try {
      await documents.revoke(sharingDoc.id, share.user_id);
      setSuccess(`Revoked access for user ID ${share.user_id}`);
      const updated = await documents.shares(sharingDoc.id);
      setShares(updated);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function closeViewModal() {
    setViewBlobUrl(null);
    setViewDoc(null);
    setViewTextContent(null);
  }

  async function handleView(doc: DocumentItem) {
    setError("");
    setSuccess("");
    setLoadingViewId(doc.id);
    try {
      const response = await documents.view(doc.id);
      await showPreview(doc, response.data as Blob);
    } catch (err: any) {
      const respData = err.response?.data;
      if (err.response?.status === 403 && respData?.errors?.step_up_required) {
        openStepUp(doc, "view", respData.errors);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoadingViewId(null);
    }
  }

  async function handleDownload(doc: DocumentItem) {
    setError("");
    setSuccess("");
    try {
      const response = await documents.download(doc.id);
      saveBlob(response.data, doc.filename);
      setSuccess(`Downloaded and decrypted ${doc.filename} successfully.`);
    } catch (err: any) {
      const respData = err.response?.data;
      if (err.response?.status === 403 && respData?.errors?.step_up_required) {
        openStepUp(doc, "download", respData.errors);
      } else {
        setError(errorMessage(err));
      }
    }
  }

  async function handleDownloadEncrypted(doc: DocumentItem) {
    setError("");
    setDownloadingEncryptedId(doc.id);
    try {
      const res = await documents.downloadEncrypted(doc.id);
      saveBlob(res.data, `${doc.filename}.enc`);
      setSuccess(`Downloaded encrypted ciphertext for ${doc.filename} (.enc).`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloadingEncryptedId(null);
    }
  }

  async function handleVerify(doc: DocumentItem) {
    setError("");
    setLoadingVerifyId(doc.id);
    try {
      const res = await signatures.verify(doc.id);
      setVerificationResult(res);
      setVerifyModalDoc(doc);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingVerifyId(null);
    }
  }

  async function handleVerifyStepUp() {
    if (!challengeId || !otpInput.trim() || !pendingDocId) return;

    setVerifyingOtp(true);
    setStepUpError("");
    try {
      const res = await risk.verifyStepUp(challengeId, otpInput.trim());
      const token = res.step_up_token;

      if (pendingAction === "view") {
        const viewResp = await documents.view(pendingDocId, token);
        const blob = viewResp.data as Blob;
        const targetDoc = docList.find((doc) => doc.id === pendingDocId);
        await showPreview(targetDoc || {
          id: pendingDocId,
          filename: pendingFilename,
          mime_type: blob.type || "application/octet-stream",
          file_size_bytes: blob.size,
          classification: "INTERNAL",
          content_hash: "",
          created_at: new Date().toISOString(),
          owner_id: 0,
        }, blob);
        setStepUpOpen(false);
        setSuccess(`Step-up authentication successful! Opened ${pendingFilename}.`);
      } else {
        const downloadResp = await documents.download(pendingDocId, token);
        saveBlob(downloadResp.data, pendingFilename);
        setStepUpOpen(false);
        setSuccess(`Step-up authentication successful! Downloaded ${pendingFilename}.`);
      }
    } catch (err) {
      setStepUpError(errorMessage(err));
    } finally {
      setVerifyingOtp(false);
    }
  }

  useEffect(() => {
    return () => {
      if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
    };
  }, [viewBlobUrl]);

  async function showPreview(doc: DocumentItem, blob: Blob) {
    setViewBlobUrl(URL.createObjectURL(blob));
    setViewTextContent(null);
    const textLike = doc.mime_type.startsWith("text/") ||
      doc.mime_type.includes("json") || /\.(txt|json|csv|md|log)$/.test(doc.filename);
    if (textLike) {
      try {
        setViewTextContent(await blob.text());
      } catch {
        setViewTextContent(null);
      }
    }
    setViewDoc(doc);
  }

  function openStepUp(doc: DocumentItem, action: "view" | "download", details: {
    challenge_id: string;
    risk_score?: number;
    risk_level?: string;
    reason?: string;
    challenge_otp?: string;
  }) {
    setPendingDocId(doc.id);
    setPendingFilename(doc.filename);
    setPendingAction(action);
    setChallengeId(details.challenge_id);
    setRiskScore(details.risk_score || 0);
    setRiskLevel(details.risk_level || "HIGH");
    setRiskReason(details.reason || "High risk anomaly detected.");
    setOtpInput(details.challenge_otp || "");
    setStepUpError("");
    setStepUpOpen(true);
  }

  function closeVerification() {
    setVerifyModalDoc(null);
    setVerificationResult(null);
  }

  // Plain styles shared by the controls and dialog panels on this page.
  const button = "border px-3 py-2";
  const input = "block w-full border p-2";
  const overlay = "fixed inset-0 z-50 overflow-y-auto bg-white p-6";
  const panel = "mx-auto max-w-4xl space-y-4 border p-4";

  return (
    <main className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Documents &amp; Secure Sharing</h1>
      <p>View documents, manage access, download files, and verify signatures.</p>
      <button className={button} disabled={loading} onClick={loadDocuments}>
        {loading ? "Loading…" : "Refresh"}
      </button>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}

      {loading ? <p>Loading accessible documents…</p> : docList.length === 0 ? (
        <p>No documents accessible. Upload a document or ask its owner to share one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-3 text-left">
            <thead>
              <tr>
                <th>Document</th><th>Classification</th><th>Your access</th>
                <th>Size</th><th>Uploaded</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {docList.map((doc) => {
                const permission = (doc.permission || doc.access_permission || "").toUpperCase();
                const isOwner = permission === "OWNER" || doc.owner_id === user?.id;
                const canDownload = can("documents.download") && (isOwner || permission === "DOWNLOAD");
                const canRead = can("documents.read") && (isOwner || permission === "DOWNLOAD" || permission === "READ");
                return (
                  <tr key={doc.id}>
                    <td>{doc.filename}<p>ID: {doc.id}</p></td>
                    <td>{doc.classification}</td>
                    <td>{isOwner ? "OWNER" : permission === "VERIFY" ? "AUDIT VERIFY" : permission || "READ ONLY"}</td>
                    <td>{formatSize(doc.file_size_bytes)}</td>
                    <td>{formatDate(doc.created_at)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {canRead && (
                          <button className={button} disabled={loadingViewId === doc.id} onClick={() => handleView(doc)}>
                            {loadingViewId === doc.id ? "Opening…" : "Open"}
                          </button>
                        )}
                        {canVerify && (
                          <button className={button} disabled={loadingVerifyId === doc.id} onClick={() => handleVerify(doc)}>
                            {loadingVerifyId === doc.id ? "Verifying…" : "Verify"}
                          </button>
                        )}
                        <button className={button} disabled={downloadingEncryptedId === doc.id} onClick={() => handleDownloadEncrypted(doc)}>
                          {downloadingEncryptedId === doc.id ? "Downloading…" : "Download .enc"}
                        </button>
                        {canDownload && <button className={button} onClick={() => handleDownload(doc)}>Download</button>}
                        {isOwner && canShare && <button className={button} onClick={() => openSharingModal(doc)}>Share</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewDoc && (
        <div className={overlay} role="dialog" aria-modal="true" aria-label="Document reader">
          <section className={panel}>
            <h2 className="text-xl font-bold">{viewDoc.filename}</h2>
            <p>{viewDoc.classification} · {formatSize(viewDoc.file_size_bytes)} · Decrypted in memory</p>
            <div className="flex flex-wrap gap-2">
              <button className={button} disabled={downloadingEncryptedId === viewDoc.id} onClick={() => handleDownloadEncrypted(viewDoc)}>Download .enc</button>
              {viewBlobUrl && <button className={button} onClick={() => window.open(viewBlobUrl, "_blank")}>Open in Tab</button>}
              {(viewDoc.permission === "OWNER" || viewDoc.permission === "DOWNLOAD" || viewDoc.access_permission === "DOWNLOAD" || viewDoc.owner_id === user?.id) && (
                <button className={button} onClick={() => handleDownload(viewDoc)}>Download Plaintext</button>
              )}
              <button className={button} onClick={closeViewModal}>Close Reader</button>
            </div>
            {error && <p role="alert">{error}</p>}
            {success && <p role="status">{success}</p>}
            {viewDoc.mime_type === "application/pdf" || viewDoc.filename.endsWith(".pdf") ? (
              viewBlobUrl ? <iframe src={viewBlobUrl} title={viewDoc.filename} className="h-[620px] w-full border" /> : <p>Loading PDF…</p>
            ) : viewTextContent !== null ? (
              <div>
                <p>Document Plaintext Preview · UTF-8 Decoded</p>
                <pre className="max-h-[550px] overflow-auto whitespace-pre-wrap border p-4">{viewTextContent}</pre>
              </div>
            ) : (
              <div className="space-y-3">
                <p>Binary document ({viewDoc.mime_type}).</p>
                {viewBlobUrl && <button className={button} onClick={() => window.open(viewBlobUrl, "_blank")}>Open Decrypted File in Browser Viewer</button>}
              </div>
            )}
            <p className="break-all">SHA-256: {viewDoc.content_hash || "Not provided"}</p>
            <button className={button} onClick={closeViewModal}>Close Reader</button>
          </section>
        </div>
      )}

      {verifyModalDoc && verificationResult && (
        <div className={overlay} role="dialog" aria-modal="true" aria-label="Signature verification">
          <section className={panel}>
            <h2 className="text-xl font-bold">Cryptographic Verification: {verifyModalDoc.filename}</h2>
            <p>ID: {verifyModalDoc.id}</p>
            <button className={button} onClick={closeVerification}>Close Verification</button>
            <p>Stored Document Integrity: {verificationResult.document_integrity_valid ? "Valid" : "Tampered / Failed"}</p>
            <p className="break-all">SHA-256 Digest: {verifyModalDoc.content_hash}</p>
            <h3>Recorded RSA-PSS Digital Signatures ({verificationResult.signatures?.length || 0})</h3>
            {!verificationResult.has_signatures ? <p>This document has no recorded digital signatures yet.</p> : (
              verificationResult.signatures.map((sig, index) => (
                <div key={sig.id || index} className="space-y-2 border p-3">
                  <p>Signer User #{sig.signer_id}</p>
                  <p>{sig.cryptographically_valid ? "VALID RSA-PSS" : "INVALID"}</p>
                  <p>Key ID: {sig.signing_key_id} ({sig.key_status})</p>
                  <p>Signed At: {formatDate(sig.signed_at)}</p>
                </div>
              ))
            )}
            <button className={button} onClick={closeVerification}>Close Verification</button>
          </section>
        </div>
      )}

      {sharingDoc && (
        <div className={overlay} role="dialog" aria-modal="true" aria-label="Manage sharing">
          <section className={panel}>
            <h2 className="text-xl font-bold">Share &quot;{sharingDoc.filename}&quot;</h2>
            <button className={button} onClick={() => setSharingDoc(null)}>Close Sharing</button>
            {error && <p role="alert">{error}</p>}
            {success && <p role="status">{success}</p>}
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleGrantShare(); }}>
              <label className="block">
                Recipient Email
                <input className={input} type="email" required placeholder="user@example.com" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
              </label>
              <label className="block">
                Permission Level
                <select className={input} value={sharePermission} onChange={(event) => setSharePermission(event.target.value as "READ" | "DOWNLOAD")}>
                  <option value="DOWNLOAD">DOWNLOAD (Read &amp; Download)</option>
                  <option value="READ">READ (In-Browser Read Only)</option>
                </select>
              </label>
              <label className="block">
                Access Expiration (Optional)
                <input className={input} type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
              </label>
              <p>Leave blank for indefinite access.</p>
              <button className={button} type="submit" disabled={submittingShare}>{submittingShare ? "Granting…" : "Grant Access"}</button>
            </form>
            <h3>Active Sharing Grants ({shares.length})</h3>
            {loadingShares ? <p>Loading active shares…</p> : shares.length === 0 ? <p>No active shares for this document yet.</p> : (
              shares.map((share) => (
                <div key={share.id} className="space-y-2 border p-3">
                  <p>{share.user_email || `User #${share.user_id}`}</p>
                  <p>{share.permission} · Granted {formatDate(share.created_at)} · {share.expires_at ? `Expires ${formatDate(share.expires_at)}` : "No expiry"}</p>
                  <button className={button} onClick={() => handleRevoke(share)}>Revoke</button>
                </div>
              ))
            )}
          </section>
        </div>
      )}

      {stepUpOpen && (
        <div className={overlay} role="dialog" aria-modal="true" aria-label="Step-up authentication">
          <section className={panel}>
            <h2 className="text-xl font-bold">Step-Up Authentication Required</h2>
            <p>Risk Engine Decision: {riskLevel} ({riskScore}/100)</p>
            <p>{riskReason}</p>
            {stepUpError && <p role="alert">{stepUpError}</p>}
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleVerifyStepUp(); }}>
              <label className="block">
                One-Time Passcode (OTP)
                <input className={input} type="text" required autoFocus placeholder="6-digit OTP code" value={otpInput} onChange={(event) => setOtpInput(event.target.value)} />
              </label>
              <div className="flex gap-2">
                <button className={button} type="button" onClick={() => setStepUpOpen(false)}>Cancel</button>
                <button className={button} type="submit" disabled={verifyingOtp}>{verifyingOtp ? "Verifying…" : "Verify & Decrypt"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
