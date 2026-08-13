import type { SharedSessionSupportedEngine } from "../utils/sharedSessionEngines";
import type { EngineType, ThreadSummary } from "../../../types";
import {
  isSharedSessionSupportedEngine,
  normalizeSharedSessionEngine,
} from "../utils/sharedSessionEngines";

const UNSUPPORTED_SHARED_ENGINE_PREFIXES = [
  "gemini:",
  "gemini-pending-",
] as const;

/** Shared-supported engines whose native list ids use `engine:{raw}` form. */
const SHARED_HIDE_ENGINE_PREFIXES = [
  "claude",
  "codex",
  "kimi",
  "grok",
  "opencode",
] as const;

type SharedSessionSummary = {
  id: string;
  threadId: string;
  title: string;
  updatedAt: number;
  selectedEngine: SharedSessionSupportedEngine;
  nativeThreadIds: string[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function shouldKeepSharedNativeThreadId(value: unknown) {
  const threadId = asString(value).trim();
  if (!threadId) {
    return false;
  }
  const normalized = threadId.toLowerCase();
  return !UNSUPPORTED_SHARED_ENGINE_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix),
  );
}

export function normalizeSharedSessionSummary(value: unknown): SharedSessionSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const threadId = asString(record.threadId ?? record.thread_id).trim();
  if (!threadId || !threadId.startsWith("shared:")) {
    return null;
  }
  const selectedEngine = asString(record.selectedEngine ?? record.selected_engine)
    .trim()
    .toLowerCase();
  const selectedEngineCandidate = selectedEngine as EngineType;
  const normalizedSelectedEngine = normalizeSharedSessionEngine(
    isSharedSessionSupportedEngine(selectedEngineCandidate)
      ? selectedEngineCandidate
      : undefined,
  );
  return {
    id: asString(record.id).trim() || threadId,
    threadId,
    title: asString(record.title).trim() || "Shared Session",
    updatedAt: Math.max(0, asNumber(record.updatedAt ?? record.updated_at)),
    selectedEngine: normalizedSelectedEngine,
    nativeThreadIds: Array.isArray(record.nativeThreadIds ?? record.native_thread_ids)
      ? ((record.nativeThreadIds ?? record.native_thread_ids) as unknown[])
          .map((entry: unknown) => asString(entry).trim())
          .filter(shouldKeepSharedNativeThreadId)
      : [],
  };
}

export function normalizeSharedSessionSummaries(value: unknown): SharedSessionSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const summaries: SharedSessionSummary[] = [];
  value.forEach((entry) => {
    const summary = normalizeSharedSessionSummary(entry);
    if (summary) {
      summaries.push(summary);
    }
  });
  return summaries;
}

/**
 * Expand Shared Hidden Binding ids so hide filters match both raw and
 * `engine:{raw}` forms (catalog uses prefixes; some bindings historically
 * stored raw session ids).
 */
export function expandHiddenSharedBindingIds(
  nativeThreadIds: Iterable<string>,
): Set<string> {
  const expanded = new Set<string>();
  for (const raw of nativeThreadIds) {
    const id = asString(raw).trim();
    if (!id) {
      continue;
    }
    expanded.add(id);
    const lower = id.toLowerCase();
    for (const engine of SHARED_HIDE_ENGINE_PREFIXES) {
      const prefix = `${engine}:`;
      if (lower.startsWith(prefix)) {
        const stripped = id.slice(prefix.length).trim();
        if (stripped) {
          expanded.add(stripped);
        }
      } else if (
        !id.includes(":") ||
        lower.startsWith(`${engine}-pending-`) ||
        lower.startsWith(`${engine}-pending-shared-`)
      ) {
        // raw / pending placeholder → also match catalog form
        expanded.add(`${engine}:${id}`);
      }
    }
  }
  return expanded;
}

export function toSharedThreadSummary(summary: SharedSessionSummary): ThreadSummary {
  return {
    id: summary.threadId,
    name: summary.title,
    updatedAt: summary.updatedAt,
    engineSource: summary.selectedEngine,
    threadKind: "shared",
    selectedEngine: summary.selectedEngine,
    nativeThreadIds: summary.nativeThreadIds,
  };
}

/**
 * native owner id（含 raw / engine: 前缀）→ shared: threadId。
 * 用于把 Shared 隐藏 native owner 下的子代理 parent 改挂到 Shared 会话（引擎无关）。
 */
export function buildNativeOwnerToSharedThreadMap(
  sharedSessions: readonly SharedSessionSummary[],
): Map<string, string> {
  const map = new Map<string, string>();
  sharedSessions.forEach((session) => {
    const sharedId = session.threadId.trim();
    if (!sharedId.startsWith("shared:")) {
      return;
    }
    expandHiddenSharedBindingIds(session.nativeThreadIds).forEach((nativeId) => {
      const key = nativeId.trim();
      if (!key || map.has(key)) {
        return;
      }
      map.set(key, sharedId);
    });
  });
  return map;
}

