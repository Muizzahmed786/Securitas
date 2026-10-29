import { API, unwrap } from "./http";
export type WrappingKey = {
  id: string; purpose: "KEY_WRAPPING"; algorithm: "RSA-OAEP-SHA256";
  key_size_bits: number; status: string; public_key_pem: string; created_at: string;
};
export async function createWrappingKey(): Promise<WrappingKey> {
  return unwrap<WrappingKey>(await API.post("/crypto-keys/wrapping", {}));
}
