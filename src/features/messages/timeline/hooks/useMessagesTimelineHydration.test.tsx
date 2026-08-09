// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createHeavyHistoryFixture } from "../test-support/messagesHeavyHistoryFixture";
import { useMessagesTimelineHydration } from "./useMessagesTimelineHydration";

describe("useMessagesTimelineHydration", () => {
  it("never renders row-level lightweight summary strips", () => {
    const { rows } = createHeavyHistoryFixture("heavy");
    const { result } = renderHook(() => useMessagesTimelineHydration({
      activeLiveTimelineRowKeySet: new Set(),
      conversationDetailHydrationRequested: false,
      effectiveConversationLightweightMode: true,
      isThinking: false,
      isWorking: false,
      pendingJumpRowKey: null,
      rendererOptionsKey: "renderer-1",
      retainedScopeKey: "scope-1",
      shouldDeferHeavyTimelineRows: true,
      timelineProjectionRows: rows,
    }));
    expect(
      rows.every((row) =>
        !result.current.shouldRenderLightweightProjectionRow(
          row,
          result.current.timelineRowHydrationStateByKey.get(row.key),
        ),
      ),
    ).toBe(true);
    expect(
      [...result.current.timelineRowHydrationStateByKey.values()].every(
        (state) => state.mode !== "summary",
      ),
    ).toBe(true);
  });
});