/**
 * 用 parent id 查找 Shared 父会话（引擎无关）。
 * 覆盖 exact / bare / `engine:raw` 变体，与 expandHiddenSharedBindingIds 对称。
 * 未命中返回 null（调用方保留原 parent，禁止猜标题）。
 */
export function lookupSharedOwnerByNativeParent(
  parentThreadId: string | null | undefined,
  nativeToShared: Map<string, string>,
): string | null {
  const parent = parentThreadId?.trim() || "";
  if (!parent || nativeToShared.size === 0) {
    return null;
  }
  const exact = nativeToShared.get(parent);
  if (exact) {
    return exact;
  }
  const colon = parent.indexOf(":");
  if (colon > 0) {
    const bare = parent.slice(colon + 1).trim();
    if (bare) {
      const byBare = nativeToShared.get(bare);
      if (byBare) {
        return byBare;
      }
    }
    return null;
  }
  // bare / pending：补 engine 前缀再查
  for (const engine of SHARED_HIDE_ENGINE_PREFIXES) {
    const byPrefixed = nativeToShared.get(`${engine}:${parent}`);
    if (byPrefixed) {
      return byPrefixed;
    }
  }
  return null;
}

/**
 * 若 parent 是某 Shared 的 hidden native owner，则改写为 shared: 会话 id。
 * 未命中 owner map 时返回原 parent（保持 native 父子树）。
 */
export function remapParentThreadIdToSharedOwner(
  parentThreadId: string | null | undefined,
  nativeToShared: Map<string, string>,
): string | null {
  const parent = parentThreadId?.trim() || "";
  if (!parent) {
    return null;
  }
  return lookupSharedOwnerByNativeParent(parent, nativeToShared) ?? parent;
}

/**
 * 批量把 threads 上指向 hidden native owner 的 parent 改挂到 Shared。
 * 不删行、不碰 hide set；仅改 parentThreadId。
 * 侧栏「不展示崽子」由 useThreadRows 的 isSharedSidebarHiddenPup 负责（store 保留给幕布/Strip）。
 */
export function remapThreadParentsToSharedOwners(
  threads: ThreadSummary[],
  nativeToShared: Map<string, string>,
): ThreadSummary[] {
  if (nativeToShared.size === 0) {
    return threads;
  }
  let changed = false;
  const next = threads.map((thread) => {
    const currentParent = thread.parentThreadId?.trim() || "";
    if (!currentParent) {
      return thread;
    }
    const remapped = remapParentThreadIdToSharedOwner(currentParent, nativeToShared);
    if (!remapped || remapped === currentParent) {
      return thread;
    }
    changed = true;
    return { ...thread, parentThreadId: remapped };
  });
  return changed ? next : threads;
}

/**
 * 侧栏隐藏用：从当前 list 中 Shared 会话收集「藏崽」父 id 键
 * （shared: 自身 + nativeThreadIds 的 raw/engine: 变体）。
 */
export function buildSharedSidebarHiddenParentKeys(
  threads: readonly ThreadSummary[],
): Set<string> {
  const keys = new Set<string>();
  for (const thread of threads) {
    const isShared =
      thread.threadKind === "shared" || thread.id.startsWith("shared:");
    if (!isShared) {
      continue;
    }
    const sharedId = thread.id.trim();
    if (sharedId) {
      keys.add(sharedId);
    }
    expandHiddenSharedBindingIds(thread.nativeThreadIds ?? []).forEach((id) => {
      if (id) {
        keys.add(id);
      }
    });
  }
  return keys;
}

/**
 * Shared 下崽侧栏隐藏判定（仅 UI 树；不删 store 行）。
 * - parent 为 shared:…
 * - parent 命中 Shared hidden native owner（含 id 形态变体）
 * Native 父子树（parent 为可见 native）→ false。
 */
export function isSharedSidebarHiddenPup(
  thread: { id: string; threadKind?: string | null },
  parentThreadId: string | null | undefined,
  hiddenParentKeys: ReadonlySet<string>,
): boolean {
  if (thread.threadKind === "shared" || thread.id.startsWith("shared:")) {
    return false;
  }
  if (hiddenParentKeys.size === 0) {
    return false;
  }
  const parent = parentThreadId?.trim() || "";
  if (!parent) {
    return false;
  }
  if (parent.startsWith("shared:")) {
    return true;
  }
  if (hiddenParentKeys.has(parent)) {
    return true;
  }
  // 与 lookupSharedOwnerByNativeParent 对称的形态变体
  const colon = parent.indexOf(":");
  if (colon > 0) {
    const bare = parent.slice(colon + 1).trim();
    return Boolean(bare && hiddenParentKeys.has(bare));
  }
  for (const engine of SHARED_HIDE_ENGINE_PREFIXES) {
    if (hiddenParentKeys.has(`${engine}:${parent}`)) {
      return true;
    }
  }
  return false;
}
