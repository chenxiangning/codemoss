import { describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  dispatchThreadItemsProgressively,
  THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE,
} from "./dispatchThreadItemsProgressively";

function makeItems(count: number): ConversationItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    kind: "message" as const,
    role: "assistant" as const,
    text: `msg-${index}`,
  }));
}

describe("dispatchThreadItemsProgressively", () => {
  it("dispatches once when item count is within batch size", async () => {
    const dispatch = vi.fn();
    const items = makeItems(THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE);
    await dispatchThreadItemsProgressively(dispatch, "grok:1", items, {
      yieldBetweenBatches: async () => {},
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "grok:1",
      items,
    });
  });

  it("paints growing prefixes for large histories", async () => {
    const dispatch = vi.fn();
    const items = makeItems(THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE * 2 + 5);
    await dispatchThreadItemsProgressively(dispatch, "grok:big", items, {
      batchSize: 10,
      yieldBetweenBatches: async () => {},
    });
    expect(dispatch.mock.calls.length).toBeGreaterThan(1);
    const first = dispatch.mock.calls[0]?.[0] as {
      items: ConversationItem[];
    };
    const last = dispatch.mock.calls[dispatch.mock.calls.length - 1]?.[0] as {
      items: ConversationItem[];
    };
    expect(first.items).toHaveLength(10);
    expect(last.items).toHaveLength(items.length);
    expect(last.items[last.items.length - 1]?.id).toBe(
      items[items.length - 1]?.id,
    );
  });

  it("stops expanding when shouldContinue returns false", async () => {
    const dispatch = vi.fn();
    const items = makeItems(50);
    let calls = 0;
    await dispatchThreadItemsProgressively(dispatch, "grok:abort", items, {
      batchSize: 10,
      yieldBetweenBatches: async () => {},
      shouldContinue: () => {
        calls += 1;
        return calls <= 2;
      },
    });
    expect(dispatch.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
