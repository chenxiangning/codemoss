import type { AgentProjectionV1 } from "../types";
import { getAgentRoundList } from "./agentStore";

export type HistoryFoldRecord = {
  workspaceId: string;
  threadId: string;
  runId: string;
  roundIndex: number;
  projection: AgentProjectionV1;
};

const byItemId = new Map<string, HistoryFoldRecord>();
const MAX = 256;

export function historyFoldItemId(runId: string): string {
  return `agent:${runId}:hist-fold`;
}

export function isHistoryFoldItemId(id: string | null | undefined): boolean {
  return Boolean(
    id &&
      (/^agent:.+:hist-fold$/.test(id) || /^agent:.+:orch-card$/.test(id)),
  );
}

export function registerHistoryFold(record: HistoryFoldRecord): string {
  const id = historyFoldItemId(record.runId);
  byItemId.set(id, record);
  // 兼容旧 orch-card id
  byItemId.set(`agent:${record.runId}:orch-card`, record);
  while (byItemId.size > MAX) {
    const oldest = byItemId.keys().next().value;
    if (!oldest) break;
    byItemId.delete(oldest);
  }
  return id;
}

export function parseRunIdFromHistFoldItemId(id: string): string | null {
  const m = id.match(/^agent:(.+):(hist-fold|orch-card)$/);
  return m?.[1] ?? null;
}

export function getHistoryFoldByItemId(
  id: string | null | undefined,
  workspaceId?: string | null,
  threadId?: string | null,
): HistoryFoldRecord | null {
  if (!id) return null;
  const runId = parseRunIdFromHistFoldItemId(id);
  const cached = byItemId.get(id);

  // 有 workspace/thread 时始终用 roundList 刷新 roundIndex / projection，
  // 避免新轮归档后旧缓存一直显示「第1轮」
  if (runId && workspaceId && threadId) {
    const rounds = getAgentRoundList(workspaceId, threadId);
    const idx = rounds.findIndex((r) => r.runId === runId);
    if (idx >= 0) {
      const record: HistoryFoldRecord = {
        workspaceId,
        threadId,
        runId,
        roundIndex: idx,
        projection: rounds[idx]!,
      };
      registerHistoryFold(record);
      return record;
    }
  }

  if (cached) return cached;
  return null;
}
