/**
 * full-catalog 自动重扫冷却：timeout / degraded / force-enter 后禁止同 workspace
 * 在冷却窗内再次自动 ensure full-catalog（用户 force refresh 可 clear）。
 */

export const FULL_CATALOG_AUTO_RETRY_COOLDOWN_MS = 60_000;

type CooldownEntry = {
  untilMs: number;
  reason: string;
};

const cooldownByWorkspaceId = new Map<string, CooldownEntry>();

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function markFullCatalogAutoRetryCooldown(
  workspaceId: string,
  reason: string,
  cooldownMs: number = FULL_CATALOG_AUTO_RETRY_COOLDOWN_MS,
): void {
  const id = workspaceId.trim();
  if (!id) {
    return;
  }
  cooldownByWorkspaceId.set(id, {
    untilMs: nowMs() + Math.max(0, cooldownMs),
    reason,
  });
}

export function clearFullCatalogAutoRetryCooldown(workspaceId: string): void {
  cooldownByWorkspaceId.delete(workspaceId.trim());
}

export function isFullCatalogAutoRetryBlocked(workspaceId: string): boolean {
  const id = workspaceId.trim();
  if (!id) {
    return false;
  }
  const entry = cooldownByWorkspaceId.get(id);
  if (!entry) {
    return false;
  }
  if (nowMs() >= entry.untilMs) {
    cooldownByWorkspaceId.delete(id);
    return false;
  }
  return true;
}

/** For diagnostic dump. */
export function getFullCatalogAutoRetryBlockedSnapshot(): string[] {
  const now = nowMs();
  const lines: string[] = [];
  for (const [workspaceId, entry] of cooldownByWorkspaceId) {
    if (now >= entry.untilMs) {
      continue;
    }
    lines.push(
      `${workspaceId}:${entry.reason}:remainingMs=${Math.round(entry.untilMs - now)}`,
    );
  }
  return lines;
}

/** @internal */
export function resetFullCatalogAutoRetryForTests(): void {
  cooldownByWorkspaceId.clear();
}
