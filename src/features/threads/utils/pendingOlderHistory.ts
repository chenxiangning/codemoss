import type { ConversationItem } from "../../../types";
import { THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE } from "./dispatchThreadItemsProgressively";

type PendingOlderHistory = {
  items: ConversationItem[];
  displayedCount: number;
};

const pendingOlderHistoryByThread = new Map<string, PendingOlderHistory>();

export function rememberFullHistoryForWindow(
  threadId: string,
  items: ConversationItem[],
  displayedCount: number,
) {
  const safeDisplayed = Math.max(0, Math.min(displayedCount, items.length));
  if (items.length === 0 || safeDisplayed >= items.length) {
    pendingOlderHistoryByThread.delete(threadId);
    return;
  }
  pendingOlderHistoryByThread.set(threadId, {
    items,
    displayedCount: safeDisplayed,
  });
}

export function clearPendingOlderHistory(threadId: string) {
  pendingOlderHistoryByThread.delete(threadId);
}

export function getPendingOlderHistory(threadId: string) {
  return pendingOlderHistoryByThread.get(threadId) ?? null;
}

export function hasPendingOlderHistory(threadId: string) {
  return getPendingOlderHistoryRemainingCount(threadId) > 0;
}

export function getPendingOlderHistoryRemainingCount(threadId: string) {
  const pending = pendingOlderHistoryByThread.get(threadId);
  if (!pending) {
    return 0;
  }
  return Math.max(0, pending.items.length - pending.displayedCount);
}

export function takeNextOlderHistoryBatch(
  threadId: string,
  batchSize = THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE,
): ConversationItem[] {
  const pending = pendingOlderHistoryByThread.get(threadId);
  if (!pending) {
    return [];
  }
  const hiddenCount = pending.items.length - pending.displayedCount;
  if (hiddenCount <= 0) {
    pendingOlderHistoryByThread.delete(threadId);
    return [];
  }
  const takeCount = Math.min(Math.max(1, batchSize), hiddenCount);
  const hiddenStart = hiddenCount - takeCount;
  const batch = pending.items.slice(hiddenStart, hiddenCount);
  pending.displayedCount += takeCount;
  if (pending.displayedCount >= pending.items.length) {
    pendingOlderHistoryByThread.delete(threadId);
  }
  return batch;
}

export function replacePendingOlderHistoryItems(
  threadId: string,
  items: ConversationItem[],
) {
  const pending = pendingOlderHistoryByThread.get(threadId);
  if (!pending) {
    rememberFullHistoryForWindow(
      threadId,
      items,
      Math.min(THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE, items.length),
    );
    return getPendingOlderHistory(threadId);
  }
  const addedAtEnd = Math.max(0, items.length - pending.items.length);
  const nextDisplayed = Math.min(
    pending.displayedCount + addedAtEnd,
    items.length,
  );
  if (nextDisplayed >= items.length) {
    pendingOlderHistoryByThread.delete(threadId);
    return null;
  }
  pending.items = items;
  pending.displayedCount = nextDisplayed;
  return pending;
}
