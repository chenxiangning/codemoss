import { describe, expect, it } from "vitest";
import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  injectMemoryPickContext,
  mergeMemoryIdsPreferManual,
} from "./injectMemoryPickContext";

function memory(
  partial: Partial<ProjectMemoryItem> & { id: string },
): ProjectMemoryItem {
  const { id, ...rest } = partial;
  return {
    id,
    workspaceId: "ws",
    kind: "note",
    title: rest.title ?? id,
    summary: rest.summary ?? "summary",
    detail: rest.detail ?? "detail",
    rawText: rest.rawText ?? "raw",
    cleanText: rest.cleanText ?? "clean",
    tags: [],
    importance: "medium",
    source: "manual",
    fingerprint: id,
    createdAt: 1,
    updatedAt: 2,
    ...rest,
  } as ProjectMemoryItem;
}

describe("injectMemoryPickContext", () => {
  it("injects memory-pick pack before user text", () => {
    const result = injectMemoryPickContext({
      userText: "hello world",
      memories: [memory({ id: "m1", title: "Decision" })],
      mode: "pick",
      queryText: "hello world",
    });
    expect(result.injectedCount).toBe(1);
    expect(result.finalText).toContain('source="memory-pick"');
    expect(result.finalText.endsWith("hello world")).toBe(true);
    expect(result.previewText).toContain("为本轮提问参考");
    expect(result.previewText).toMatch(/#1 \| m1 \| Decision \|/);
    expect(result.finalText).toContain("Primary task");
    expect(result.finalText).toContain("PRIOR PROJECT REFERENCE");
    expect(result.finalText).toContain("UNTRUSTED");
  });

  it("returns empty when no memories", () => {
    const result = injectMemoryPickContext({
      userText: "x",
      memories: [],
      mode: "always",
    });
    expect(result.injectedCount).toBe(0);
    expect(result.finalText).toBe("x");
    expect(result.disabledReason).toBe("manual_empty");
  });
});

describe("mergeMemoryIdsPreferManual", () => {
  it("dedupes preferring manual order first", () => {
    expect(mergeMemoryIdsPreferManual(["a", "b"], ["b", "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
