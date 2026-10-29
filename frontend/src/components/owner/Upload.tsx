import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { CloudUpload, FileText, Download, X } from "lucide-react";
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
      setError("Choose a PDF, DOC, or DOCX document.");
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

    // A previously selected file in the input must not remain there.
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
        "Document uploaded and encrypted. Save the receipt to keep its ID.",
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
    <main className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Upload a document</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a PDF or Word document for encrypted storage.
        </p>
      </div>

      {error && <p role="alert" className="text-red-700">{error}</p>}
      {success && <p role="status" className="text-green-700">{success}</p>}

      <form
        className="max-w-2xl space-y-5 rounded-lg border bg-white p-5"
        onSubmit={submit}
      >
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-center ${
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-300"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <CloudUpload size={32} className="mx-auto text-blue-600" />
          <p className="mt-2 font-medium">Choose a file or drag it here</p>
          <p className="mt-1 text-sm text-slate-500">
            PDF, DOC, or DOCX · Maximum 20 MiB
          </p>

          <input
            ref={inputRef}
            className="mt-4 block w-full text-sm"
            aria-label="Choose document"
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
        </div>

        {file && (
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <FileText size={20} className="shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-slate-500">
                {formatSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Remove selected file"
              disabled={busy}
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm font-medium">Classification</span>
          <select
            className="w-full rounded border px-3 py-2"
            value={classification}
            disabled={busy}
            onChange={(event) => setClassification(event.target.value)}
          >
            <option value="PUBLIC">Public</option>
            <option value="INTERNAL">Internal</option>
            <option value="CONFIDENTIAL">Confidential</option>
            <option value="RESTRICTED">Restricted</option>
          </select>
        </label>

        <button
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={busy || !file}
        >
          {busy ? "Uploading and encrypting…" : "Upload document"}
        </button>
      </form>

      <section className="rounded-lg border bg-white p-5">
        <h2 className="text-lg font-semibold">Upload Receipts</h2>
        <p className="mt-1 text-sm text-slate-500">
          These receipts are kept for this session. Save one if you need its
          document ID later.
        </p>

        {receipts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No uploads during this session.
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{receipt.filename}</p>
                  <p className="break-all text-xs text-slate-500">
                    ID: {receipt.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {receipt.classification} ·{" "}
                    {receipt.created_at
                      ? new Date(receipt.created_at).toLocaleString()
                      : "Recently uploaded"}
                  </p>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                  onClick={() => saveReceipt(receipt)}
                >
                  <Download size={16} />
                  Save receipt
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}