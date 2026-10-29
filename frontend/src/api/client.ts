
import axios, {
  AxiosError,
  type AxiosRequestConfig,
} from "axios";

export const API = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type Envelope<T> = {
  success?: boolean;
  message?: string;
  data: T;
};

export type User = {
  id: number | string;
  email: string;
  role: string;
  role_id?: number;
  is_active?: boolean;
  created_at?: string;
};

export type Permission = {
  id?: number;
  name: string;
  description?: string;
};

export type UploadReceipt = {
  id: string;
  filename: string;
  mime_type?: string;
  file_size?: number;
  classification?: string;
  created_at?: string;
};

export type SigningKey = {
  id: string;
  algorithm: string;
  public_key: string;
  status: string;
  usable_for_signing?: boolean;
  created_at?: string;
};

export type Verification = {
  valid?: boolean;
  integrity_valid?: boolean;
  signature_valid?: boolean;
  message?: string;
  details?: string;
  document_id?: string;
  signer_id?: string;
  algorithm?: string;
};

export type DocumentItem = {
  id: string;
  filename: string;
  mime_type?: string;
  file_size?: number;
  classification?: string;
  owner_id?: string | number;
  owner_email?: string;
  created_at?: string;
  updated_at?: string;
  status?: string;
  permissions?: string[];
  can_view?: boolean;
  can_download?: boolean;
  can_share?: boolean;
};

export type DocumentShare = {
  id: string;
  document_id: string;
  user_id?: string | number;
  email?: string;
  permission?: string;
  permissions?: string[];
  expires_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
};

export type StepUpChallengeError = Error & {
  status?: number;
  code?: string;
  challenge_id?: string;
  requires_step_up?: boolean;
  details?: unknown;
};

export type AuditEvent = {
  id: string;
  event_type?: string;
  action?: string;
  actor_id?: string | number;
  actor_email?: string;
  document_id?: string;
  resource_type?: string;
  resource_id?: string;
  outcome?: string;
  risk_score?: number;
  ip_address?: string;
  details?: Record<string, unknown>;
  created_at?: string;
  timestamp?: string;
};

export type AuditStats = {
  total_events?: number;
  successful_events?: number;
  failed_events?: number;
  blocked_events?: number;
  high_risk_events?: number;
  total_documents?: number;
  active_shares?: number;

  total_audit_events?: number;

  status_breakdown?: {
    SUCCESS?: number;
    CHALLENGED?: number;
    DENIED?: number;
    FAILURE?: number;
  };

  risk_distribution?: {
    LOW?: number;
    MEDIUM?: number;
    HIGH?: number;
    CRITICAL?: number;
  };

  [key: string]:
    | number
    | {
        SUCCESS?: number;
        CHALLENGED?: number;
        DENIED?: number;
        FAILURE?: number;
      }
    | {
        LOW?: number;
        MEDIUM?: number;
        HIGH?: number;
        CRITICAL?: number;
      }
    | undefined;
};

type RetryableRequestConfig = AxiosRequestConfig & {
  _retried?: boolean;
};

const unwrap = <T>(response: { data: unknown }): T => {
  const body = response.data as Envelope<T> | T;

  if (
    body !== null &&
    typeof body === "object" &&
    "data" in body
  ) {
    return (body as Envelope<T>).data;
  }

  return body as T;
};

async function refreshSession(): Promise<void> {
  await axios.post(
    "/api/auth/refresh",
    {},
    { withCredentials: true },
  );
}

// Retry failed GET requests once after attempting to refresh the session.
// Do not automatically replay mutations.
API.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      (config.method ?? "get").toLowerCase() === "get" &&
      !config.url?.includes("/auth/")
    ) {
      config._retried = true;

      try {
        await refreshSession();
        return API.request(config);
      } catch {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("session-expired"));
        }
      }
    }

    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          detail?: string | { message?: string };
          message?: string;
          error?: string;
          code?: string;
          challenge_id?: string;
          requires_step_up?: boolean;
        }
      | undefined;

    if (data) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : data.detail?.message;

      const message =
        detail ?? data.message ?? data.error;

      if (message) {
        const enriched = new Error(message) as StepUpChallengeError;

        enriched.status = error.response?.status;
        enriched.code = data.code;
        enriched.challenge_id = data.challenge_id;
        enriched.requires_step_up = data.requires_step_up;

        return enriched.message;
      }
    }

    return error.message || "A network request failed.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

