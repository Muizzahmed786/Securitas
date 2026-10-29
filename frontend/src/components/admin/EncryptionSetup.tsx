import { useState } from "react";
import { createWrappingKey, type WrappingKey } from "../../api/cryptoKeys";
import { errorMessage } from "../../api/http";
import { saveBlob } from "../../api/documents";

export default function EncryptionSetup() {
  const [key, setKey] = useState<WrappingKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    setCopied(false);

    try {
      setKey(await createWrappingKey());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    if (!key) return;

    try {
      await navigator.clipboard.writeText(key.id);
      setCopied(true);
    } catch {
      setError("Could not copy the key ID. Select and copy it manually.");
    }
  }

  function downloadPublicKey() {
    if (!key) return;

    saveBlob(
      new Blob([key.public_key_pem], { type: "application/x-pem-file" }),
      `wrapping-public-${key.id}.pem`,
    );
  }

  return (
    <main className="max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Encryption setup</h1>
      <p>
        Initialize the system key used to protect document encryption keys.
        Do this once before uploading documents.
      </p>

      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-4 border p-4">
        <h2 className="text-lg font-bold">Document wrapping key</h2>
        <p>
          The server stores the private key in its configured key directory.
          This action cannot rotate an existing active key.
        </p>

        <button
          type="button"
          className="border px-3 py-2"
          disabled={busy || key !== null}
          onClick={create}
        >
          {busy ? "Creating key…" : "Initialize encryption"}
        </button>

        {key && (
          <div className="space-y-3 border-t pt-4">
            <p role="status">Encryption initialized.</p>
            <p className="break-all">Key ID: {key.id}</p>
            <p>Algorithm: {key.algorithm}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="border px-3 py-2"
                onClick={copyId}
              >
                Copy key ID
              </button>
              <button
                type="button"
                className="border px-3 py-2"
                onClick={downloadPublicKey}
              >
                Save public key
              </button>
            </div>

            {copied && <p role="status">Key ID copied.</p>}
          </div>
        )}
      </section>

      <p className="text-sm text-slate-600">
        The private key is never sent to the browser. Configure its storage
        directory and passphrase on the server before initialization.
      </p>
    </main>
  );
}