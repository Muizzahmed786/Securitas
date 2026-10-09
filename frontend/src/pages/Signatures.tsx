import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { signatures, errorMessage, saveBlob } from "../api/client";
import type { SigningKey, Verification } from "../api/client";
import { signLocally } from "../api/signing";
import { useAuth } from "../context/AuthContext";

import {
  Alert,
  Card,
  PageHeading,
  validUUID,
} from "../components/UI";

export default function Signatures() {
  const { can, receipts } = useAuth();

  const canSign = can("documents.sign");
  const canVerify = can("documents.verify");

  const [keys, setKeys] = useState<SigningKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  const [documentId, setDocumentId] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [privateKeyFile, setPrivateKeyFile] = useState<File | null>(null);

  const [verifyId, setVerifyId] = useState("");
  const [result, setResult] = useState<Verification | null>(null);

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canSign) return;

    let active = true;
    setLoadingKeys(true);

    signatures
      .keys()
      .then((data) => {
        if (active) setKeys(data);
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingKeys(false);
      });

    return () => {
      active = false;
    };
  }, [canSign]);

  function start(action: string) {
    setBusy(action);
    setError("");
    setMessage("");
  }

  async function generateKeys() {
    start("generate");

    try {
      // Blank passphrase creates a PEM usable by our browser helper.
      const response = await signatures.generate("");

      const id = String(
        response.headers["x-signing-key-id"] || "",
      ).trim();

      saveBlob(
        response.data,
        validUUID(id)
          ? `signing-${id}.pem`
          : "signing-private-key.pem",
      );

      setMessage(
        "Key created. Save the downloaded private PEM—you will need it to sign.",
      );

      // Refresh separately: failure here does not mean generation failed.
      try {
        setKeys(await signatures.keys());
      } catch {
        setError(
          "The key was created, but the key list could not refresh. Reload the page before signing.",
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function signDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    start("sign");

    try {
      const id = documentId.trim();

      if (!validUUID(id)) {
        throw new Error("Choose a document or enter its valid document ID.");
      }

      if (!documentFile || !privateKeyFile) {
        throw new Error("Choose the original document and private-key PEM.");
      }

      // Fetch current keys so newly created or revoked keys are accounted for.
      const currentKeys = await signatures.keys();
      setKeys(currentKeys);

      const activeKeys = currentKeys.filter(
        (key) =>
          key.usable_for_signing &&
          key.algorithm === "RSA-PSS-SHA256",
      );

      if (!activeKeys.length) {
        throw new Error("Create an active signing key first.");
      }

      // Try the ID in the downloaded filename first, when available.
      const filenameId = privateKeyFile.name.match(
        /^signing-([0-9a-f-]{36})\.pem$/i,
      )?.[1];

      const candidates = [
        ...activeKeys.filter((key) => key.id === filenameId),
        ...activeKeys.filter((key) => key.id !== filenameId),
      ];

      let matchedKeyId = "";
      let signature = "";

      for (const key of candidates) {
        try {
          signature = await signLocally(
            documentFile,
            privateKeyFile,
            key.public_key_pem,
          );

          matchedKeyId = key.id;
          break;
        } catch (error) {
          // The existing helper gives this error for a different public key.
          // Other errors, such as an invalid/encrypted PEM, should stop signing.
          const mismatch =
            error instanceof Error &&
            error.message.startsWith(
              "This private PEM does not match the selected signing key.",
            );

          if (!mismatch) throw error;
        }
      }

      if (!matchedKeyId) {
        throw new Error(
          "This PEM does not match any of your active signing keys.",
        );
      }

      await signatures.submit(id, matchedKeyId, signature);

      setMessage("Document signature verified and saved.");
      setDocumentFile(null);
      setPrivateKeyFile(null);
      setResult(null);

      form
        .querySelectorAll<HTMLInputElement>('input[type="file"]')
        .forEach((input) => {
          input.value = "";
        });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function verifyDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    start("verify");
    setResult(null);

    try {
      const id = verifyId.trim();

      if (!validUUID(id)) {
        throw new Error("Choose a document or enter its valid document ID.");
      }

      setResult(await signatures.verify(id));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Documents"
        title="Digital signatures"
        description="Generate a key, sign a document, and verify its signature."
      />

      <Alert message={error} />
      <Alert message={message} success />

      <datalist id="uploaded-documents">
        {receipts.map((receipt) => (
          <option key={receipt.id} value={receipt.id}>
            {receipt.filename}
          </option>
        ))}
      </datalist>

      {canSign && (
        <>
          <Card>
            <h2 className="section-heading">1. Generate keys</h2>

            <p className="my-3 text-sm text-slate-500">
              Your public key is saved on the server. Your private key
              downloads as a PEM file—keep it safe on your device.
            </p>

            <button
              type="button"
              className="btn-primary"
              disabled={Boolean(busy)}
              onClick={generateKeys}
            >
              {busy === "generate"
                ? "Generating…"
                : "Generate & download key"}
            </button>
          </Card>

          <Card>
            <h2 className="section-heading">2. Sign a document</h2>

            <form onSubmit={signDocument}>
              <fieldset
                disabled={Boolean(busy)}
                className="mt-4 max-w-2xl space-y-4"
              >
                <label className="field-label">
                  Uploaded document
                  <input
                    className="input-style"
                    list="uploaded-documents"
                    placeholder="Choose or paste the document ID"
                    value={documentId}
                    onChange={(event) =>
                      setDocumentId(event.target.value)
                    }
                    required
                  />
                </label>

                <label className="field-label">
                  Original document file
                  <input
                    className="input-style"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(event) =>
                      setDocumentFile(event.target.files?.[0] || null)
                    }
                    required
                  />
                </label>

                <label className="field-label">
                  Private key
                  <input
                    className="input-style"
                    type="file"
                    accept=".pem"
                    onChange={(event) =>
                      setPrivateKeyFile(event.target.files?.[0] || null)
                    }
                    required
                  />
                </label>

                <p className="text-xs text-slate-500">
                  Choose the exact file you uploaded. Signing happens
                  in your browser; your private key is not uploaded.
                </p>

                <button
                  className="btn-primary"
                  disabled={Boolean(busy) || loadingKeys}
                >
                  {busy === "sign" ? "Signing…" : "Sign document"}
                </button>

                {!loadingKeys &&
                  !keys.some((key) => key.usable_for_signing) && (
                    <p className="text-xs text-slate-500">
                      Generate a signing key above before signing.
                    </p>
                  )}
              </fieldset>
            </form>
          </Card>
        </>
      )}

      {canVerify && (
        <Card>
          <h2 className="section-heading">
            {canSign ? "3. Verify a document" : "Verify a document"}
          </h2>

          <form onSubmit={verifyDocument}>
            <fieldset
              disabled={Boolean(busy)}
              className="mt-4 max-w-2xl space-y-4"
            >
              <label className="field-label">
                Uploaded document
                <input
                  className="input-style"
                  list="uploaded-documents"
                  placeholder="Choose or paste the document ID"
                  value={verifyId}
                  onChange={(event) => {
                    setVerifyId(event.target.value);
                    setResult(null);
                  }}
                  required
                />
              </label>

              <button className="btn-primary">
                {busy === "verify" ? "Verifying…" : "Verify"}
              </button>
            </fieldset>
          </form>

          {result && (
            <div className="mt-5 space-y-3 text-sm">
              <p
                className={
                  result.document_integrity_valid
                    ? "text-emerald-700"
                    : "text-red-600"
                }
              >
                {result.document_integrity_valid
                  ? "Stored document integrity verified."
                  : "Stored document integrity check failed."}
              </p>

              {!result.has_signatures ? (
                <p className="text-slate-500">
                  This document has no recorded signatures.
                </p>
              ) : (
                result.signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p
                      className={
                        signature.cryptographically_valid
                          ? "font-medium text-emerald-700"
                          : "font-medium text-red-600"
                      }
                    >
                      {signature.cryptographically_valid
                        ? "Signature valid"
                        : "Signature invalid"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Signer: {signature.signer_id} · Key status:{" "}
                      {signature.key_status}
                    </p>

                    {!signature.key_usable_now && (
                      <p className="mt-1 text-xs text-amber-700">
                        This key is no longer usable for new signatures.
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      )}

      {!canSign && !canVerify && (
        <p className="text-sm text-slate-500">
          Your account does not have signing or verification permission.
        </p>
      )}
    </>
  );
}