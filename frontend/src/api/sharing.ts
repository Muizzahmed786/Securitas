import { API, unwrap } from "./http";

export type DocumentShare = {
  id: number; document_id: string; user_id: number; recipient_email: string;
  permission: "READ" | "DOWNLOAD"; status: "ACTIVE" | "EXPIRED" | "REVOKED";
  expires_at: string | null; revoked_at: string | null; created_at: string;
};
export type ShareInput = {
  recipient_email: string; permission: "READ" | "DOWNLOAD"; expires_at?: string | null;
};
export type ShareReceipt = {
  id: number; document_id: string; recipient_id: number; recipient_email: string;
  permission: "READ" | "DOWNLOAD"; expires_at: string | null; created_at: string;
};
export const sharing = {
  async list(documentId: string): Promise<DocumentShare[]> {
    return unwrap<DocumentShare[]>(await API.get(`/documents/${documentId}/shares`));
  },
  async create(documentId: string, payload: ShareInput): Promise<ShareReceipt> {
    return unwrap<ShareReceipt>(await API.post(`/documents/${documentId}/share`, payload));
  },
  async revoke(documentId: string, accessId: number): Promise<{ access_id: number; revoked: boolean }> {
    return unwrap(await API.post(`/documents/${documentId}/revoke`, { access_id: accessId }));
  },
};
