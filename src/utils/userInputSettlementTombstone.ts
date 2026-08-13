/**
 * Session-scoped settlement tombstone for RequestUserInput / AskUserQuestion.
 *
 * After accepted / stale / completed settlement, the same identity must not
 * re-enter the pending queue when a late or replayed non-completed event arrives.
 * Bounded O(1) Set — no polling, no React state.
 */

const MAX_TOMBSTONE_KEYS = 2048;

const settledIdentityKeys = new Set<string>();

export function markUserInputRequestSettled(identityKey: string): void {
  const key = identityKey.trim();
  if (!key) {
    return;
  }
  if (settledIdentityKeys.size >= MAX_TOMBSTONE_KEYS && !settledIdentityKeys.has(key)) {
    settledIdentityKeys.clear();
  }
  settledIdentityKeys.add(key);
}

export function isUserInputRequestSettled(identityKey: string): boolean {
  const key = identityKey.trim();
  if (!key) {
    return false;
  }
  return settledIdentityKeys.has(key);
}

/** Test-only: clear all tombstones. */
export function resetUserInputSettlementTombstonesForTests(): void {
  settledIdentityKeys.clear();
}

export const USER_INPUT_SETTLEMENT_TOMBSTONE_MAX_KEYS = MAX_TOMBSTONE_KEYS;
