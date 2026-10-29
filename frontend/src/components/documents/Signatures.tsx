import { useEffect, useState, type FormEvent } from "react";
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

  const button = "rounded border px-3 py-2 disabled:opacity-50";
  const input = "w-full rounded border px-3 py-2";
  const card = "space-y-4 rounded-lg border bg-white p-5";

  useEffect(() => {
    let active = true;

    // A document list is helpful, but users can still enter an ID manually.
    documents.list()
      .then((docs) => {
        if (active) setDocList(docs);
      })
      .catch(() => {});

    if (canSign) {
      signatures.keys()
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

      setMessage("Signing key created. Keep the downloaded private PEM safe.");

      try {
        setKeys(await signatures.keys());
      } catch {
        setError("The key was created, but the key list could not refresh.");
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

      setMessage("Signature verified and saved.");
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
    <main className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Digital signatures</h1>
        <p className="text-sm text-slate-500">
          Generate a key, sign an uploaded document, and verify signatures.
        </p>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {message && <p role="status" className="text-green-700">{message}</p>}

      {canSign && (
        <>
          <section className={card}>
            <h2 className="text-lg font-semibold">1. Generate a signing key</h2>
            <p className="text-sm text-slate-600">
              The public key stays on the server. Download and keep your
              private PEM; the server does not store it.
            </p>
            <button
              type="button"
              className={button}
              disabled={Boolean(busy)}
              onClick={() => void generateKey()}
            >
              {busy === "generate" ? "Generating…" : "Generate and download key"}
            </button>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">2. Sign a document</h2>

            <form className="max-w-xl space-y-4" onSubmit={signDocument}>
              {ownedDocs.length > 0 && (
                <label className="block space-y-1">
                  <span>Choose your uploaded document</span>
                  <select
                    className={input}
                    value={signDocumentId}
                    onChange={(event) => setSignDocumentId(event.target.value)}
                  >
                    <option value="">Select a document</option>
                    {ownedDocs.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block space-y-1">
                <span>Document ID</span>
                <input
                  className={input}
                  required
                  placeholder="Paste the uploaded document ID"
                  value={signDocumentId}
                  onChange={(event) => setSignDocumentId(event.target.value)}
                />
              </label>

              <label className="block space-y-1">
                <span>Signing key</span>
                <select
                  className={input}
                  required
                  value={signingKeyId}
                  onChange={(event) => setSigningKeyId(event.target.value)}
                >
                  <option value="">Select a key</option>
                  {keys.filter((key) => key.usable_for_signing).map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span>Exact original file that was uploaded</span>
                <input
                  className={input}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  required
                  onChange={(event) =>
                    setOriginalFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>

              <label className="block space-y-1">
                <span>Your private PEM file</span>
                <input
                  className={input}
                  type="file"
                  accept=".pem"
                  required
                  onChange={(event) =>
                    setPrivateKeyFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>

              <p className="text-sm text-slate-500">
                Signing happens in your browser. Your private PEM is never
                uploaded.
              </p>

              <button className={button} disabled={Boolean(busy)}>
                {busy === "sign" ? "Signing…" : "Sign document"}
              </button>
            </form>
          </section>
        </>
      )}

      {canVerify && (
        <section className={card}>
          <h2 className="text-lg font-semibold">
            {canSign ? "3. Verify signatures" : "Verify signatures"}
          </h2>

          <form className="max-w-xl space-y-4" onSubmit={verifyDocument}>
            {docList.length > 0 && (
              <label className="block space-y-1">
                <span>Choose a document</span>
                <select
                  className={input}
                  value={verifyDocumentId}
                  onChange={(event) => {
                    setVerifyDocumentId(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="">Select a document</option>
                  {docList.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.filename}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-1">
              <span>Document ID</span>
              <input
                className={input}
                required
                placeholder="Paste a document ID"
                value={verifyDocumentId}
                onChange={(event) => {
                  setVerifyDocumentId(event.target.value);
                  setResult(null);
                }}
              />
            </label>

            <button className={button} disabled={Boolean(busy)}>
              {busy === "verify" ? "Verifying…" : "Verify"}
            </button>
          </form>

          {result && (
            <div className="mt-5 space-y-3 text-sm">
              <p>
                Document integrity:{" "}
                <strong>
                  {result.document_integrity_valid ? "Valid" : "Failed"}
                </strong>
              </p>

              {!result.has_signatures && <p>No signatures recorded.</p>}

              {result.signatures.map((signature) => (
                <div key={signature.id} className="rounded border p-3">
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
            </div>
          )}
        </section>
      )}

      {!canSign && !canVerify && (
        <p>You do not have signing or verification permission.</p>
      )}
    </main>
  );
}