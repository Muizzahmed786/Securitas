import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { CloudUpload, FileText, Download, X, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  uploadDocument,
  saveBlob,
  type UploadReceipt,
} from "../../api/documents";
import { errorMessage } from "../../api/http";
import { useAuth } from "../../context/AuthContext";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Upload() {
  const { receipts, addReceipt } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [classification, setClassification] = useState("INTERNAL");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function chooseFile(selected?: File) {
    setFile(null);
    setError("");
    setSuccess("");

    if (!selected) return;

    if (!/\.(pdf|doc|docx)$/i.test(selected.name)) {
      setError("Choose a valid PDF, DOC, or DOCX document.");
      return;
    }

    if (selected.size === 0 || selected.size > MAX_FILE_SIZE) {
      setError("Choose a nonempty document no larger than 20 MiB.");
      return;
    }

    setFile(selected);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (busy) return;

    const selected = event.dataTransfer.files[0];
    chooseFile(selected);

    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const receipt = await uploadDocument(file, classification);
      addReceipt(receipt);
      setFile(null);

      if (inputRef.current) inputRef.current.value = "";

      setSuccess(
        "Document uploaded and encrypted with AES-256-GCM. Save receipt for record.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function saveReceipt(receipt: UploadReceipt) {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], {
      type: "application/json",
    });

    saveBlob(blob, `receipt-${receipt.id}.json`);
  }

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
          Envelope Ingestion
        </p>
        <h1 className="mt-1 text-2xl font-light tracking-tight text-white sm:text-3xl">
          Upload & Encrypt
        </h1>
        <p className="mt-1 text-xs text-neutral-400">
          Payload is encrypted via AES-256-GCM and wrapped with tenant RSA-OAEP KEK.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
          <AlertCircle size={15} className="shrink-0 text-red-400" />
          <p role="alert">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
          <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
          <p role="status">{success}</p>
        </div>
      )}

      <form
        className="max-w-2xl space-y-5 rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl"
        onSubmit={submit}
      >
        <div
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragging
              ? "border-amber-400 bg-amber-500/[0.08]"
              : "border-white/15 bg-black/30 hover:border-white/25"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <CloudUpload size={32} className="mx-auto text-amber-400" />
          <p className="mt-3 text-sm font-medium text-white">
            Choose a file or drag it here
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            PDF, DOC, or DOCX · Maximum 20 MiB payload
          </p>

          <input
            ref={inputRef}
            className="mt-4 block w-full text-xs text-neutral-400 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
            aria-label="Choose document"
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>

        {file && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <FileText size={18} className="shrink-0 text-amber-400" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white">{file.name}</p>
                <p className="font-mono text-[10px] text-neutral-400">{formatSize(file.size)}</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Remove selected file"
              disabled={busy}
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="text-neutral-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="field-label">Document Security Classification</label>
          <select
            className="input-style cursor-pointer text-xs"
            value={classification}
            disabled={busy}
            onChange={(event) => setClassification(event.target.value)}
          >
            <option value="PUBLIC">PUBLIC — Minimal restriction, digitally signed</option>
            <option value="INTERNAL">INTERNAL — Tenant role-based isolation</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL — Elevated risk scoring & MFA</option>
            <option value="RESTRICTED">RESTRICTED — Strict multi-party KEK authorization</option>
          </select>
        </div>

        <button
          className="btn-primary w-full justify-center py-3 text-xs tracking-wider uppercase font-semibold disabled:opacity-40"
          disabled={busy || !file}
        >
          {busy ? "Encrypting & Ingesting…" : "Upload & Encrypt Document"}
        </button>
      </form>

      <section className="rounded-2xl border border-white/10 bg-[#121218] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-white">
          Active Upload Receipts
        </h2>
        <p className="mt-1 text-xs text-neutral-400">
          Temporary in-memory receipts for tracking cryptographic IDs during this session.
        </p>

        {receipts.length === 0 ? (
          <p className="mt-4 text-xs text-neutral-500">
            No uploads during this session.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-xs font-medium text-white">{receipt.filename}</p>
                  <p className="font-mono text-[10px] text-amber-400/80">
                    ID: {receipt.id}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {receipt.classification} ·{" "}
                    {receipt.created_at
                      ? new Date(receipt.created_at).toLocaleString()
                      : "Recently uploaded"}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn-secondary text-xs flex items-center gap-1.5"
                  onClick={() => saveReceipt(receipt)}
                >
                  <Download size={13} />
                  <span>Download Receipt JSON</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
