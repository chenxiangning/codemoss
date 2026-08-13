import { describe, expect, it } from "vitest";
import { MEMORY_CONTEXT_SUMMARY_PREFIX } from "../../../project-memory/utils/memoryMarkers";
import {
  parseMemoryContextSummary,
  parseMemoryPickPreviewRecords,
} from "./messagesMemoryContext";

describe("parseMemoryPickPreviewRecords", () => {
  it("parses structured pick preview lines into records", () => {
    const preview = [
      "记忆挑选 · 本轮 · 已注入 2 条",
      "#1 | mid-a | 连接池超时 | 优先检查上限 | 0.91",
      "#2 | mid-b | 索引优化 |  | 0.84",
    ].join("\n");
    const records = parseMemoryPickPreviewRecords(preview);
    expect(records).toEqual([
      {
        displayIndex: "#1",
        index: "#1",
        memoryId: "mid-a",
        source: "memory-pick",
        title: "连接池超时",
        summary: "优先检查上限",
        score: 0.91,
      },
      {
        displayIndex: "#2",
        index: "#2",
        memoryId: "mid-b",
        source: "memory-pick",
        title: "索引优化",
        summary: undefined,
        score: 0.84,
      },
    ]);
  });
});

describe("parseMemoryContextSummary memory-pick", () => {
  it("builds structured summary with records for pick preview", () => {
    const text = [
      MEMORY_CONTEXT_SUMMARY_PREFIX,
      "记忆挑选 · 本轮 · 已注入 1 条",
      "#1 | m-db | 数据库连接池 | 超时与连接上限 | 0.88",
    ].join("\n");
    const summary = parseMemoryContextSummary(text);
    expect(summary?.source).toBe("memory-pick");
    expect(summary?.injectModeLabel).toBe("pick");
    expect(summary?.records).toHaveLength(1);
    expect(summary?.records?.[0]?.title).toBe("数据库连接池");
    expect(summary?.records?.[0]?.summary).toBe("超时与连接上限");
    expect(summary?.records?.[0]?.score).toBe(0.88);
    expect(summary?.lines[0]).toContain("数据库连接池");
  });
});
