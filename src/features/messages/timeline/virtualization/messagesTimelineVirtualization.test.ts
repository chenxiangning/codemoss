import { afterEach, describe, expect, it } from "vitest";
import {
  buildTimelineRenderWeightDiagnosticPayload,
  estimateTimelineProjectionRenderWeight,
  getActiveLiveTimelineRowKeys,
  isTimelineRenderWeightGateEnabled,
  shouldVirtualizeTimelineRows,
  summarizeTimelineProjectionRenderWeight,
  TIMELINE_ADAPTIVE_RENDERING_ENABLED,
  TIMELINE_RENDER_WEIGHT_BASELINE_FLAG_KEY,
  TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
  TIMELINE_VIRTUALIZATION_MIN_ROWS,
} from "./messagesTimelineVirtualization";
import { createHeavyHistoryFixture } from "../test-support/messagesHeavyHistoryFixture";
import type { TimelineProjectionRow } from "../projection/messagesTimelineProjection";

describe("messagesTimelineVirtualization (virtualization removed)", () => {
  afterEach(() => {
    globalThis.localStorage.removeItem(TIMELINE_RENDER_WEIGHT_BASELINE_FLAG_KEY);
  });

  it("never virtualizes the conversation timeline", () => {
    expect(TIMELINE_ADAPTIVE_RENDERING_ENABLED).toBe(true);
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS * 10,
      renderWeight: TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT * 10,
    })).toBe(false);
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 1_000,
    })).toBe(false);
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      isWorking: true,
      rowCount: 500,
    })).toBe(false);
  });

  it("summarizes render weight for heavy fixtures", () => {
    const { rows } = createHeavyHistoryFixture("heavy");
    const summary = summarizeTimelineProjectionRenderWeight(rows);
    expect(summary.rowCount).toBe(rows.length);
    expect(summary.renderWeight).toBeGreaterThan(rows.length);
    expect(summary.heavyRowCount).toBeGreaterThan(0);
  });

  it("estimates per-row render weight for markdown tables and fences", () => {
    const row: TimelineProjectionRow = {
      kind: "entry",
      key: "entry:heavy",
      itemIds: ["m1"],
      hasActiveUserInputAnchor: false,
      entry: {
        kind: "item",
        item: {
          id: "m1",
          kind: "message",
          role: "assistant",
          text: [
            "# Title",
            "| A | B |",
            "| - | - |",
            ...Array.from({ length: 20 }, (_, i) => `| ${i} | v |`),
            "```ts",
            "const x = 1;",
            "```",
          ].join("\n"),
          isFinal: true,
        },
      },
    };
    expect(estimateTimelineProjectionRenderWeight(row)).toBeGreaterThan(1);
  });

  it("builds diagnostic payload with shouldVirtualize=false", () => {
    const summary = {
      rowCount: 10,
      renderWeight: 20,
      heavyRowCount: 1,
      categoryCounts: {},
    };
    const payload = buildTimelineRenderWeightDiagnosticPayload({
      summary,
      shouldVirtualize: false,
      threadId: "t1",
      workspaceId: "w1",
    });
    expect(payload.shouldVirtualize).toBe(false);
    expect(payload.thresholdReason).toBe("disabled");
    expect(payload.threadId).toBe("t1");
  });

  it("resolves active live row keys", () => {
    const rows: TimelineProjectionRow[] = [
      {
        kind: "entry",
        key: "entry:a1",
        itemIds: ["a1"],
        hasActiveUserInputAnchor: false,
        entry: {
          kind: "item",
          item: {
            id: "a1",
            kind: "message",
            role: "assistant",
            text: "live",
          },
        },
      },
      {
        kind: "entry",
        key: "entry:u1",
        itemIds: ["u1"],
        hasActiveUserInputAnchor: false,
        entry: {
          kind: "item",
          item: {
            id: "u1",
            kind: "message",
            role: "user",
            text: "hi",
          },
        },
      },
    ];
    expect(getActiveLiveTimelineRowKeys({
      rows,
      liveAssistantItemId: "a1",
    })).toEqual(["entry:a1"]);
  });

  it("honors render-weight baseline gate for diagnostics", () => {
    expect(isTimelineRenderWeightGateEnabled()).toBe(true);
    globalThis.localStorage.setItem(TIMELINE_RENDER_WEIGHT_BASELINE_FLAG_KEY, "1");
    expect(isTimelineRenderWeightGateEnabled()).toBe(false);
  });
});
