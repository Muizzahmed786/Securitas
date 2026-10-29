import { API, unwrap } from "./http";
export type RiskEvaluation = {
  risk_score: number; risk_level: string; decision: "ALLOW" | "STEP_UP_AUTH" | "BLOCK";
  reason: string; factors: Record<string, unknown>;
  step_up_challenge_id: string | null; challenge_otp?: string;
};
export type RiskEvent = {
  id: string; request_id: string; user_id: number; document_id: string | null;
  action: string; rbac_allowed: boolean; risk_score: number; risk_level: string;
  factors: Record<string, unknown>; decision: string; reason: string; timestamp: string;
};
export const risk = {
  async evaluate(action: string, document_id?: string, classification?: string): Promise<RiskEvaluation> {
    return unwrap<RiskEvaluation>(await API.post("/risk/evaluate", { action, document_id, classification }));
  },
  async verifyStepUp(challenge_id: string, otp: string): Promise<{ step_up_token: string }> {
    return unwrap(await API.post("/risk/step-up/verify", { challenge_id, otp }));
  },
  async events(): Promise<RiskEvent[]> { return unwrap<RiskEvent[]>(await API.get("/risk/events")); },
  async policy(): Promise<Record<string, unknown>> { return unwrap(await API.get("/risk/policy")); },
};
