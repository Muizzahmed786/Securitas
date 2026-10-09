import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

export type Envelope<T> = {
  data: T;
  message: string;
  success: boolean;
  statusCode: number;
};
export type User = {
  id: number;
  email: string;
  role: string;
  role_id: number;
  is_active: boolean;
  created_at: string;
};
export type Permission = {
  id: number;
  name: string;
  description: string | null;
};
export type UploadReceipt = {
  id: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  classification: string;
  created_at: string;
};
export type SigningKey = {
  id: string;
  algorithm: string;
  public_key_pem: string;
  status: string;
  created_at: string;
  usable_for_signing: boolean;
};
export type Verification = {
  document_id: string;
  document_integrity_valid: boolean;
  has_signatures: boolean;
  signatures: {
    id: string;
    signer_id: number;
    signing_key_id: string;
    signed_at: string;
    cryptographically_valid: boolean;
    key_status: string;
    key_usable_now: boolean;
  }[];
};

type RetriableConfig = InternalAxiosRequestConfig & { retried?: boolean };
export const API = axios.create({ baseURL: "/api", withCredentials: true });
let refresh: Promise<unknown> | null = null;
API.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* Keep the HTTP error for unreadable responses. */
      }
    }
    const config = error.config as RetriableConfig | undefined;
    // Only read requests are replayed automatically. Key creation/sign/upload
    // mutations must never run twice when the outcome is uncertain.
    if (
      error.response?.status === 401 &&
      config &&
      config.method === "get" &&
      !config.retried
    ) {
      config.retried = true;
      refresh ??= API.post("/auth/refresh-access-token").finally(() => {
        refresh = null;
      });
      try {
        await refresh;
        return await API.request(config);
      } catch {
        window.dispatchEvent(new Event("securitas-session-expired"));
      }
    }
    throw error;
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (error.response?.status === 422)
      return "Check the fields and try again.";
    if (error.response?.status === 401)
      return "Your session has expired. Sign in again.";
    if (error.response?.status === 403)
      return "Your account does not have permission for this action.";
    if (!error.response)
      return "Cannot reach the server. Check that the backend is running.";
    return `The request could not be completed (${error.response.status}).`;
  }
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
export async function prepareAction() {
  // Refresh before a mutation rather than replaying it after failure.
  await API.get("/auth/get-current-user");
}
export const auth = {
  current: async () =>
    (await API.get<Envelope<User>>("/auth/get-current-user")).data.data,
  permissions: async () =>
    (
      await API.get<Envelope<{ permissions: Permission[] }>>(
        "/rbac/get-my-permissions",
      )
    ).data.data.permissions,
  login: async (email: string, password: string) =>
    (
      await API.post<Envelope<{ user: User }>>("/auth/login", {
        email,
        password,
      })
    ).data.data.user,
  register: async (email: string, password: string, role_id: number) =>
    API.post("/auth/register", { email, password, role_id }),
  logout: async () => API.post("/auth/logout"),
};
export const signatures = {
  keys: async () =>
    (await API.get<Envelope<SigningKey[]>>("/signatures/keys")).data.data,
  generate: async (passphrase: string) => {
    await prepareAction();
    return API.post(
      "/signatures/keys/generate",
      { passphrase: passphrase || null },
      { responseType: "blob" },
    );
  },
  revoke: async (id: string) => {
    await prepareAction();
    return API.post(`/signatures/keys/${id}/revoke`);
  },
  submit: async (
    id: string,
    signing_key_id: string,
    signature_base64: string,
  ) => {
    await prepareAction();
    return API.post(`/signatures/documents/${id}`, {
      signing_key_id,
      signature_base64,
    });
  },
  verify: async (id: string) =>
    (
      await API.get<Envelope<Verification>>(
        `/signatures/documents/${id}/verify`,
      )
    ).data.data,
};
export async function uploadDocument(file: File, classification: string) {
  await prepareAction();
  const data = new FormData();
  data.append("file", file);
  data.append("classification", classification);
  return (await API.post<Envelope<UploadReceipt>>("/documents/upload", data))
    .data.data;
}
export async function createWrappingKey() {
  await prepareAction();
  return (
    await API.post<
      Envelope<{
        id: string;
        algorithm: string;
        public_key_pem: string;
        created_at: string;
      }>
    >("/crypto-keys/wrapping")
  ).data.data;
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
