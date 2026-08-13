/**
 * Successful full-catalog freshness window.
 *
 * After multi-engine full-catalog settles, soft auto re-scans (focus-refresh,
 * quiet re-ensure) should not re-run expensive session CLI fan-out for a short
 * TTL. Explicit force refresh always clears this window.
 */

export const FULL_CATALOG_FRESH_TTL_MS = 60_000;

type FreshEntry = {
  untilMs: number;
};

const freshUntilByWorkspaceId = new Map<string, FreshEntry>();

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function markFullCatalogFresh(
  workspaceId: string,
  ttlMs: number = FULL_CATALOG_FRESH_TTL_MS,
): void {
  const id = workspaceId.trim();
  if (!id) {
    return;
  }
  freshUntilByWorkspaceId.set(id, {
    untilMs: nowMs() + Math.max(0, ttlMs),
  });
}

export function clearFullCatalogFresh(workspaceId: string): void {
  freshUntilByWorkspaceId.delete(workspaceId.trim());
}

export function isFullCatalogFresh(workspaceId: string): boolean {
  const id = workspaceId.trim();
  if (!id) {
    return false;
  }
  const entry = freshUntilByWorkspaceId.get(id);
  if (!entry) {
    return false;
  }
  if (nowMs() >= entry.untilMs) {
    freshUntilByWorkspaceId.delete(id);
    return false;
  }
  return true;
}

/** For diagnostic dump / tests. */
export function getFullCatalogFreshSnapshot(): string[] {
  const now = nowMs();
  const lines: string[] = [];
  for (const [workspaceId, entry] of freshUntilByWorkspaceId) {
    if (now >= entry.untilMs) {
      continue;
    }
    lines.push(
      `${workspaceId}:remainingMs=${Math.round(entry.untilMs - now)}`,
    );
  }
  return lines;
}

/** @internal */
export function resetFullCatalogFreshForTests(): void {
  freshUntilByWorkspaceId.clear();
}
