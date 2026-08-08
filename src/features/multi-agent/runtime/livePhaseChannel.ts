/**
 * Multi-Agent 阶段直播通道。
 * - 当前轮 live 按 scope 一份
 * - 归档按 runId+phase 保留多轮，切轮/回看不丢全文
 */

export type AgentLivePhaseEntry = {
  attemptId: string;
  phase: string;
  runId?: string;
  text: string;
  version: number;
  updatedAt: number;
};

const entriesByScope = new Map<string, AgentLivePhaseEntry>();
/** scope → runId → phase → text */
const archiveByScope = new Map<string, Map<string, Map<string, string>>>();
const listeners = new Set<() => void>();
const PUBLISH_MS = 48;
let publishTimer: ReturnType<typeof setTimeout> | undefined;
let lastPublishedAt = 0;
let publishedSnapshot = new Map<string, AgentLivePhaseEntry>();

function scopeKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}\u0000${threadId}`;
}

function rememberArchive(
  key: string,
  runId: string | undefined,
  phase: string,
  text: string,
): void {
  if (!phase || !text.trim()) return;
  const rid = (runId ?? "").trim() || "_current";
  let byRun = archiveByScope.get(key);
  if (!byRun) {
    byRun = new Map();
    archiveByScope.set(key, byRun);
  }
  let byPhase = byRun.get(rid);
  if (!byPhase) {
    byPhase = new Map();
    byRun.set(rid, byPhase);
  }
  // 只升不降：保留更长全文
  const prev = byPhase.get(phase) ?? "";
  if (text.length >= prev.length) {
    byPhase.set(phase, text);
  }
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[multi-agent livePhase] listener failed", error);
    }
  }
}

function flushPublish(): void {
  publishTimer = undefined;
  publishedSnapshot = new Map(entriesByScope);
  lastPublishedAt = Date.now();
  notify();
}

function schedulePublish(): void {
  const elapsed = Date.now() - lastPublishedAt;
  if (elapsed >= PUBLISH_MS) {
    flushPublish();
    return;
  }
  if (publishTimer !== undefined) return;
  publishTimer = setTimeout(flushPublish, Math.max(0, PUBLISH_MS - elapsed));
}

export function beginAgentLivePhase(
  workspaceId: string,
  threadId: string,
  attemptId: string,
  phase: string,
  runId?: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  const previous = entriesByScope.get(key);
  if (previous?.phase && previous.text) {
    rememberArchive(key, previous.runId, previous.phase, previous.text);
  }
  entriesByScope.set(key, {
    attemptId,
    phase,
    runId: runId?.trim() || previous?.runId,
    text: "",
    version: 0,
    updatedAt: Date.now(),
  });
  schedulePublish();
}

export function clearAgentLivePhase(
  workspaceId: string,
  threadId: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  const current = entriesByScope.get(key);
  if (current?.phase && current.text) {
    rememberArchive(key, current.runId, current.phase, current.text);
  }
  if (!entriesByScope.has(key) && !publishedSnapshot.has(key)) return;
  entriesByScope.delete(key);
  publishedSnapshot = new Map(entriesByScope);
  notify();
}

/**
 * 新 run 启动：只清当前 live，**保留**历史 run 的归档（多轮回看）。
 */
export function resetAgentLivePhaseArchive(
  workspaceId: string,
  threadId: string,
): void {
  clearAgentLivePhase(workspaceId, threadId);
}

export function getAgentLivePhase(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): AgentLivePhaseEntry | null {
  if (!workspaceId || !threadId) return null;
  return publishedSnapshot.get(scopeKey(workspaceId, threadId)) ?? null;
}

/**
 * 取某 run 某 phase 全文：当前 live（同 run+phase）优先，否则 run 级归档。
 * 兼容：无 runId 时回退任意归档中该 phase 的最长文本。
 */
export function getAgentStageLiveText(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
  phase: string | null | undefined,
  runId?: string | null,
): string {
  if (!workspaceId || !threadId || !phase) return "";
  const key = scopeKey(workspaceId, threadId);
  const live = publishedSnapshot.get(key);
  const rid = runId?.trim() || "";
  if (
    live &&
    live.phase === phase &&
    live.text &&
    (!rid || !live.runId || live.runId === rid)
  ) {
    return live.text;
  }
  const byRun = archiveByScope.get(key);
  if (!byRun) return "";
  if (rid) {
    return byRun.get(rid)?.get(phase) ?? "";
  }
  // 无 runId：取该 phase 最长归档
  let best = "";
  for (const phaseMap of byRun.values()) {
    const text = phaseMap.get(phase) ?? "";
    if (text.length > best.length) best = text;
  }
  return best;
}

let archiveNotifyTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleArchiveNotify(): void {
  // 同 tick 多次 seed 只通知一次，避免阶段结算时 N 次同步 re-render 小卡顿
  if (archiveNotifyTimer !== undefined) return;
  archiveNotifyTimer = setTimeout(() => {
    archiveNotifyTimer = undefined;
    notify();
  }, 0);
}

/** 把 plan.markdown / shortOutcome 补进归档（turn 结束但 live 可能已被 clear） */
export function seedAgentStageArchive(
  workspaceId: string,
  threadId: string,
  runId: string,
  phase: string,
  text: string,
  options?: { notify?: boolean },
): void {
  if (!text.trim()) return;
  rememberArchive(scopeKey(workspaceId, threadId), runId, phase, text);
  if (options?.notify === false) return;
  scheduleArchiveNotify();
}

export function subscribeAgentLivePhase(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
