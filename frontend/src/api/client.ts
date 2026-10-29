// Compatibility entry point. New components can import from individual feature files.
export { API, errorMessage, stepUpChallenge } from "./http";
export { auth } from "./auth";
export type { User, Permission } from "./auth";
export { documents, uploadDocument, saveBlob } from "./documents";
export type { DocumentItem, UploadReceipt, DocumentVerification } from "./documents";
export { sharing } from "./sharing";
export type { DocumentShare, ShareInput } from "./sharing";
export { signatures } from "./signatures";
export type { SigningKey, SignatureVerification } from "./signatures";
export { risk } from "./risk";
export { audit } from "./audit";
export type { AuditEvent, AuditStats } from "./audit";
export { createWrappingKey } from "./cryptoKeys";
