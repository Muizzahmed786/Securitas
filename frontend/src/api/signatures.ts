import { API, unwrap } from "./http";
import type { SignatureCheck } from "./documents";

export type SigningKey = {
  id: string; algorithm: "RSA-PSS-SHA256"; public_key_pem: string;
  status: string; usable_for_signing: boolean; created_at: string;
  expires_at: string | null; revoked_at: string | null;
};
export type SignatureVerification = {
  document_id: string; document_integrity_valid: boolean;
  has_signatures: boolean; signatures: (SignatureCheck & {
    expires_at: string | null; revoked_at: string | null;
  })[];
};
export const signatures = {
  async keys(): Promise<SigningKey[]> {
    return unwrap<SigningKey[]>(await API.get("/signatures/keys"));
  },
  async generate(): Promise<{ file: Blob; keyId: string }> {
    const response = await API.post<Blob>("/signatures/keys/generate", {}, { responseType: "blob" });
    return { file: response.data, keyId: response.headers["x-signing-key-id"] ?? "" };
  },
  async revoke(keyId: string): Promise<void> {
    await API.post(`/signatures/keys/${keyId}/revoke`, {});
  },
  async submit(documentId: string, signingKeyId: string, signatureBase64: string): Promise<{
    id: string; document_id: string; signing_key_id: string; signed_at: string;
  }> {
    return unwrap(await API.post(`/signatures/documents/${documentId}`, {
      signing_key_id: signingKeyId, signature_base64: signatureBase64,
    }));
  },
  async verify(documentId: string): Promise<SignatureVerification> {
    return unwrap<SignatureVerification>(await API.get(`/signatures/documents/${documentId}/verify`));
  },
};
