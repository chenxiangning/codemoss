import type { MemoryPickComposerMode, MemoryPickSessionPolicy } from "./memoryPickTypes";

export const MEMORY_PICK_SESSION_STORAGE_KEY_PREFIX =
  "mossx.memoryPick.session.v1";

export type PersistedMemoryPickSessionPolicy = {
  v: 1;
  workspaceId: string;
  threadId: string;
  composerMode: MemoryPickComposerMode;
  dismissed: boolean;
  firstPickRequired: boolean;
  alwaysPreferredCount: number;
  updatedAt: number;
};

const COMPOSER_MODES: ReadonlySet<string> = new Set(["off", "pick", "always"]);

export function memoryPickSessionStorageKey(
  workspaceId: string,
  threadId: string,
): string {
  return `${MEMORY_PICK_SESSION_STORAGE_KEY_PREFIX}:${workspaceId}:${threadId}`;
}

function normalizeComposerMode(value: unknown): MemoryPickComposerMode {
  if (value === "single") return "pick";
  if (typeof value === "string" && COMPOSER_MODES.has(value)) {
    return value as MemoryPickComposerMode;
  }
  return "off";
}

function normalizePreferredCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 3;
  return Math.max(0, Math.floor(value));
}

/** 白名单 normalize；非法结构返回 null */
export function normalizePersistedMemoryPickSessionPolicy(
  raw: unknown,
  workspaceId: string,
  threadId: string,
): PersistedMemoryPickSessionPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  if (
    typeof record.workspaceId === "string" &&
    record.workspaceId !== workspaceId
  ) {
    return null;
  }
  if (typeof record.threadId === "string" && record.threadId !== threadId) {
    return null;
  }
  return {
    v: 1,
    workspaceId,
    threadId,
    composerMode: normalizeComposerMode(record.composerMode),
    dismissed: record.dismissed === true,
    firstPickRequired: record.firstPickRequired !== false,
    alwaysPreferredCount: normalizePreferredCount(record.alwaysPreferredCount),
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : Date.now(),
  };
}

export function policyFromPersisted(
  persisted: PersistedMemoryPickSessionPolicy,
): MemoryPickSessionPolicy {
  return {
    composerMode: persisted.composerMode,
    dismissed: persisted.dismissed,
    firstPickRequired: persisted.firstPickRequired,
    alwaysPreferredCount: persisted.alwaysPreferredCount,
  };
}

export function toPersistedPolicy(
  workspaceId: string,
  threadId: string,
  policy: MemoryPickSessionPolicy,
  now = Date.now(),
): PersistedMemoryPickSessionPolicy {
  return {
    v: 1,
    workspaceId,
    threadId,
    composerMode: policy.composerMode,
    dismissed: policy.dismissed,
    firstPickRequired: policy.firstPickRequired,
    alwaysPreferredCount: policy.alwaysPreferredCount,
    updatedAt: now,
  };
}

export function loadMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
): MemoryPickSessionPolicy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      memoryPickSessionStorageKey(workspaceId, threadId),
    );
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const normalized = normalizePersistedMemoryPickSessionPolicy(
      parsed,
      workspaceId,
      threadId,
    );
    return normalized ? policyFromPersisted(normalized) : null;
  } catch {
    return null;
  }
}

export function saveMemoryPickSessionPolicy(
  workspaceId: string,
  threadId: string,
  policy: MemoryPickSessionPolicy,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload = toPersistedPolicy(workspaceId, threadId, policy);
    window.localStorage.setItem(
      memoryPickSessionStorageKey(workspaceId, threadId),
      JSON.stringify(payload),
    );
  } catch {
    // 配额 / 隐私模式：静默失败，内存态仍可用
  }
}

/** 测试辅助：清除单个 key */
export function clearMemoryPickSessionPersistence(
  workspaceId: string,
  threadId: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(
      memoryPickSessionStorageKey(workspaceId, threadId),
    );
  } catch {
    // ignore
  }
}
