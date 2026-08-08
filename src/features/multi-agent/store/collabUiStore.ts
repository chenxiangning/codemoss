import { useSyncExternalStore } from "react";

/**
 * 协作主幕「进行中」UI 态：在 projection 尚未创建 / 终态汇总空窗期，
 * 仍展示 sticky 编排窗，避免用户以为中断。
 */

export type CollabUiPhase =
  | "idle"
  | "briefing"
  | "starting_stages"
  | "running_stages"
  | "summarizing"
  | "done";

export type CollabUiState = {
  workspaceId: string;
  threadId: string;
  phase: CollabUiPhase;
  /** 主标题，如「调度对话中」 */
  headline: string;
  /** 副文案，如「即将启动：规划 → 实现 → 审查」 */
  detail: string;
  requestText: string;
  flowLabel: string;
  /** 当前阶段名（运行节点时） */
  activeStageTitle?: string | null;
  /** 当前阶段 id（由展示层结合 projection 解析标题） */
  activeStageId?: string | null;
  updatedAt: number;
};

type ScopeKey = string;

const byScope = new Map<ScopeKey, CollabUiState>();
const listeners = new Set<() => void>();

function scopeKey(workspaceId: string, threadId: string): ScopeKey {
  return `${workspaceId}\u0000${threadId}`;
}

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[collabUiStore] listener failed", error);
    }
  }
}

export function getCollabUiState(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): CollabUiState | null {
  if (!workspaceId || !threadId) return null;
  return byScope.get(scopeKey(workspaceId, threadId)) ?? null;
}

export function setCollabUiState(
  next: Omit<CollabUiState, "updatedAt"> | null,
): void {
  if (!next) return;
  const key = scopeKey(next.workspaceId, next.threadId);
  byScope.set(key, { ...next, updatedAt: Date.now() });
  emit();
}

export function patchCollabUiState(
  workspaceId: string,
  threadId: string,
  patch: Partial<
    Pick<
      CollabUiState,
      "phase" | "headline" | "detail" | "activeStageTitle" | "activeStageId" | "flowLabel"
    >
  >,
): void {
  const key = scopeKey(workspaceId, threadId);
  const prev = byScope.get(key);
  if (!prev) {
    // 汇总/运行相位若被提前 clear，仍允许重建，避免 loading 整段消失
    if (
      patch.phase === "summarizing" ||
      patch.phase === "running_stages" ||
      patch.phase === "starting_stages"
    ) {
      byScope.set(key, {
        workspaceId,
        threadId,
        phase: patch.phase,
        headline: patch.headline ?? "",
        detail: patch.detail ?? "",
        requestText: "",
        flowLabel: patch.flowLabel ?? "",
        activeStageTitle: patch.activeStageTitle ?? null,
        activeStageId: patch.activeStageId ?? null,
        updatedAt: Date.now(),
      });
      emit();
    }
    return;
  }
  byScope.set(key, { ...prev, ...patch, updatedAt: Date.now() });
  emit();
}

export function clearCollabUiState(
  workspaceId: string,
  threadId: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  if (!byScope.has(key)) return;
  byScope.delete(key);
  emit();
}

export function useCollabUiState(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): CollabUiState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => getCollabUiState(workspaceId, threadId),
    () => null,
  );
}
