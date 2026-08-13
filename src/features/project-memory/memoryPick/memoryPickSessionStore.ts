import type {
  MemoryPickComposerMode,
  MemoryPickSessionPolicy,
} from "./memoryPickTypes";
import {
  applyComposerMode,
  applyFirstPickCompleted,
  applySessionDismissed,
  createDefaultSessionPolicy,
} from "./memoryPickPolicy";
import {
  loadMemoryPickSessionPolicy,
  saveMemoryPickSessionPolicy,
} from "./memoryPickSessionPersistence";

function sessionKey(workspaceId: string, threadId: string) {
  return `${workspaceId}\u0000${threadId}`;
}

const policies = new Map<string, MemoryPickSessionPolicy>();
const listeners = new Set<() => void>();

/** debounce persist timers per session key */
const persistTimers = new Map<string, number>();
const PERSIST_DEBOUNCE_MS = 80;

function emit() {
  listeners.forEach((listener) => listener());
}

function schedulePersist(
  workspaceId: string,
  threadId: string,
  policy: MemoryPickSessionPolicy,
) {
  const key = sessionKey(workspaceId, threadId);
  const existing = persistTimers.get(key);
  if (existing != null && typeof window !== "undefined") {
    window.clearTimeout(existing);
  }
  if (typeof window === "undefined") {
    saveMemoryPickSessionPolicy(workspaceId, threadId, policy);
    return;
  }
  const timer = window.setTimeout(() => {
    persistTimers.delete(key);
    saveMemoryPickSessionPolicy(workspaceId, threadId, policy);
  }, PERSIST_DEBOUNCE_MS);
  persistTimers.set(key, timer);
}

function writePolicy(
  workspaceId: string,
  threadId: string,
  next: MemoryPickSessionPolicy,
) {
  const key = sessionKey(workspaceId, threadId);
  policies.set(key, next);
  schedulePersist(workspaceId, threadId, next);
  emit();
}

function hydrateIfNeeded(
  workspaceId: string,
  threadId: string,
): MemoryPickSessionPolicy {
  const key = sessionKey(workspaceId, threadId);
  const existing = policies.get(key);
  if (existing) return existing;

  const loaded = loadMemoryPickSessionPolicy(workspaceId, threadId);
  if (loaded) {
    policies.set(key, loaded);
    return loaded;
  }

  const created = createDefaultSessionPolicy("off", { firstPickRequired: true });
  policies.set(key, created);
  return created;
}

export function getMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
): MemoryPickSessionPolicy {
  return hydrateIfNeeded(workspaceId, threadId);
}

export function setMemoryPickComposerMode(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  // 同 mode 重复写入（每轮 send 同步）不得清掉 session dismissed
  if (prev.composerMode === composerMode) {
    return;
  }
  writePolicy(workspaceId, threadId, applyComposerMode(prev, composerMode));
}

/**
 * 用户从 Composer 菜单显式切换模式（含 off）。
 * off 时写入 session，覆盖 gate 固化的 pick，真正关闭后续闸门（opt-in）。
 */
export function forceMemoryPickComposerModeFromMenu(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  if (composerMode === "off") {
    writePolicy(workspaceId, threadId, {
      ...prev,
      composerMode: "off",
      // 显式关闭 = 本功能关闭；不再被 firstPick 强弹
      firstPickRequired: false,
      dismissed: false,
    });
    return;
  }
  writePolicy(workspaceId, threadId, applyComposerMode(prev, composerMode));
}

export function markMemoryPickFirstPickDone(
  workspaceId: string,
  threadId: string,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  writePolicy(workspaceId, threadId, applyFirstPickCompleted(prev));
}

export function markMemoryPickSessionDismissed(
  workspaceId: string,
  threadId: string,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  writePolicy(workspaceId, threadId, applySessionDismissed(prev));
}

/** 一直开启：记住用户本次确认勾选数量，供下轮按相关分预勾 */
export function setMemoryPickAlwaysPreferredCount(
  workspaceId: string,
  threadId: string,
  count: number,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  const next = Math.max(0, Math.floor(count));
  if (prev.alwaysPreferredCount === next) return;
  writePolicy(workspaceId, threadId, { ...prev, alwaysPreferredCount: next });
}

export function clearMemoryPickSessionDismissed(
  workspaceId: string,
  threadId: string,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  writePolicy(workspaceId, threadId, { ...prev, dismissed: false });
}

/**
 * dismiss 恢复入口：清 dismiss + mode=pick + firstPickRequired=false。
 * 不恢复 always，避免一恢复就读秒。
 */
export function restoreMemoryPickFromDismiss(
  workspaceId: string,
  threadId: string,
) {
  const prev = getMemoryPickSessionPolicy(workspaceId, threadId);
  writePolicy(workspaceId, threadId, {
    ...prev,
    dismissed: false,
    composerMode: "pick",
    firstPickRequired: false,
  });
}

/** 新 thread 应调用以重置 session 级状态（保留 composerMode 可由调用方写入） */
export function resetMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
  composerMode: MemoryPickComposerMode = "off",
) {
  writePolicy(
    workspaceId,
    threadId,
    createDefaultSessionPolicy(composerMode, { firstPickRequired: true }),
  );
}

export function subscribeMemoryPickSessionStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 测试用：立即 flush 所有 pending persist */
export function __flushMemoryPickSessionPersistForTests() {
  if (typeof window === "undefined") return;
  for (const timer of persistTimers.values()) {
    window.clearTimeout(timer);
  }
  persistTimers.clear();
  for (const [key, policy] of policies.entries()) {
    const [workspaceId, threadId] = key.split("\u0000");
    if (workspaceId && threadId) {
      saveMemoryPickSessionPolicy(workspaceId, threadId, policy);
    }
  }
}

/** 测试用 */
export function __resetMemoryPickSessionStoreForTests() {
  if (typeof window !== "undefined") {
    for (const timer of persistTimers.values()) {
      window.clearTimeout(timer);
    }
  }
  persistTimers.clear();
  policies.clear();
  emit();
}
