import { useState } from "react";
import { createWrappingKey, errorMessage, saveBlob } from "../../api/client";

type WrappingKey = Awaited<ReturnType<typeof createWrappingKey>>;

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
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    if (!key) return;
    setError("");
    setCopied(false);

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
      new Blob([key.public_key_pem], { type: "text/plain" }),
      `wrapping-public-${key.id}.pem`,
    );
  }

  return (
    <main className="max-w-2xl space-y-4 p-6">
      <p>Administrator tools</p>
      <h1 className="text-2xl font-bold">Encryption setup</h1>
      <p>
        Create the system RSA wrapping key used to protect document
        encryption keys.
      </p>

      {error && <p role="alert" className="text-red-700">{error}</p>}

      <section className="space-y-4 border p-4">
        <h2 className="text-lg font-bold">Initialize document encryption</h2>
        <p>
          Run this once before the first document upload. The server creates
          an RSA key pair and stores the encrypted private key in its
          protected key directory.
        </p>
        <p>
          If a wrapping key is already configured, the server will report
          that it exists. Existing keys are kept; this action does not
          rotate them.
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
            <p role="status">Encryption initialized</p>
            <p className="break-all">Key ID: {key.id}</p>
            <button type="button" className="border px-3 py-2" onClick={copyId}>
              Copy key ID
            </button>
            {copied && <p role="status">Key ID copied.</p>}
            <p>Algorithm: {key.algorithm}</p>
            <button
              type="button"
              className="block border px-3 py-2"
              onClick={downloadPublicKey}
            >
              Save public key
            </button>
          </div>
        )}
      </section>

      <section className="space-y-3 border p-4">
        <h2 className="text-lg font-bold">Private keys stay protected</h2>
        <p>
          The wrapping private key is never returned to the browser.
          Your administrator must configure its storage directory and
          passphrase on the server before initialization.
        </p>
      </section>
    </main>
  );
}
