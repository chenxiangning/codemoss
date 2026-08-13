import {
  ALWAYS_TOP_K,
  type MemoryPickCandidate,
  type MemoryPickRetrieveResult,
} from "./memoryPickTypes";
import { selectTopKIds } from "./memoryPickPolicy";
import {
  retrieveMemoryCandidatesKernel,
  type MemoryRetrieveListFn,
} from "./memoryRetrieveKernel";
import type {
  ProjectMemoryEmbeddingIndexRecord,
  ProjectMemoryEmbeddingProvider,
} from "../utils/projectMemorySemanticRetrieval";

/**
 * 检索候选：统一走 MemoryRetrieveKernel（lexical + 可选 semantic hybrid）。
 * - 「你好」等无有效相关命中 → 空候选 + emptyReason（不是超时）
 * - 无 provider → retrievalMode=lexical（诚实）
 * - 有 provider 且可用 → hybrid/semantic；失败降级 lexical
 */
export async function retrieveMemoryPickCandidates(params: {
  workspaceId: string;
  query: string;
  listFn: MemoryRetrieveListFn;
  limit?: number;
  timeoutMs?: number;
  semanticProvider?: ProjectMemoryEmbeddingProvider | null;
  allowTestSemanticProvider?: boolean;
  indexRecords?: ProjectMemoryEmbeddingIndexRecord[];
}): Promise<MemoryPickRetrieveResult> {
  return retrieveMemoryCandidatesKernel(params);
}

export function pickAlwaysTopKCandidateIds(
  candidates: MemoryPickCandidate[],
  topK: number = ALWAYS_TOP_K,
): string[] {
  return selectTopKIds(
    candidates.map((c) => ({
      id: c.id,
      score: c.score,
      updatedAt: c.updatedAt,
    })),
    topK,
  );
}
