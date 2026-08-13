import type { ThreadSummary } from "../../../types";
import { expandHiddenSharedBindingIds } from "../../shared-session/runtime/sharedSessionSummaries";
import { threadIdInHiddenSharedBindingSet } from "./useThreadActions.helpers";

export type SharedNativeVisibilityFreshness = "verified" | "partial" | "unavailable" | string;

export type SharedNativeVisibilityProjection = {
  available: boolean;
  freshness?: SharedNativeVisibilityFreshness | null;
  hiddenNativeIds?: string[] | null;
  protocolHiddenNativeIds?: string[] | null;
  reason?: string | null;
};

const lastVerifiedHideByWorkspace = new Map<string, Set<string>>();

export function resetSharedNativeVisibilityMemory(): void {
  lastVerifiedHideByWorkspace.clear();
}

export function isFullyVerifiedSharedNativeVisibility(
  projection: SharedNativeVisibilityProjection | null | undefined,
): boolean {
  return Boolean(projection?.available) && projection?.freshness === "verified";
}

export function isUsableSharedNativeVisibility(
  projection: SharedNativeVisibilityProjection | null | undefined,
): boolean {
  return isFullyVerifiedSharedNativeVisibility(projection);
}

export function hiddenIdsFromVisibilityProjection(
  projection: SharedNativeVisibilityProjection | null | undefined,
): string[] {
  if (!projection) {
    return [];
  }
  return [
    ...(projection.hiddenNativeIds ?? []),
    ...(projection.protocolHiddenNativeIds ?? []),
  ].map((id) => id.trim()).filter(Boolean);
}

export function expandVisibilityHideSet(
  projection: SharedNativeVisibilityProjection | null | undefined,
): Set<string> {
  return expandHiddenSharedBindingIds(hiddenIdsFromVisibilityProjection(projection));
}

export function rememberVerifiedSharedHide(
  workspaceId: string,
  hideSet: ReadonlySet<string>,
): void {
  const key = workspaceId.trim();
  if (!key) {
    return;
  }
  lastVerifiedHideByWorkspace.set(key, new Set(hideSet));
}

export function lastVerifiedSharedHide(workspaceId: string): Set<string> {
  const stored = lastVerifiedHideByWorkspace.get(workspaceId.trim());
  return stored ? new Set(stored) : new Set();
}

export function hasVerifiedSharedHide(workspaceId: string): boolean {
  return lastVerifiedHideByWorkspace.has(workspaceId.trim());
}

export function unionHideSets(
  ...sets: Array<ReadonlySet<string> | Iterable<string> | null | undefined>
): Set<string> {
  const merged = new Set<string>();
  sets.forEach((set) => {
    if (!set) {
      return;
    }
    for (const id of set) {
      const trimmed = String(id).trim();
      if (trimmed) {
        merged.add(trimmed);
      }
    }
  });
  return expandHiddenSharedBindingIds(merged);
}

export function shouldExcludeOrdinaryNativeRow(
  threadId: string,
  hideSet: ReadonlySet<string>,
): boolean {
  const id = threadId.trim();
  if (!id || id.startsWith("shared:")) {
    return false;
  }
  return threadIdInHiddenSharedBindingSet(id, hideSet);
}

export function isSharedCanonicalThread(
  thread: Pick<ThreadSummary, "id" | "threadKind">,
): boolean {
  const id = String(thread.id ?? "").trim();
  return thread.threadKind === "shared" || id.startsWith("shared:");
}

export function rememberVerifiedSharedHideIfComplete(
  workspaceId: string,
  projection: SharedNativeVisibilityProjection | null | undefined,
  hideSet: ReadonlySet<string>,
): void {
  if (!isFullyVerifiedSharedNativeVisibility(projection)) {
    return;
  }
  rememberVerifiedSharedHide(workspaceId, hideSet);
}

export function strengthenVerifiedSharedHide(
  workspaceId: string,
  extraHide: ReadonlySet<string> | Iterable<string>,
): void {
  if (!hasVerifiedSharedHide(workspaceId)) {
    return;
  }
  rememberVerifiedSharedHide(
    workspaceId,
    unionHideSets(lastVerifiedSharedHide(workspaceId), extraHide),
  );
}

export function mergePreservedSharedThreadsForIndexFirstPaint(
  indexSummaries: ThreadSummary[],
  ...sources: Array<readonly ThreadSummary[] | undefined>
): ThreadSummary[] {
  const byId = new Map<string, ThreadSummary>();
  sources.forEach((source) => {
    (source ?? []).forEach((thread) => {
      if (!isSharedCanonicalThread(thread)) {
        return;
      }
      const id = thread.id.trim();
      if (!id || byId.has(id)) {
        return;
      }
      byId.set(id, thread);
    });
  });
  indexSummaries.forEach((summary) => {
    if (!byId.has(summary.id)) {
      byId.set(summary.id, summary);
    }
  });
  return Array.from(byId.values()).sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    return left.id.localeCompare(right.id);
  });
}
