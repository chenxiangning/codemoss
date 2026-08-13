/**
 * 用户偏好：检索时是否启用本地语义模型。
 * 即使模型已下载就绪，关闭后仍强制词面检索。
 */
export type SemanticRetrievalPreference = "semantic" | "lexical";

export const SEMANTIC_RETRIEVAL_PREFERENCE_KEY =
  "mossx.memoryPick.semanticRetrieval.v1";

export const DEFAULT_SEMANTIC_RETRIEVAL_PREFERENCE: SemanticRetrievalPreference =
  "semantic";

function normalizePreference(
  value: string | null | undefined,
): SemanticRetrievalPreference {
  return value === "lexical" ? "lexical" : "semantic";
}

export function getSemanticRetrievalPreference(): SemanticRetrievalPreference {
  if (typeof window === "undefined") {
    return DEFAULT_SEMANTIC_RETRIEVAL_PREFERENCE;
  }
  return normalizePreference(
    window.localStorage.getItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY),
  );
}

export function setSemanticRetrievalPreference(
  preference: SemanticRetrievalPreference,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY, preference);
}

export function isSemanticRetrievalEnabledByUser(): boolean {
  return getSemanticRetrievalPreference() === "semantic";
}
