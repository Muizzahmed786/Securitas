import { useState } from "react";
import { KeyRound, Copy, Download, CheckCircle2, AlertCircle } from "lucide-react";
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
      setTimeout(() => setCopied(false), 3000);
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
    <main className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Key Management Infrastructure
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Encryption Setup
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Provision the master RSA-OAEP Key Encryption Key (KEK) used to wrap per-document DEKs.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          <AlertCircle size={16} className="shrink-0 text-red-400" />
          <p role="alert">{error}</p>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              Master Document Wrapping Key (KEK)
            </h2>
            <p className="text-xs text-neutral-400">
              Generated via hardware RNG or isolated tenant key directory.
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-neutral-400">
          Once created, this active RSA-OAEP key will wrap every unique AES-256-GCM data key
          generated during document uploads. Private key bytes remain secured in the server's
          protected keystore.
        </p>

        <button
          type="button"
          className="btn-primary text-xs"
          disabled={busy || key !== null}
          onClick={create}
        >
          {busy ? "Provisioning RSA-OAEP Key…" : "Initialize Master Encryption"}
        </button>

        {key && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 size={16} />
              <span>Master Key Encryption Key Active</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <p className="text-neutral-400">
                Key Identifier: <span className="text-white select-all">{key.id}</span>
              </p>
              <p className="text-neutral-400">
                Algorithm: <span className="text-amber-400">{key.algorithm}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-1.5"
                onClick={copyId}
              >
                <Copy size={13} />
                <span>{copied ? "Copied Key ID" : "Copy Key ID"}</span>
              </button>
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-1.5"
                onClick={downloadPublicKey}
              >
                <Download size={13} />
                <span>Download Public PEM</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
