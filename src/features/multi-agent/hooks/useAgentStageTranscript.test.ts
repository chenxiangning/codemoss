import { describe, expect, it } from "vitest";

import type { SharedProjectionItem } from "../../messages/presentation/sharedProjection/types";
import {
  filterProjectionItemsForAttempt,
  isWeakStatusText,
} from "./useAgentStageTranscript";

describe("filterProjectionItemsForAttempt", () => {
  const items: SharedProjectionItem[] = [
    {
      id: "m1",
      kind: "message",
      fidelity: "canonical",
      checksum: "a",
      content: { role: "user", text: "u", attemptId: "att-1" },
    },
    {
      id: "t1",
      kind: "tool",
      fidelity: "canonical",
      checksum: "b",
      content: { toolType: "Bash", title: "run", attemptId: "att-1" },
    },
    {
      id: "m2",
      kind: "message",
      fidelity: "canonical",
      checksum: "c",
      content: { role: "assistant", text: "other", attemptId: "att-2" },
    },
    {
      id: "m3",
      kind: "message",
      fidelity: "canonical",
      checksum: "d",
      content: { role: "assistant", text: "by turn", turnId: "att-1" },
    },
  ];

  it("slices by content.attemptId", () => {
    const sliced = filterProjectionItemsForAttempt(items, "att-1");
    expect(sliced.map((i) => i.id).sort()).toEqual(["m1", "m3", "t1"]);
  });

  it("returns empty when attempt missing", () => {
    expect(filterProjectionItemsForAttempt(items, "")).toEqual([]);
    expect(filterProjectionItemsForAttempt(items, "nope")).toEqual([]);
  });
});

describe("isWeakStatusText", () => {
  it("flags status-only tokens like completed", () => {
    expect(isWeakStatusText("completed")).toBe(true);
    expect(isWeakStatusText("Completed.")).toBe(true);
    expect(isWeakStatusText("done")).toBe(true);
    expect(isWeakStatusText("失败")).toBe(true);
  });

  it("keeps real plan/review bodies", () => {
    expect(
      isWeakStatusText(
        "## 任务理解\n\n新增电风扇商品入库 CRUD 示例模块。",
      ),
    ).toBe(false);
  });
});
