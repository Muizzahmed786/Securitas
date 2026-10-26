import { useEffect, useState } from "react";
import {
  Share2,
  Download,
  ShieldAlert,
  UserCheck,
  Ban,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Lock,
  Eye,
  ExternalLink,
  ShieldCheck,
  Key,
} from "lucide-react";
import {
  documents,
  signatures,
  risk,
  errorMessage,
  saveBlob,
  type DocumentItem,
  type DocumentShare,
  type Verification,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Alert,
  Card,
  PageHeading,
  Empty,
  Spinner,
  formatDate,
  formatSize,
} from "../components/UI";

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

  async function handleGrantShare(e: React.FormEvent) {
    e.preventDefault();
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
    if (viewBlobUrl) {
      URL.revokeObjectURL(viewBlobUrl);
    }
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
      const blob = response.data as Blob;
      if (viewBlobUrl) {
        URL.revokeObjectURL(viewBlobUrl);
      }
      const url = URL.createObjectURL(blob);
      setViewBlobUrl(url);

      const isTextLike =
        doc.mime_type.startsWith("text/") ||
        doc.mime_type.includes("json") ||
        doc.filename.endsWith(".txt") ||
        doc.filename.endsWith(".json") ||
        doc.filename.endsWith(".csv") ||
        doc.filename.endsWith(".md") ||
        doc.filename.endsWith(".log");

      if (isTextLike) {
        try {
          const text = await blob.text();
          setViewTextContent(text);
        } catch {
          setViewTextContent(null);
        }
      } else {
        setViewTextContent(null);
      }

      setViewDoc(doc);
    } catch (err: any) {
      const respData = err.response?.data;
      if (err.response?.status === 403 && respData?.errors?.step_up_required) {
        const details = respData.errors;
        setPendingDocId(doc.id);
        setPendingFilename(doc.filename);
        setPendingAction("view");
        setChallengeId(details.challenge_id);
        setRiskScore(details.risk_score || 0);
        setRiskLevel(details.risk_level || "HIGH");
        setRiskReason(details.reason || "High risk anomaly detected.");
        setOtpInput(details.challenge_otp || "");
        setStepUpError("");
        setStepUpOpen(true);
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
        const details = respData.errors;
        setPendingDocId(doc.id);
        setPendingFilename(doc.filename);
        setPendingAction("download");
        setChallengeId(details.challenge_id);
        setRiskScore(details.risk_score || 0);
        setRiskLevel(details.risk_level || "HIGH");
        setRiskReason(details.reason || "High risk anomaly detected.");
        setOtpInput(details.challenge_otp || "");
        setStepUpError("");
        setStepUpOpen(true);
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

  async function handleVerifyStepUp(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeId || !otpInput.trim() || !pendingDocId) return;

    setVerifyingOtp(true);
    setStepUpError("");
    try {
      const res = await risk.verifyStepUp(challengeId, otpInput.trim());
      const token = res.step_up_token;

      if (pendingAction === "view") {
        const viewResp = await documents.view(pendingDocId, token);
        const blob = viewResp.data as Blob;
        if (viewBlobUrl) URL.revokeObjectURL(viewBlobUrl);
        const url = URL.createObjectURL(blob);
        setViewBlobUrl(url);

        const targetDoc = docList.find((d) => d.id === pendingDocId);
        const isTextLike =
          (targetDoc?.mime_type &&
            (targetDoc.mime_type.startsWith("text/") ||
              targetDoc.mime_type.includes("json"))) ||
          pendingFilename.endsWith(".txt") ||
          pendingFilename.endsWith(".json") ||
          pendingFilename.endsWith(".csv") ||
          pendingFilename.endsWith(".md");

        if (isTextLike) {
          try {
            setViewTextContent(await blob.text());
          } catch {
            setViewTextContent(null);
          }
        } else {
          setViewTextContent(null);
        }

        setViewDoc(
          targetDoc || {
            id: pendingDocId,
            filename: pendingFilename,
            mime_type: blob.type || "application/octet-stream",
            file_size_bytes: blob.size,
            classification: "INTERNAL",
            content_hash: "",
            created_at: new Date().toISOString(),
            owner_id: 0,
          }
        );
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

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
        <PageHeading
          eyebrow="Access Control"
          title="Documents & Secure Sharing"
          description="Manage granular sharing permissions, view decrypted files in-browser, download encrypted/decrypted files, and verify RSA-PSS digital signatures."
        />
        <button
          onClick={() => void loadDocuments()}
          disabled={loading}
          className="btn-secondary self-start sm:self-auto"
          title="Refresh document list"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && <Alert message={error} />}
      {success && <Alert message={success} success />}

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            <Spinner /> Loading accessible documents…
          </div>
        ) : docList.length === 0 ? (
          <Empty
            title="No documents accessible"
            description="Upload a document or ask a document owner to share one with you."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Your Access</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docList.map((doc) => {
                  const permission = (doc.permission || doc.access_permission || "").toUpperCase();
                  const isOwner = permission === "OWNER" || doc.owner_id === user?.id;
                  const canDownloadDoc = can("documents.download") && (isOwner || permission === "DOWNLOAD");
                  const canReadDoc = can("documents.read") && (isOwner || permission === "DOWNLOAD" || permission === "READ");

                  return (
                    <tr key={doc.id} className="transition hover:bg-slate-50/50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileText size={18} />
                          </span>
                          <div>
                            <p className="font-semibold text-slate-800">{doc.filename}</p>
                            <p className="font-mono text-[11px] text-slate-400 select-all">
                              ID: {doc.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            doc.classification === "RESTRICTED"
                              ? "bg-rose-50 text-rose-600 border border-rose-200"
                              : doc.classification === "CONFIDENTIAL"
                              ? "bg-amber-50 text-amber-600 border border-amber-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                          }`}
                        >
                          {doc.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${
                            isOwner
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : permission === "DOWNLOAD"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : permission === "VERIFY"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {isOwner ? (
                            <>
                              <UserCheck size={13} />
                              OWNER
                            </>
                          ) : permission === "DOWNLOAD" ? (
                            <>
                              <Download size={13} />
                              DOWNLOAD
                            </>
                          ) : permission === "VERIFY" ? (
                            <>
                              <ShieldCheck size={13} />
                              AUDIT VERIFY
                            </>
                          ) : (
                            <>
                              <Lock size={13} />
                              READ ONLY
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatSize(doc.file_size_bytes)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canReadDoc && (
                            <button
                              onClick={() => handleView(doc)}
                              disabled={loadingViewId === doc.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
                              title="Open and read decrypted document"
                            >
                              {loadingViewId === doc.id ? (
                                <Spinner />
                              ) : (
                                <Eye size={13} />
                              )}
                              Open
                            </button>
                          )}

                          {canVerify && (
                            <button
                              onClick={() => handleVerify(doc)}
                              disabled={loadingVerifyId === doc.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
                              title="Verify RSA-PSS signatures and SHA-256 integrity"
                            >
                              {loadingVerifyId === doc.id ? (
                                <Spinner />
                              ) : (
                                <ShieldCheck size={13} />
                              )}
                              Verify
                            </button>
                          )}

                          <button
                            onClick={() => handleDownloadEncrypted(doc)}
                            disabled={downloadingEncryptedId === doc.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200"
                            title="Download raw AES-256-GCM encrypted ciphertext (.enc)"
                          >
                            {downloadingEncryptedId === doc.id ? (
                              <Spinner />
                            ) : (
                              <Lock size={13} />
                            )}
                            .enc
                          </button>

                          {canDownloadDoc && (
                            <button
                              onClick={() => handleDownload(doc)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-600"
                              title="Download decrypted document to disk"
                            >
                              <Download size={13} />
                              Download
                            </button>
                          )}

                          {isOwner && canShare && (
                            <button
                              onClick={() => openSharingModal(doc)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                              title="Manage sharing & revoke access"
                            >
                              <Share2 size={13} />
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
      </Card>

      {/* DOCUMENT READER / PREVIEW MODAL */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <FileText size={20} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">{viewDoc.filename}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
                      {viewDoc.classification}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatSize(viewDoc.file_size_bytes)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Lock size={11} /> Decrypted in-memory
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleDownloadEncrypted(viewDoc)}
                  disabled={downloadingEncryptedId === viewDoc.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  title="Download the raw AES-256-GCM encrypted file (.enc)"
                >
                  <Lock size={14} />
                  Download .enc
                </button>

                {viewBlobUrl && (
                  <button
                    onClick={() => window.open(viewBlobUrl, "_blank")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    title="Open in a new dedicated browser tab"
                  >
                    <ExternalLink size={14} />
                    Open in Tab
                  </button>
                )}

                {(viewDoc.permission === "OWNER" ||
                  viewDoc.permission === "DOWNLOAD" ||
                  viewDoc.access_permission === "DOWNLOAD" ||
                  viewDoc.owner_id === user?.id) && (
                  <button
                    onClick={() => handleDownload(viewDoc)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    title="Download decrypted document"
                  >
                    <Download size={14} />
                    Download Plaintext
                  </button>
                )}

                <button
                  onClick={closeViewModal}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                  aria-label="Close reader"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-6 overflow-auto bg-slate-50/40">
              {viewDoc.mime_type === "application/pdf" || viewDoc.filename.endsWith(".pdf") ? (
                viewBlobUrl ? (
                  <iframe
                    src={viewBlobUrl}
                    title={viewDoc.filename}
                    className="w-full h-[620px] rounded-xl border border-slate-200 bg-white shadow-sm"
                  />
                ) : (
                  <div className="flex items-center justify-center py-20 text-slate-400">
                    <Spinner /> Loading PDF viewer...
                  </div>
                )
              ) : viewTextContent !== null ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-[11px] font-mono text-slate-400">
                    <span>Document Plaintext Preview</span>
                    <span>UTF-8 Decoded</span>
                  </div>
                  <pre className="max-h-[550px] overflow-auto font-mono text-xs leading-relaxed text-emerald-400 whitespace-pre-wrap">
                    {viewTextContent}
                  </pre>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
                    <FileText size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800 mb-1">{viewDoc.filename}</h4>
                  <p className="text-xs text-slate-500 mb-4">
                    Binary document ({viewDoc.mime_type}). Decrypted and verified with AES-256-GCM.
                  </p>
                  {viewBlobUrl && (
                    <button
                      onClick={() => window.open(viewBlobUrl, "_blank")}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700"
                    >
                      <ExternalLink size={15} />
                      Open Decrypted File in Browser Viewer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 text-xs text-slate-500">
              <span className="font-mono text-[11px] truncate max-w-md">
                SHA-256 Integrity: {viewDoc.content_hash || "Verified"}
              </span>
              <button
                onClick={closeViewModal}
                className="rounded-lg border border-slate-200 px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close Reader
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE VERIFICATION MODAL */}
      {verifyModalDoc && verificationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Cryptographic Verification: {verifyModalDoc.filename}
                  </h3>
                  <p className="font-mono text-xs text-slate-400">
                    ID: {verifyModalDoc.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setVerifyModalDoc(null);
                  setVerificationResult(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-auto">
              {/* Integrity status card */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-4 text-xs ${
                  verificationResult.document_integrity_valid
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">
                    {verificationResult.document_integrity_valid
                      ? "Stored Document Integrity: Valid"
                      : "Stored Document Integrity: Tampered / Failed"}
                  </p>
                  <p className="mt-1 font-mono text-[11px]">
                    SHA-256 Digest: {verifyModalDoc.content_hash}
                  </p>
                </div>
              </div>

              {/* Signatures list */}
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                  Recorded RSA-PSS Digital Signatures ({verificationResult.signatures?.length || 0})
                </h4>

                {!verificationResult.has_signatures ? (
                  <p className="text-xs text-slate-400 italic py-3">
                    This document has no recorded digital signatures yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {verificationResult.signatures.map((sig, idx) => (
                      <div
                        key={sig.id || idx}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Key size={13} className="text-blue-500" />
                            Signer User #{sig.signer_id}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              sig.cryptographically_valid
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {sig.cryptographically_valid ? "VALID RSA-PSS" : "INVALID"}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-500">
                          Key ID: {sig.signing_key_id} ({sig.key_status})
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          Signed At: {formatDate(sig.signed_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50/50 px-6 py-3">
              <button
                onClick={() => {
                  setVerifyModalDoc(null);
                  setVerificationResult(null);
                }}
                className="btn-primary text-xs"
              >
                Close Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {sharingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Share2 size={18} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-800">Share "{sharingDoc.filename}"</h3>
                  <p className="text-xs text-slate-400">Grant or revoke granular access</p>
                </div>
              </div>
              <button
                onClick={() => setSharingDoc(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGrantShare} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Recipient Email</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Permission Level</label>
                  <select
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value as "READ" | "DOWNLOAD")}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="DOWNLOAD">DOWNLOAD (Read & Download)</option>
                    <option value="READ">READ (In-Browser Read Only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Access Expiration (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-400">Leave blank for indefinite access.</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submittingShare}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingShare ? <Spinner /> : <Share2 size={14} />}
                  Grant Access
                </button>
              </div>
            </form>

            {/* ACTIVE SHARES LIST */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Active Sharing Grants ({shares.length})
              </h4>

              {loadingShares ? (
                <div className="flex items-center justify-center py-6 text-xs text-slate-400">
                  <Spinner /> Loading active shares…
                </div>
              ) : shares.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">
                  No active shares for this document yet.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {shares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between p-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {share.user_email || `User #${share.user_id}`}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {share.permission} · Granted {formatDate(share.created_at)}
                          {share.expires_at ? ` · Expires ${formatDate(share.expires_at)}` : " · No expiry"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevoke(share)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                        title="Instantly revoke access"
                      >
                        <Ban size={12} />
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP-UP AUTHENTICATION CHALLENGE MODAL */}
      {stepUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-8 ring-amber-50/50">
                <ShieldAlert size={24} />
              </span>
              <div>
                <h3 className="font-bold text-slate-800">Step-Up Authentication Required</h3>
                <p className="text-xs text-slate-500">
                  6-Factor Risk Engine Decision:{" "}
                  <span className="font-bold text-amber-600">
                    {riskLevel} ({riskScore}/100)
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50/60 p-3.5 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-600" />
                Security Policy Verification
              </p>
              {riskReason}
            </div>

            <Alert message={stepUpError} />

            <form onSubmit={handleVerifyStepUp} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Enter Cryptographic One-Time Passcode (OTP)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="6-digit OTP code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center font-mono text-lg tracking-widest font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-400 text-center">
                  OTP is verified using HMAC-SHA256 with a single-use token binding.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setStepUpOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifyingOtp ? <Spinner /> : <CheckCircle2 size={15} />}
                  Verify & Decrypt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
