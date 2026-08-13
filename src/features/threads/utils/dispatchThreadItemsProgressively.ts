import type { ConversationItem } from "../../../types";

/** Default batch size for progressive history hydration into the thread store. */
export const THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE = 80;

export type ThreadItemsDispatch = (action: {
  type: "setThreadItems" | "prependThreadItems";
  threadId: string;
  items: ConversationItem[];
}) => void;

export type DispatchThreadItemsMode = "tail-first" | "atomic";

export type DispatchThreadItemsResult = {
  displayedCount: number;
  remainingOlderCount: number;
};

export type DispatchThreadItemsProgressivelyOptions = {
  /** Items per first-paint window. Defaults to {@link THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE}. */
  batchSize?: number;
  /**
   * `tail-first` (default): paint the newest window only.
   * `atomic`: write the full list in one `setThreadItems` (fork / late merge).
   */
  mode?: DispatchThreadItemsMode;
  /**
   * Yield between batches so the browser can paint. Defaults to a macrotask
   * (`setTimeout(0)`). Kept for callers/tests; tail-first first-paint no longer loops.
   */
  yieldBetweenBatches?: () => Promise<void>;
  /** Abort progressive expansion when the resume request is superseded. */
  shouldContinue?: () => boolean;
};

function emptyResult(): DispatchThreadItemsResult {
  return { displayedCount: 0, remainingOlderCount: 0 };
}

/**
 * Dispatch history items into the thread store without one multi-thousand-item
 * main-thread commit. Large lists first-paint the newest window; older rows stay
 * with the caller for on-demand prepend.
 */
export async function dispatchThreadItemsProgressively(
  dispatch: ThreadItemsDispatch,
  threadId: string,
  items: ConversationItem[],
  options?: DispatchThreadItemsProgressivelyOptions,
): Promise<DispatchThreadItemsResult> {
  const batchSize = Math.max(
    1,
    options?.batchSize ?? THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE,
  );
  const shouldContinue = options?.shouldContinue ?? (() => true);
  const mode = options?.mode ?? "tail-first";

  if (items.length === 0) {
    return emptyResult();
  }

  if (!shouldContinue()) {
    return emptyResult();
  }

  if (mode === "atomic" || items.length <= batchSize) {
    dispatch({ type: "setThreadItems", threadId, items });
    return { displayedCount: items.length, remainingOlderCount: 0 };
  }

  const displayedCount = batchSize;
  dispatch({
    type: "setThreadItems",
    threadId,
    items: items.slice(-displayedCount),
  });
  return {
    displayedCount,
    remainingOlderCount: items.length - displayedCount,
  };
}
