import { API, unwrap } from "./http";

export type DocumentItem = {
  id: string; owner_id: number; owner_email?: string; filename: string;
  mime_type?: string; file_size_bytes?: number; classification?: string;
  content_hash?: string; created_at?: string; updated_at?: string;
  permission?: "OWNER" | "READ" | "DOWNLOAD" | "VERIFY";
  access_permission?: string; is_owner?: boolean; signature_count?: number;
};
export type UploadReceipt = Pick<DocumentItem,
  "id" | "filename" | "mime_type" | "file_size_bytes" | "classification" | "created_at">;
export type SignatureCheck = {
  id: string; signer_id: number; signing_key_id: string; signed_at: string;
  cryptographically_valid: boolean; key_status: string; key_usable_now: boolean;
};
export type DocumentVerification = {
  document_id: string; document_integrity_valid: boolean; content_hash: string;
  has_signatures: boolean; signatures: SignatureCheck[];
};

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MiB
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const VALID_CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];

export async function uploadDocument(file: File, classification = "INTERNAL"): Promise<UploadReceipt> {
  if (!file) {
    throw new Error("A document file is required.");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error("File exceeds maximum upload size of 20 MiB.");
  }
  const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Only PDF, DOC, and DOCX files are supported.");
  }
  const cleanClassification = classification.trim().toUpperCase();
  if (!VALID_CLASSIFICATIONS.includes(cleanClassification)) {
    throw new Error("Classification must be PUBLIC, INTERNAL, CONFIDENTIAL, or RESTRICTED.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("classification", cleanClassification);
  return unwrap<UploadReceipt>(await API.post("/documents/upload", form));
}

export const documents = {
  async list(): Promise<DocumentItem[]> { return unwrap<DocumentItem[]>(await API.get("/documents/")); },
  async get(id: string): Promise<DocumentItem> { return unwrap<DocumentItem>(await API.get(`/documents/${id}`)); },
  async view(id: string, stepUpToken?: string): Promise<Blob> {
    const response = await API.get(`/documents/${id}/view`, {
      responseType: "blob", headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : {},
    });
    return response.data;
  },
  async download(id: string, stepUpToken?: string): Promise<Blob> {
    const response = await API.get(`/documents/${id}/download`, {
      responseType: "blob", headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : {},
    });
    return response.data;
  },
  async downloadEncrypted(id: string): Promise<Blob> {
    return (await API.get(`/documents/${id}/encrypted`, { responseType: "blob" })).data;
  },
  async verify(id: string): Promise<DocumentVerification> {
    return unwrap<DocumentVerification>(await API.post(`/documents/${id}/verify`, {}));
  },
};

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
