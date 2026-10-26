
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

export type DocumentItem = {
  id: string;
  owner_id: number;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  classification: string;
  content_hash: string;
  permission?: "OWNER" | "READ" | "DOWNLOAD";
  access_permission?: "OWNER" | "READ" | "DOWNLOAD";
  created_at: string;
};

export type DocumentShare = {
  id: number;
  document_id: string;
  user_id: number;
  user_email?: string;
  permission: "READ" | "DOWNLOAD";
  granted_by: number;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type StepUpChallengeError = {
  step_up_required: boolean;
  challenge_id: string;
  risk_score: number;
  risk_level: string;
  reason: string;
  challenge_otp?: string;
};

export type AuditEvent = {
  id: number;
  request_id: string;
  user_id: number | null;
  user_email: string | null;
  document_id: string | null;
  risk_event_id: string | null;
  action: string;
  status: "SUCCESS" | "FAILURE" | "DENIED" | "CHALLENGED";
  ip_address: string | null;
  timestamp: string;
  metadata: Record<string, any>;
};

export type AuditStats = {
  total_audit_events: number;
  status_breakdown: Record<string, number>;
  action_breakdown: Record<string, number>;
  risk_distribution: Record<string, number>;
  integrity_failures: number;
};

export const documents = {
  list: async () =>
    (await API.get<Envelope<DocumentItem[]>>("/documents/")).data.data,

  get: async (id: string) =>
    (await API.get<Envelope<DocumentItem>>(`/documents/${id}`)).data.data,

  view: async (id: string, stepUpToken?: string) => {
    const headers: Record<string, string> = {};
    if (stepUpToken) {
      headers["X-Step-Up-Token"] = stepUpToken;
    }
    return await API.get(`/documents/${id}/view`, {
      responseType: "blob",
      headers,
    });
  },

  download: async (id: string, stepUpToken?: string) => {
    const headers: Record<string, string> = {};
    if (stepUpToken) {
      headers["X-Step-Up-Token"] = stepUpToken;
    }
    return await API.get(`/documents/${id}/download`, {
      responseType: "blob",
      headers,
    });
  },

  downloadEncrypted: async (id: string) => {
    return await API.get(`/documents/${id}/encrypted`, {
      responseType: "blob",
    });
  },

  shares: async (id: string) =>
    (await API.get<Envelope<DocumentShare[]>>(`/documents/${id}/shares`))
      .data.data,

  share: async (
    id: string,
    recipient_email: string,
    permission: "READ" | "DOWNLOAD",
    expires_at?: string | null,
  ) => {
    await prepareAction();
    return (
      await API.post<Envelope<DocumentShare>>(`/documents/${id}/share`, {
        recipient_email,
        permission,
        expires_at: expires_at || null,
      })
    ).data.data;
  },

  revoke: async (id: string, target_user_id: number) => {
    await prepareAction();
    return (
      await API.post<Envelope<{ access_id: number; revoked: boolean }>>(
        `/documents/${id}/revoke`,
        { recipient_id: target_user_id },
      )
    ).data.data;
  },
};

export const risk = {
  evaluate: async (
    action: string,
    classification: string,
    document_id?: string,
  ) => {
    return (
      await API.post<Envelope<any>>("/risk/evaluate", {
        action,
        classification,
        document_id,
      })
    ).data.data;
  },

  verifyStepUp: async (challenge_id: string, otp: string) => {
    return (
      await API.post<
        Envelope<{
          step_up_token: string;
          challenge_id: string;
          status: string;
        }>
      >("/risk/step-up/verify", {
        challenge_id,
        otp,
      })
    ).data.data;
  },
};

export const audit = {
  stats: async () =>
    (await API.get<Envelope<AuditStats>>("/audit/stats")).data.data,

  events: async (params?: {
    action?: string;
    status?: string;
    user_id?: number;
    limit?: number;
  }) => {
    return (
      await API.get<Envelope<AuditEvent[]>>("/audit/events", { params })
    ).data.data;
  },
};