// Use this before protected mutations when the backend requires
// an action-preparation or step-up verification flow.
export async function prepareAction(
  action: string,
  payload?: Record<string, unknown>,
) {
  const response = await API.post("/risk/evaluate", {
    action,
    ...payload,
  });

  return unwrap(response);
}

export const auth = {
  async login(email: string, password: string): Promise<User> {
    const response = await API.post("/auth/login", {
      email,
      password,
    });

    return unwrap<User>(response);
  },

  async register(
    email: string,
    password: string,
    role_id: number,
  ) {
    const response = await API.post("/auth/register", {
      email,
      password,
      role_id,
    });

    return unwrap(response);
  },

  async logout() {
    return API.post("/auth/logout", {});
  },

  async current(): Promise<User> {
    const response = await API.get("/auth/me");
    return unwrap<User>(response);
  },

  async permissions(): Promise<Permission[]> {
    const response = await API.get("/rbac/get-my-permissions");
    const result = unwrap<{ permissions: Permission[] }>(response);
    return result.permissions;
  },
};

export const signatures = {
  async keys(): Promise<SigningKey[]> {
    const response = await API.get("/signatures/keys");
    return unwrap<SigningKey[]>(response);
  },

  async generate(algorithm: string) {
    const response = await API.post("/signatures/keys/generate", {
      algorithm,
    });

    return response;
  },

  async revoke(keyId: string) {
    return API.post(`/signatures/keys/${keyId}/revoke`, {});
  },

  async submit(payload: {
    document_id: string;
    signature: string;
    algorithm: string;
    key_id?: string;
  }) {
    return API.post("/signatures/submit", payload);
  },

  async verify(payload: {
    document_id: string;
    signature?: string;
    key_id?: string;
  }): Promise<Verification> {
    const response = await API.post("/signatures/verify", payload);
    return unwrap<Verification>(response);
  },
};

export async function uploadDocument(
  file: File,
  classification?: string,
): Promise<UploadReceipt> {
  const formData = new FormData();
  formData.append("file", file);

  if (classification) {
    formData.append("classification", classification);
  }

  const response = await API.post("/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return unwrap<UploadReceipt>(response);
}

export async function createWrappingKey() {
  await prepareAction("crypto_keys.create");

  const response = await API.post("/crypto-keys/wrapping", {});

  return unwrap<{
    id: string;
    algorithm: string;
    public_key_pem: string;
    created_at?: string;
  }>(response);
}

export const documents = {
  async list(): Promise<DocumentItem[]> {
    const response = await API.get("/documents/");
    return unwrap<DocumentItem[]>(response);
  },

  async get(id: string): Promise<DocumentItem> {
    const response = await API.get(`/documents/${id}`);
    return unwrap<DocumentItem>(response);
  },

  async view(id: string) {
    return API.get(`/documents/${id}/view`, {
      responseType: "blob",
    });
  },

  async download(id: string) {
    return API.get(`/documents/${id}/download`, {
      responseType: "blob",
    });
  },

  async downloadEncrypted(id: string) {
    return API.get(`/documents/${id}/encrypted`, {
      responseType: "blob",
    });
  },

  async shares(id: string): Promise<DocumentShare[]> {
    const response = await API.get(`/documents/${id}/shares`);
    return unwrap<DocumentShare[]>(response);
  },

  async share(
    id: string,
    payload: {
      email: string;
      permission?: string;
      permissions?: string[];
      expires_at?: string | null;
    },
  ) {
    return API.post(`/documents/${id}/share`, payload);
  },

  async revoke(id: string, shareId: string) {
    return API.post(`/documents/${id}/revoke`, {
      share_id: shareId,
    });
  },
};

export const risk = {
  async evaluate(payload: Record<string, unknown>) {
    const response = await API.post("/risk/evaluate", payload);
    return unwrap(response);
  },

  async verifyStepUp(payload: Record<string, unknown>) {
    const response = await API.post(
      "/risk/step-up/verify",
      payload,
    );

    return unwrap(response);
  },
};

export const audit = {
  async stats(): Promise<AuditStats> {
    const response = await API.get("/audit/stats");
    return unwrap<AuditStats>(response);
  },

  async events(params?: Record<string, unknown>): Promise<AuditEvent[]> {
    const response = await API.get("/audit/events", { params });
    return unwrap<AuditEvent[]>(response);
  },
};

export function saveBlob(
  blob: Blob,
  filename: string,
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
