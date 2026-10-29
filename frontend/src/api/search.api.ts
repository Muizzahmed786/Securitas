import { API, unwrap } from "./http";
import type { DocumentItem } from "./documents";

export type SearchResult = {
  documents: DocumentItem[];
  has_more: boolean;
};

export async function searchDocuments(
  query: string,
  challengeId?: string,
  otp?: string,
): Promise<SearchResult> {
  const body = {
    query: query.trim(),
    ...(challengeId && otp
      ? {
          challenge_id: challengeId,
          otp: otp.trim(),
        }
      : {}),
  };

  return unwrap<SearchResult>(await API.post("/search", body));
}