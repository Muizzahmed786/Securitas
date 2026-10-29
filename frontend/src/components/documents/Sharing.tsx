import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";

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

type SharePermission = "READ" | "DOWNLOAD";
type PendingAction = "view" | "download";

type StepUpDetails = {
  challenge_id: string;
  risk_score?: number;
  risk_level?: string;
  reason?: string;
  challenge_otp?: string;
};

type ApiErrorResponse = {
  errors?: {
    step_up_required?: boolean;
    challenge_id?: string;
    risk_score?: number;
    risk_level?: string;
    reason?: string;
    challenge_otp?: string;
  };
};

function getStepUpDetails(error: unknown): StepUpDetails | null {
  if (!isAxiosError<ApiErrorResponse>(error)) return null;
  if (error.response?.status !== 403) return null;

  const details = error.response.data?.errors;

  if (!details?.step_up_required || !details.challenge_id) {
    return null;
  }

  return {
    challenge_id: details.challenge_id,
    risk_score: details.risk_score,
    risk_level: details.risk_level,
    reason: details.reason,
    challenge_otp: details.challenge_otp,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatSize(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return "Unknown";
  }

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPermission(doc: DocumentItem) {
  return (doc.permission || doc.access_permission || "").toUpperCase();
}

function isDocumentOwner(doc: DocumentItem, userId?: string | number) {
  const permission = getPermission(doc);

  return (
    permission === "OWNER" ||
    (userId != null && String(doc.owner_id) === String(userId))
  );
}

function isTextDocument(doc: DocumentItem) {
  const mimeType = doc.mime_type?.toLowerCase() ?? "";
  const filename = doc.filename?.toLowerCase() ?? "";

  return (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    /\.(txt|json|csv|md|log)$/.test(filename)
  );
}

export default function Sharing() {
  const { user, can } = useAuth();

  const [docList, setDocList] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sharing dialog
  const [sharingDoc, setSharingDoc] = useState<DocumentItem | null>(null);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sharePermission, setSharePermission] =
    useState<SharePermission>("DOWNLOAD");
  const [expiresAt, setExpiresAt] = useState("");
  const [submittingShare, setSubmittingShare] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);

  // Document preview
  const [viewDoc, setViewDoc] = useState<DocumentItem | null>(null);
  const [viewBlobUrl, setViewBlobUrl] = useState<string | null>(null);
  const [viewTextContent, setViewTextContent] = useState<string | null>(null);
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);

  // Signature verification
  const [verifyModalDoc, setVerifyModalDoc] =
    useState<DocumentItem | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<Verification | null>(null);
  const [loadingVerifyId, setLoadingVerifyId] = useState<string | null>(null);

  // Encrypted download
  const [downloadingEncryptedId, setDownloadingEncryptedId] =
    useState<string | null>(null);
  const [downloadingPlaintextId, setDownloadingPlaintextId] =
    useState<string | null>(null);

  // Step-up authentication
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>("download");
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [pendingFilename, setPendingFilename] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState("HIGH");
  const [riskReason, setRiskReason] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [stepUpError, setStepUpError] = useState("");

  const canShare = can("documents.share");
  const canVerify = can("documents.verify");
  const canRead = can("documents.read");
  const canDownload = can("documents.download");

  const button =
    "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

  const input =
    "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const overlay =
    "fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 sm:p-6";

  const panel =
    "mx-auto my-6 w-full max-w-4xl space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:p-6";

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await documents.list();
      setDocList(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  // Revoke temporary browser URLs when the preview changes or closes.
  useEffect(() => {
    return () => {
      if (viewBlobUrl) {
        URL.revokeObjectURL(viewBlobUrl);
      }
    };
  }, [viewBlobUrl]);

  async function openSharingModal(doc: DocumentItem) {
    clearMessages();
    setSharingDoc(doc);
    setShares([]);
    setRecipientEmail("");
    setExpiresAt("");
    setSharePermission("DOWNLOAD");
    setLoadingShares(true);

    try {
      const activeShares = await documents.shares(doc.id);
      setShares(activeShares);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingShares(false);
    }
  }

  function closeSharingModal() {
    if (submittingShare || revokingShareId) return;

    setSharingDoc(null);
    setShares([]);
    setRecipientEmail("");
    setExpiresAt("");
  }

  async function handleGrantShare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sharingDoc || !recipientEmail.trim()) return;

    let expiration: string | null = null;

    if (expiresAt) {
      const date = new Date(expiresAt);

      if (Number.isNaN(date.getTime())) {
        setError("Please enter a valid expiration date.");
        return;
      }

      if (date.getTime() <= Date.now()) {
        setError("The expiration date must be in the future.");
        return;
      }

      expiration = date.toISOString();
    }

    setSubmittingShare(true);
    clearMessages();

    try {
      const email = recipientEmail.trim();

      await documents.share(
        sharingDoc.id,
        email,
        sharePermission,
        expiration,
      );

      setSuccess(`Access granted to ${email} (${sharePermission}).`);
      setRecipientEmail("");
      setExpiresAt("");

      const updatedShares = await documents.shares(sharingDoc.id);
      setShares(updatedShares);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmittingShare(false);
    }
  }

  async function handleRevoke(share: DocumentShare) {
    if (!sharingDoc || revokingShareId) return;

    clearMessages();
    setRevokingShareId(String(share.id));

    try {
      await documents.revoke(sharingDoc.id, share.user_id);

      setSuccess(`Access revoked for user ID ${share.user_id}.`);

      const updatedShares = await documents.shares(sharingDoc.id);
      setShares(updatedShares);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRevokingShareId(null);
    }
  }

  function closeViewModal() {
    setViewDoc(null);
    setViewTextContent(null);
    setViewBlobUrl(null);
  }

  async function showPreview(doc: DocumentItem, blob: Blob) {
    // The previous URL is cleaned up by the effect above.
    setViewBlobUrl(URL.createObjectURL(blob));
    setViewTextContent(null);
    setViewDoc(doc);

    if (isTextDocument(doc)) {
      try {
        setViewTextContent(await blob.text());
      } catch {
        setViewTextContent("Unable to decode this document as text.");
      }
    }
  }

  function openStepUp(doc: DocumentItem, action: PendingAction, details: StepUpDetails) {
    setPendingDocId(String(doc.id));
    setPendingFilename(doc.filename);
    setPendingAction(action);
    setChallengeId(details.challenge_id);
    setRiskScore(details.risk_score ?? 0);
    setRiskLevel(details.risk_level ?? "HIGH");
    setRiskReason(details.reason ?? "An elevated-risk activity was detected.");
    setOtpInput(details.challenge_otp ?? "");
    setStepUpError("");
    setStepUpOpen(true);
  }

  async function handleView(doc: DocumentItem) {
    clearMessages();
    setLoadingViewId(String(doc.id));

    try {
      const response = await documents.view(doc.id);
      await showPreview(doc, response.data as Blob);
    } catch (err) {
      const details = getStepUpDetails(err);

      if (details) {
        openStepUp(doc, "view", details);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setLoadingViewId(null);
    }
  }

  async function handleDownload(doc: DocumentItem) {
    clearMessages();
    setDownloadingPlaintextId(String(doc.id));

    try {
      const response = await documents.download(doc.id);
      saveBlob(response.data, doc.filename);

      setSuccess(`Downloaded and decrypted ${doc.filename} successfully.`);
    } catch (err) {
      const details = getStepUpDetails(err);

      if (details) {
        openStepUp(doc, "download", details);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setDownloadingPlaintextId(null);
    }
  }

  async function handleDownloadEncrypted(doc: DocumentItem) {
    clearMessages();
    setDownloadingEncryptedId(String(doc.id));

    try {
      const response = await documents.downloadEncrypted(doc.id);
      saveBlob(response.data, `${doc.filename}.enc`);

      setSuccess(`Downloaded encrypted ciphertext for ${doc.filename}.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloadingEncryptedId(null);
    }
  }

  async function handleVerify(doc: DocumentItem) {
    clearMessages();
    setLoadingVerifyId(String(doc.id));
    setVerificationResult(null);
    setVerifyModalDoc(null);

    try {
      const result = await signatures.verify(doc.id);

      setVerificationResult(result);
      setVerifyModalDoc(doc);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingVerifyId(null);
    }
  }

  function closeVerification() {
    setVerifyModalDoc(null);
    setVerificationResult(null);
  }

  function closeStepUp() {
    if (verifyingOtp) return;

    setStepUpOpen(false);
    setOtpInput("");
    setStepUpError("");
    setPendingDocId(null);
    setChallengeId("");
  }

  async function handleVerifyStepUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!challengeId || !otpInput.trim() || !pendingDocId) return;

    setVerifyingOtp(true);
    setStepUpError("");

    try {
      const result = await risk.verifyStepUp(challengeId, otpInput.trim());
      const token = result.step_up_token;

      if (!token) {
        throw new Error("Step-up verification did not return an access token.");
      }

      if (pendingAction === "view") {
        const response = await documents.view(pendingDocId, token);
        const blob = response.data as Blob;

        const targetDoc = docList.find(
          (doc) => String(doc.id) === pendingDocId,
        );

        if (targetDoc) {
          await showPreview(targetDoc, blob);
        } else {
          const fallbackDoc = {
            id: pendingDocId,
            filename: pendingFilename,
            mime_type: blob.type || "application/octet-stream",
            file_size_bytes: blob.size,
            classification: "INTERNAL",
            content_hash: "",
            created_at: new Date().toISOString(),
            owner_id: 0,
          } as DocumentItem;

          await showPreview(fallbackDoc, blob);
        }

        setStepUpOpen(false);
        setSuccess(`Authentication successful. Opened ${pendingFilename}.`);
      } else {
        const response = await documents.download(pendingDocId, token);

        saveBlob(response.data, pendingFilename);

        setStepUpOpen(false);
        setSuccess(
          `Authentication successful. Downloaded ${pendingFilename}.`,
        );
      }

      setOtpInput("");
      setPendingDocId(null);
      setChallengeId("");
    } catch (err) {
      setStepUpError(errorMessage(err));
    } finally {
      setVerifyingOtp(false);
    }
  }

  const selectedDocIsOwner = viewDoc
    ? isDocumentOwner(viewDoc, user?.id)
    : false;

  const selectedPermission = viewDoc ? getPermission(viewDoc) : "";

  const canDownloadViewedDocument =
    canDownload &&
    (selectedDocIsOwner || selectedPermission === "DOWNLOAD");

  return (
    <main className="min-h-full space-y-6 bg-gray-50 p-4 sm:p-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Documents &amp; Secure Sharing
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            View documents, manage access, download files, and verify digital
            signatures.
          </p>
        </div>

        <button
          type="button"
          className={button}
          disabled={loading}
          onClick={() => void loadDocuments()}
        >
          {loading ? "Refreshing…" : "Refresh documents"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500">
            Loading accessible documents…
          </p>
        ) : docList.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-semibold text-gray-900">
              No accessible documents
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Upload a document or ask its owner to share one with you.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Document</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Your access</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {docList.map((doc) => {
                  const permission = getPermission(doc);
                  const owner = isDocumentOwner(doc, user?.id);

                  const allowedToDownload =
                    canDownload && (owner || permission === "DOWNLOAD");

                  const allowedToRead =
                    canRead &&
                    (owner ||
                      permission === "READ" ||
                      permission === "DOWNLOAD");

                  const isLoadingView =
                    loadingViewId === String(doc.id);

                  const isLoadingVerify =
                    loadingVerifyId === String(doc.id);

                  const isDownloadingEncrypted =
                    downloadingEncryptedId === String(doc.id);

                  const isDownloadingPlaintext =
                    downloadingPlaintextId === String(doc.id);

                  return (
                    <tr key={String(doc.id)} className="hover:bg-gray-50">
                      <td className="max-w-xs px-5 py-4">
                        <p className="break-words font-medium text-gray-900">
                          {doc.filename}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          ID: {doc.id}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          {doc.classification}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-gray-600">
                        {owner
                          ? "OWNER"
                          : permission === "VERIFY"
                            ? "AUDIT VERIFY"
                            : permission || "READ ONLY"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {formatSize(doc.file_size_bytes)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {formatDate(doc.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {allowedToRead && (
                            <button
                              type="button"
                              className={button}
                              disabled={isLoadingView}
                              onClick={() => void handleView(doc)}
                            >
                              {isLoadingView ? "Opening…" : "Open"}
                            </button>
                          )}

                          {canVerify && (
                            <button
                              type="button"
                              className={button}
                              disabled={isLoadingVerify}
                              onClick={() => void handleVerify(doc)}
                            >
                              {isLoadingVerify ? "Verifying…" : "Verify"}
                            </button>
                          )}

                          <button
                            type="button"
                            className={button}
                            disabled={isDownloadingEncrypted}
                            onClick={() => void handleDownloadEncrypted(doc)}
                          >
                            {isDownloadingEncrypted
                              ? "Downloading…"
                              : "Download .enc"}
                          </button>

                          {allowedToDownload && (
                            <button
                              type="button"
                              className={button}
                              disabled={isDownloadingPlaintext}
                              onClick={() => void handleDownload(doc)}
                            >
                              {isDownloadingPlaintext
                                ? "Downloading…"
                                : "Download"}
                            </button>
                          )}

                          {owner && canShare && (
                            <button
                              type="button"
                              className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                              onClick={() => void openSharingModal(doc)}
                            >
                              Share
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Document preview dialog */}
      {viewDoc && (
        <div
          className={overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Document reader"
        >
          <section className={panel}>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-gray-900">
                  {viewDoc.filename}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {viewDoc.classification} ·{" "}
                  {formatSize(viewDoc.file_size_bytes)} · Decrypted in memory
                </p>
              </div>

              <button
                type="button"
                className={button}
                onClick={closeViewModal}
              >
                Close
              </button>
            </header>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={button}
                disabled={downloadingEncryptedId === String(viewDoc.id)}
                onClick={() => void handleDownloadEncrypted(viewDoc)}
              >
                Download .enc
              </button>

              {viewBlobUrl && (
                <button
                  type="button"
                  className={button}
                  onClick={() => window.open(viewBlobUrl, "_blank", "noopener,noreferrer")}
                >
                  Open in tab
                </button>
              )}

              {canDownloadViewedDocument && (
                <button
                  type="button"
                  className={button}
                  disabled={downloadingPlaintextId === String(viewDoc.id)}
                  onClick={() => void handleDownload(viewDoc)}
                >
                  {downloadingPlaintextId === String(viewDoc.id)
                    ? "Downloading…"
                    : "Download plaintext"}
                </button>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            {success && (
              <p role="status" className="text-sm text-green-700">
                {success}
              </p>
            )}

            {viewDoc.mime_type === "application/pdf" ||
            viewDoc.filename.toLowerCase().endsWith(".pdf") ? (
              viewBlobUrl ? (
                <iframe
                  src={viewBlobUrl}
                  title={viewDoc.filename}
                  className="h-[65vh] min-h-96 w-full rounded-md border border-gray-200"
                />
              ) : (
                <p className="text-sm text-gray-500">Loading PDF…</p>
              )
            ) : viewTextContent !== null ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Plaintext preview · UTF-8
                </h3>
                <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  {viewTextContent}
                </pre>
              </div>
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm text-gray-700">
                  Binary document ({viewDoc.mime_type || "unknown type"}).
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Use Open in tab to view it in a compatible browser viewer.
                </p>
              </div>
            )}

            <p className="break-all text-xs text-gray-500">
              SHA-256: {viewDoc.content_hash || "Not provided"}
            </p>
          </section>
        </div>
      )}

      {/* Digital signature verification dialog */}
      {verifyModalDoc && verificationResult && (
        <div
          className={overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Signature verification"
        >
          <section className={panel}>
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-gray-900">
                  Signature verification
                </h2>
                <p className="mt-1 break-all text-sm text-gray-500">
                  {verifyModalDoc.filename} · ID: {verifyModalDoc.id}
                </p>
              </div>

              <button
                type="button"
                className={button}
                onClick={closeVerification}
              >
                Close
              </button>
            </header>

            <div
              className={`rounded-lg border p-4 ${
                verificationResult.document_integrity_valid
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <p className="text-sm font-medium text-gray-700">
                Stored document integrity
              </p>
              <p
                className={`mt-1 font-semibold ${
                  verificationResult.document_integrity_valid
                    ? "text-green-700"
                    : "text-red-700"
                }`}
              >
                {verificationResult.document_integrity_valid
                  ? "Valid — no integrity mismatch detected"
                  : "Invalid — integrity check failed"}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-800">
                SHA-256 digest
              </h3>
              <p className="mt-1 break-all rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-600">
                {verifyModalDoc.content_hash || "Not provided"}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">
                Digital signatures (
                {verificationResult.signatures?.length ?? 0})
              </h3>

              {!verificationResult.has_signatures ||
              !verificationResult.signatures?.length ? (
                <p className="rounded-md border border-gray-200 p-4 text-sm text-gray-500">
                  This document has no recorded digital signatures.
                </p>
              ) : (
                verificationResult.signatures.map((sig, index) => (
                  <article
                    key={sig.id ?? index}
                    className="space-y-2 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        Signer user #{sig.signer_id}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          sig.cryptographically_valid
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {sig.cryptographically_valid ? "VALID" : "INVALID"}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600">
                      Algorithm: RSA-PSS
                    </p>
                    <p className="break-all text-sm text-gray-600">
                      Key ID: {sig.signing_key_id ?? "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Key status: {sig.key_status ?? "—"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Signed at: {formatDate(sig.signed_at)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Document sharing dialog */}
      {sharingDoc && (
        <div
          className={overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Manage document sharing"
        >
          <section className={panel}>
            <header className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold text-gray-900">
                  Manage sharing
                </h2>
                <p className="mt-1 break-words text-sm text-gray-500">
                  {sharingDoc.filename}
                </p>
              </div>

              <button
                type="button"
                className={button}
                disabled={submittingShare || revokingShareId !== null}
                onClick={closeSharingModal}
              >
                Close
              </button>
            </header>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-md bg-green-50 p-3 text-sm text-green-700"
              >
                {success}
              </p>
            )}

            <form className="space-y-4" onSubmit={handleGrantShare}>
              <label className="block text-sm font-medium text-gray-700">
                Recipient email
                <input
                  className={input}
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="user@example.com"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                />
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Permission level
                <select
                  className={input}
                  value={sharePermission}
                  onChange={(event) =>
                    setSharePermission(event.target.value as SharePermission)
                  }
                >
                  <option value="DOWNLOAD">
                    DOWNLOAD — view and download
                  </option>
                  <option value="READ">READ — view only</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-gray-700">
                Access expiration (optional)
                <input
                  className={input}
                  type="datetime-local"
                  min={new Date(Date.now() + 60_000)
                    .toISOString()
                    .slice(0, 16)}
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </label>

              <p className="text-xs text-gray-500">
                Leave the expiration empty to grant access without a scheduled
                expiration, if supported by your backend.
              </p>

              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submittingShare || !recipientEmail.trim()}
              >
                {submittingShare ? "Granting access…" : "Grant access"}
              </button>
            </form>

            <div className="border-t border-gray-200 pt-5">
              <h3 className="font-semibold text-gray-900">
                Sharing grants ({shares.length})
              </h3>

              {loadingShares ? (
                <p className="mt-3 text-sm text-gray-500">
                  Loading sharing grants…
                </p>
              ) : shares.length === 0 ? (
                <p className="mt-3 rounded-md border border-gray-200 p-4 text-sm text-gray-500">
                  No sharing grants were returned for this document.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {shares.map((share) => {
                    const revoking =
                      revokingShareId === String(share.id);

                    return (
                      <article
                        key={String(share.id)}
                        className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="break-all font-medium text-gray-900">
                            {share.user_email || `User #${share.user_id}`}
                          </p>
                          <p className="text-sm text-gray-600">
                            Permission: {share.permission}
                          </p>
                          <p className="text-xs text-gray-500">
                            Granted: {formatDate(share.created_at)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {share.expires_at
                              ? `Expires: ${formatDate(share.expires_at)}`
                              : "No expiration"}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="self-start rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 sm:self-center"
                          disabled={revokingShareId !== null}
                          onClick={() => void handleRevoke(share)}
                        >
                          {revoking ? "Revoking…" : "Revoke"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Risk-based step-up authentication dialog */}
      {stepUpOpen && (
        <div
          className={overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Step-up authentication"
        >
          <section className="mx-auto my-12 w-full max-w-lg space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
            <header>
              <h2 className="text-xl font-bold text-gray-900">
                Additional authentication required
              </h2>
              <p className="mt-1 break-words text-sm text-gray-500">
                {pendingFilename}
              </p>
            </header>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Risk level: {riskLevel} ({riskScore}/100)
              </p>
              <p className="mt-2 text-sm text-amber-800">{riskReason}</p>
            </div>

            {stepUpError && (
              <p
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-700"
              >
                {stepUpError}
              </p>
            )}

            <form className="space-y-4" onSubmit={handleVerifyStepUp}>
              <label className="block text-sm font-medium text-gray-700">
                One-time passcode (OTP)
                <input
                  className={input}
                  type="text"
                  required
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="Enter your OTP"
                  value={otpInput}
                  onChange={(event) => setOtpInput(event.target.value)}
                />
              </label>

              <p className="text-xs text-gray-500">
                Verify your identity to continue with this protected action.
              </p>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={verifyingOtp}
                  onClick={closeStepUp}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    verifyingOtp || !challengeId || !otpInput.trim()
                  }
                >
                  {verifyingOtp ? "Verifying…" : "Verify and continue"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}