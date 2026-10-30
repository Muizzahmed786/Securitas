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
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error("Search query cannot be empty.");
  }
  if (cleanQuery.length > 300) {
    throw new Error("Search query cannot exceed 300 characters.");
  }

  const body = {
    query: cleanQuery,
    ...(challengeId && otp
      ? {
          challenge_id: challengeId,
          otp: otp.trim(),
        }
      : {}),
  };

  return unwrap<SearchResult>(await API.post("/search", body));
}
