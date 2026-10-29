import axios, { AxiosError, type AxiosRequestConfig } from "axios";

export const API = axios.create({ baseURL: "/api", withCredentials: true });

type Envelope<T> = { data: T; success: boolean; message: string };
export function unwrap<T>(response: { data: Envelope<T> }): T {
  return response.data.data;
}

type RetryConfig = AxiosRequestConfig & { _retried?: boolean };
let refreshing: Promise<unknown> | null = null;

// Refresh once on protected reads. Mutations must be retried by the user.
API.interceptors.response.use(undefined, async (error: AxiosError) => {
  // Axios also uses a Blob for error responses when responseType is "blob".
  // Decode it so the OTP challenge and its message remain available.
  if (error.response?.data instanceof Blob && error.response.data.type.includes("json")) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch { /* Keep the original error when the body is invalid. */ }
  }
  const config = error.config as RetryConfig | undefined;
  if (error.response?.status !== 401 || !config || config._retried ||
      (config.method ?? "get").toLowerCase() !== "get" ||
      config.url?.includes("/auth/")) return Promise.reject(error);

  config._retried = true;
  try {
    refreshing ??= axios.post("/api/auth/refresh-access-token", {}, { withCredentials: true })
      .finally(() => { refreshing = null; });
    await refreshing;
    return API.request(config);
  } catch {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(error);
  }
});

export type ApiErrorBody = {
  message?: string;
  detail?: string;
  errors?: { step_up_required?: boolean; challenge_id?: string;
    challenge_otp?: string; risk_score?: number; risk_level?: string; reason?: string };
};

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error))
    return error.response?.data?.message ?? error.response?.data?.detail ?? error.message;
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}

export function stepUpChallenge(error: unknown): ApiErrorBody["errors"] | null {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return null;
  const details = error.response?.data?.errors;
  return details?.step_up_required && details.challenge_id ? details : null;
}
