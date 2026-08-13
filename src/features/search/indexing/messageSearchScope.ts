import type { ConversationItem, ThreadSummary } from "../../../types";

/** Safety valve: do not linearly scan dozens of loaded transcripts on the main thread. */
export const MESSAGE_SEARCH_MAX_OPEN_THREADS = 12;

export function resolveMessageSearchThreadIds(input: {
  threads: Array<Pick<ThreadSummary, "id"> & { updatedAt?: number }>;
  threadItemsByThread: Record<string, ConversationItem[]>;
  activeThreadId?: string | null;
  maxOpenThreads?: number;
}): string[] {
  const maxOpenThreads = input.maxOpenThreads ?? MESSAGE_SEARCH_MAX_OPEN_THREADS;
  const workspaceThreadIds = new Set(input.threads.map((thread) => thread.id));
  const loadedIds = new Set(
    Object.entries(input.threadItemsByThread)
      .filter(([, items]) => Array.isArray(items) && items.length > 0)
      .map(([threadId]) => threadId),
  );

  const selected: string[] = [];
  const push = (threadId: string | null | undefined) => {
    if (!threadId || !workspaceThreadIds.has(threadId) || selected.includes(threadId)) {
      return;
    }
    if (threadId === input.activeThreadId || loadedIds.has(threadId)) {
      selected.push(threadId);
    }
  };

  push(input.activeThreadId ?? null);

  const rest = input.threads
    .filter((thread) => thread.id !== input.activeThreadId && loadedIds.has(thread.id))
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
  for (const thread of rest) {
    if (selected.length >= maxOpenThreads) {
      break;
    }
    push(thread.id);
  }
  return selected;
}
