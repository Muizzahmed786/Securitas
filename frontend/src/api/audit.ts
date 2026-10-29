import { API, unwrap } from "./http";
export type AuditEvent = {
  id: number; request_id: string; user_id: number | null; user_email: string | null;
  document_id: string | null; risk_event_id: string | null;
  action: string; status: "SUCCESS" | "FAILURE" | "DENIED" | "CHALLENGED";
  ip_address: string | null; timestamp: string; metadata: Record<string, unknown>;
};
export type AuditStats = {
  total_audit_events: number; status_breakdown: Record<string, number>;
  action_breakdown: Record<string, number>; risk_distribution: Record<string, number>;
  integrity_failures: number;
};
export type AuditFilters = {
  action?: string; status?: string; user_id?: number; limit?: number; offset?: number;
};
export const audit = {
  async stats(): Promise<AuditStats> { return unwrap<AuditStats>(await API.get("/audit/stats")); },
  async events(params?: AuditFilters): Promise<AuditEvent[]> {
    return unwrap<AuditEvent[]>(await API.get("/audit/events", { params }));
  },
};
