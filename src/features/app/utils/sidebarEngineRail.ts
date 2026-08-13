import type { ThreadSummary } from "../../../types";

export const SIDEBAR_ENGINE_RAIL_ORDER = [
  "shared",
  "claude",
  "codex",
  "gemini",
  "grok",
  "kimi",
  "opencode",
  "pi",
] as const;

export type SidebarEngineRailId = (typeof SIDEBAR_ENGINE_RAIL_ORDER)[number];

const STORAGE_PREFIX = "mossx.sidebarEngineRail.";
const SEEN_PREFIX = "mossx.sidebarEngineRailsSeen.";

export function resolveSidebarRailId(
  thread: Pick<ThreadSummary, "id" | "engineSource" | "threadKind">,
): SidebarEngineRailId {
  const id = String(thread.id ?? "").trim();
  if (thread.threadKind === "shared" || id.startsWith("shared:")) {
    return "shared";
  }
  const engine = String(thread.engineSource ?? "").trim().toLowerCase();
  if ((SIDEBAR_ENGINE_RAIL_ORDER as readonly string[]).includes(engine)) {
    return engine as SidebarEngineRailId;
  }
  const prefix = id.split(":")[0]?.toLowerCase() ?? "";
  if ((SIDEBAR_ENGINE_RAIL_ORDER as readonly string[]).includes(prefix)) {
    return prefix as SidebarEngineRailId;
  }
  return "codex";
}

export function readSeenSidebarEngineRails(
  workspaceId: string,
): SidebarEngineRailId[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(`${SEEN_PREFIX}${workspaceId}`);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return SIDEBAR_ENGINE_RAIL_ORDER.filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
}

export function rememberSidebarEngineRails(
  workspaceId: string,
  rails: readonly SidebarEngineRailId[],
): SidebarEngineRailId[] {
  const next = SIDEBAR_ENGINE_RAIL_ORDER.filter(
    (id) => rails.includes(id) || readSeenSidebarEngineRails(workspaceId).includes(id),
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${SEEN_PREFIX}${workspaceId}`, JSON.stringify(next));
    } catch {
      // Ignore quota / private mode.
    }
  }
  return next;
}

export function collectSidebarEngineRails(
  threads: readonly ThreadSummary[],
  workspaceId?: string,
): SidebarEngineRailId[] {
  const present = new Set<SidebarEngineRailId>();
  threads.forEach((thread) => {
    present.add(resolveSidebarRailId(thread));
  });
  const fromThreads = SIDEBAR_ENGINE_RAIL_ORDER.filter((id) => present.has(id));
  if (!workspaceId) {
    return fromThreads;
  }
  rememberSidebarEngineRails(workspaceId, fromThreads);
  // Only show engines that currently have visible rows. Remembered rails
  // are for restart hints, not empty icons (Shared bindings look like Codex
  // in Index but must stay hidden on the Codex rail).
  if (threads.length === 0) {
    return rememberSidebarEngineRails(workspaceId, fromThreads);
  }
  return fromThreads;
}

export function filterThreadsForEngineRail(
  threads: readonly ThreadSummary[],
  railId: SidebarEngineRailId | null,
): ThreadSummary[] {
  if (!railId) {
    return [...threads];
  }
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  const keep = new Set<string>();
  threads.forEach((thread) => {
    if (resolveSidebarRailId(thread) !== railId) {
      return;
    }
    let cursor: ThreadSummary | undefined = thread;
    while (cursor && !keep.has(cursor.id)) {
      keep.add(cursor.id);
      const parentId = cursor.parentThreadId?.trim();
      cursor = parentId ? byId.get(parentId) : undefined;
    }
  });
  return threads.filter((thread) => keep.has(thread.id));
}

export function readPersistedSidebarEngineRail(
  workspaceId: string,
): SidebarEngineRailId | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${workspaceId}`)?.trim();
    if (raw && (SIDEBAR_ENGINE_RAIL_ORDER as readonly string[]).includes(raw)) {
      return raw as SidebarEngineRailId;
    }
  } catch {
    return null;
  }
  return null;
}

export function persistSidebarEngineRail(
  workspaceId: string,
  railId: SidebarEngineRailId,
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, railId);
  } catch {
    // Ignore quota / private mode.
  }
}

export function resolveRailForActiveThreadChange(params: {
  previousActiveThreadId: string | null | undefined;
  nextActiveThreadId: string | null | undefined;
  threads: readonly ThreadSummary[];
}): SidebarEngineRailId | null {
  const nextId = params.nextActiveThreadId?.trim() || null;
  const previousId = params.previousActiveThreadId?.trim() || null;
  if (!nextId || nextId === previousId) {
    return null;
  }
  const active = params.threads.find((thread) => thread.id === nextId);
  if (!active) {
    return null;
  }
  return resolveSidebarRailId(active);
}

export function resolveDefaultSidebarEngineRail(params: {
  workspaceId: string;
  threads: readonly ThreadSummary[];
  activeThreadId?: string | null;
}): SidebarEngineRailId | null {
  const rails = collectSidebarEngineRails(params.threads);
  if (rails.length === 0) {
    return null;
  }
  const active = params.threads.find((thread) => thread.id === params.activeThreadId);
  if (active) {
    const activeRail = resolveSidebarRailId(active);
    if (rails.includes(activeRail)) {
      return activeRail;
    }
  }
  const persisted = readPersistedSidebarEngineRail(params.workspaceId);
  if (persisted && rails.includes(persisted)) {
    return persisted;
  }
  return rails[0] ?? null;
}
