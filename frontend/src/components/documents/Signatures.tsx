import { useEffect, useState, type FormEvent } from "react";
import {
  Key,
  FileSignature,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  FileText,
  Lock,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { signatures, type SigningKey, type SignatureVerification } from "../../api/signatures";
import { documents, saveBlob, type DocumentItem } from "../../api/documents";
import { errorMessage } from "../../api/http";
import { signLocally } from "../../api/signing";
import { useAuth } from "../../context/AuthContext";

export default function Signatures() {
  const { user, can } = useAuth();

  const canSign = can("documents.sign");
  const canVerify = can("documents.verify");

  const [keys, setKeys] = useState<SigningKey[]>([]);
  const [docList, setDocList] = useState<DocumentItem[]>([]);
  const [signDocumentId, setSignDocumentId] = useState("");
  const [signingKeyId, setSigningKeyId] = useState("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);
  const [verifyDocumentId, setVerifyDocumentId] = useState("");
  const [result, setResult] = useState<SignatureVerification | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    // Load available documents
    documents
      .list()
      .then((docs) => {
        if (active) setDocList(docs);
      })
      .catch(() => {});

    if (canSign) {
      signatures
        .keys()
        .then((items) => {
          if (active) setKeys(items);
        })
        .catch((err) => {
          if (active) setError(errorMessage(err));
        });
    }

    return () => {
      active = false;
    };
  }, [canSign]);

  const ownedDocs = docList.filter(
    (doc) => doc.is_owner || String(doc.owner_id) === String(user?.id),
  );

  async function generateKey() {
    setBusy("generate");
    setError("");
    setMessage("");

    try {
      const { file, keyId } = await signatures.generate();

      saveBlob(
        file,
        keyId ? `signing-${keyId}.pem` : "signing-private-key.pem",
      );

      setMessage("Signing keypair provisioned. Store your downloaded private PEM securely.");

      try {
        setKeys(await signatures.keys());
      } catch {
        setError("The key was created, but the key registry could not refresh.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function signDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("sign");
    setError("");
    setMessage("");

    try {
      const key = keys.find((item) => item.id === signingKeyId);

      if (!key?.usable_for_signing) {
        throw new Error("Select an active signing key.");
      }
      if (!originalFile || !privateKeyFile) {
        throw new Error("Choose the original document and your private PEM.");
      }

      const signature = await signLocally(
        originalFile,
        privateKeyFile,
        key.public_key_pem,
      );

      await signatures.submit(
        signDocumentId.trim(),
        key.id,
        signature,
      );

      setMessage("Cryptographic signature generated, verified, and anchored.");
      setOriginalFile(null);
      setPrivateKeyFile(null);
      event.currentTarget.reset();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function verifyDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("verify");
    setError("");
    setMessage("");
    setResult(null);

    try {
      setResult(await signatures.verify(verifyDocumentId.trim()));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <FileSignature className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Digital Signatures & Non-Repudiation
            </h1>
          </div>
          <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
            Generate zero-knowledge client-side signatures using WebCrypto RSA-PSS and audit document provenance.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {canSign && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1. Generate Key */}
          <section className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-white">
                      1. Provision Signing Key
                    </h2>
                    <p className="text-[11px] text-neutral-400">
                      RSA-PSS 2048-bit with SHA-256 digest
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400">
                  Zero-Knowledge
                </span>
              </div>

              <p className="text-xs leading-relaxed text-neutral-400">
                The public key is retained in the enclave registry. Your private PEM key is streamed
                directly to your local device. The server never observes or stores your private key.
              </p>

              {/* Active Keys Registry */}
              {keys.length > 0 && (
                <div className="space-y-2 rounded-xl border border-white/5 bg-[#0c0c10] p-3">
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-medium">Active Enrolled Keys</span>
                    <span className="font-mono text-neutral-500">{keys.length} registered</span>
                  </div>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto no-scrollbar">
                    {keys.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px]"
                      >
                        <span className="font-mono text-neutral-300">
                          {k.id.slice(0, 16)}...
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            k.usable_for_signing
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : "border border-neutral-700 bg-neutral-800 text-neutral-400"
                          }`}
                        >
                          {k.usable_for_signing ? "Active" : "Archived"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <button
                type="button"
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={Boolean(busy)}
                onClick={() => void generateKey()}
              >
                {busy === "generate" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Provisioning Keypair…</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Generate & Download Private PEM</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* 2. Sign a Document */}
          <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
                <FileSignature className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-white">
                  2. Apply Client Signature
                </h2>
                <p className="text-[11px] text-neutral-400">
                  SubtleCrypto browser-based signing operation
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={signDocument}>
              {ownedDocs.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Select Uploaded Document
                  </label>
                  <select
                    className="input-style"
                    value={signDocumentId}
                    onChange={(e) => setSignDocumentId(e.target.value)}
                  >
                    <option value="" className="bg-[#0c0c10] text-neutral-400">
                      Choose an uploaded document...
                    </option>
                    {ownedDocs.map((doc) => (
                      <option key={doc.id} value={doc.id} className="bg-[#0c0c10] text-white">
                        {doc.filename} ({doc.classification})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-300">
                  Target Document ID
                </label>
                <input
                  className="input-style font-mono text-xs"
                  required
                  placeholder="Paste UUID or select from dropdown above"
                  value={signDocumentId}
                  onChange={(e) => setSignDocumentId(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-300">
                  Select Signing Key
                </label>
                <select
                  className="input-style font-mono text-xs"
                  required
                  value={signingKeyId}
                  onChange={(e) => setSigningKeyId(e.target.value)}
                >
                  <option value="" className="bg-[#0c0c10] text-neutral-400">
                    Select an active signing key...
                  </option>
                  {keys
                    .filter((key) => key.usable_for_signing)
                    .map((key) => (
                      <option key={key.id} value={key.id} className="bg-[#0c0c10] text-white">
                        Key ID: {key.id}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Original Document File
                  </label>
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0c0c10] p-3 text-center cursor-pointer hover:border-amber-500/30 transition-colors">
                    <FileText className="h-5 w-5 text-neutral-400 mb-1" />
                    <span className="text-[11px] text-neutral-300 font-medium truncate max-w-[150px]">
                      {originalFile ? originalFile.name : "Pick original (.pdf/.doc)"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      required
                      className="sr-only"
                      onChange={(e) => setOriginalFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Your Private PEM Key
                  </label>
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0c0c10] p-3 text-center cursor-pointer hover:border-amber-500/30 transition-colors">
                    <Lock className="h-5 w-5 text-amber-400/80 mb-1" />
                    <span className="text-[11px] text-neutral-300 font-medium truncate max-w-[150px]">
                      {privateKeyFile ? privateKeyFile.name : "Pick private .pem key"}
                    </span>
                    <input
                      type="file"
                      accept=".pem"
                      required
                      className="sr-only"
                      onChange={(e) => setPrivateKeyFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-neutral-400 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Execution is client-local. Your private PEM is parsed in WebCrypto memory and
                  never transmitted to any server.
                </span>
              </div>

              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={Boolean(busy)}
              >
                {busy === "sign" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing in Browser…</span>
                  </>
                ) : (
                  <>
                    <FileSignature className="h-3.5 w-3.5" />
                    <span>Sign & Anchor Digest</span>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 3. Verify Signatures */}
      {canVerify && (
        <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                {canSign ? "3. Verify Signatures & Authenticity" : "Verify Signatures & Authenticity"}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Cryptographic integrity checking against stored SHA-256 digests and RSA signatures
              </p>
            </div>
          </div>

          <form className="max-w-2xl space-y-4" onSubmit={verifyDocument}>
            {docList.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-300">
                  Select Document to Inspect
                </label>
                <select
                  className="input-style"
                  value={verifyDocumentId}
                  onChange={(e) => {
                    setVerifyDocumentId(e.target.value);
                    setResult(null);
                  }}
                >
                  <option value="" className="bg-[#0c0c10] text-neutral-400">
                    Choose a document...
                  </option>
                  {docList.map((doc) => (
                    <option key={doc.id} value={doc.id} className="bg-[#0c0c10] text-white">
                      {doc.filename} ({doc.classification})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-300">
                Target Document ID
              </label>
              <input
                className="input-style font-mono text-xs"
                required
                placeholder="Paste document UUID"
                value={verifyDocumentId}
                onChange={(e) => {
                  setVerifyDocumentId(e.target.value);
                  setResult(null);
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={Boolean(busy)}
            >
              {busy === "verify" ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Verifying Cryptography…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Run Verification Audit</span>
                </>
              )}
            </button>
          </form>

          {/* Verification Results */}
          {result && (
            <div className="mt-6 space-y-4 rounded-xl border border-white/10 bg-[#0c0c10] p-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-medium text-neutral-300">Document Integrity</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    result.document_integrity_valid
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border border-red-500/20 bg-red-500/10 text-red-400"
                  }`}
                >
                  {result.document_integrity_valid ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      Tamper-Free (SHA-256 Valid)
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" />
                      Integrity Compromised
                    </>
                  )}
                </span>
              </div>

              {!result.has_signatures && (
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-neutral-400">
                  No cryptographic signatures have been anchored to this document yet.
                </div>
              )}

              {result.signatures.length > 0 && (
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-medium text-neutral-300">
                    Anchored Signatures ({result.signatures.length})
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {result.signatures.map((sig) => (
                      <div
                        key={sig.id}
                        className="rounded-xl border border-white/10 bg-[#121218] p-4 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-400 text-[11px]">Signature Status</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              sig.cryptographically_valid
                                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                : "border border-red-500/20 bg-red-500/10 text-red-400"
                            }`}
                          >
                            {sig.cryptographically_valid ? "Valid" : "Invalid"}
                          </span>
                        </div>

                        <div className="space-y-1 font-mono text-[11px] text-neutral-300">
                          <p className="truncate">
                            <span className="text-neutral-500">Signer ID:</span> {sig.signer_id}
                          </p>
                          <p className="truncate">
                            <span className="text-neutral-500">Key Status:</span> {sig.key_status}
                          </p>
                        </div>

                        {!sig.key_usable_now && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 pt-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>This signing key has expired or was revoked.</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {!canSign && !canVerify && (
        <div className="rounded-2xl border border-white/10 bg-[#121218] p-8 text-center text-sm text-neutral-400">
          Your account role does not have authorization to create or audit digital signatures.
        </div>
      )}
    </main>
  );
}
