import { API, unwrap } from "./http";

export type WrappingKey = {
  id: string;
  purpose: "KEY_WRAPPING";
  algorithm: "RSA-OAEP-SHA256";
  key_size_bits: number;
  status: string;
  public_key_pem: string;
  created_at: string;
};

export type CryptoBenchmark = {
  iterations: number;
  payload_limit_bytes: number;
  tested_sizes: Array<{
    size_bytes: number;
    size_label: string;
    encrypt_ms: number;
    decrypt_ms: number;
    encrypt_throughput_mb_s: number;
    decrypt_throughput_mb_s: number;
  }>;
  key_wrapping_rsa_oaep: {
    payload: string;
    key_size_bits: number;
    wrap_ms: number;
    unwrap_ms: number;
    note: string;
  };
  digital_signatures_rsa_pss: {
    payload: string;
    key_size_bits: number;
    sign_ms: number;
    verify_ms: number;
    note: string;
  };
};

export async function createWrappingKey(stepUpToken?: string): Promise<WrappingKey> {
  return unwrap<WrappingKey>(await API.post("/crypto-keys/wrapping", {}, {
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : {},
  }));
}

export async function getCryptoBenchmark(): Promise<CryptoBenchmark> {
  return unwrap<CryptoBenchmark>(await API.get("/crypto-keys/benchmark"));
}
