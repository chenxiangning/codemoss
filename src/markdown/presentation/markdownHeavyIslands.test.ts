import { describe, expect, it } from "vitest";
import {
  countMarkdownTableRowsFromNode,
  HEAVY_CODE_BLOCK_MIN_CHARS,
  HEAVY_CODE_BLOCK_MIN_LINES,
  HEAVY_TABLE_MIN_ROWS,
  MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED,
  MARKDOWN_TABLE_ROW_COUNT_MAX_DEPTH,
  shouldCountMarkdownTableRowsForDefer,
  shouldDeferCodeBlock,
  shouldDeferMarkdownTable,
} from "./markdownHeavyIslands";

describe("markdownHeavyIslands", () => {
  it("counts nested markdown table rows from a hast-like node tree", () => {
    expect(
      countMarkdownTableRowsFromNode({
        tagName: "table",
        children: [
          {
            tagName: "tbody",
            children: [
              { tagName: "tr", children: [] },
              { tagName: "tr", children: [] },
              { tagName: "tr", children: [] },
            ],
          },
        ],
      }),
    ).toBe(3);
  });

  it("returns 0 for non-object / empty input", () => {
    expect(countMarkdownTableRowsFromNode(null)).toBe(0);
    expect(countMarkdownTableRowsFromNode(undefined)).toBe(0);
    expect(countMarkdownTableRowsFromNode("table")).toBe(0);
    expect(countMarkdownTableRowsFromNode({ tagName: "div" })).toBe(0);
  });

  it("does not throw RangeError on circular children (AP-08)", () => {
    const cyclic: { tagName: string; children: unknown[] } = {
      tagName: "table",
      children: [],
    };
    cyclic.children.push(cyclic);

    expect(() => countMarkdownTableRowsFromNode(cyclic)).not.toThrow();
    expect(countMarkdownTableRowsFromNode(cyclic)).toBe(0);
  });

  it("does not throw RangeError on extreme nesting beyond max depth (AP-08)", () => {
    let deep: { tagName: string; children: unknown[] } = {
      tagName: "tr",
      children: [],
    };
    for (let i = 0; i < MARKDOWN_TABLE_ROW_COUNT_MAX_DEPTH + 200; i += 1) {
      deep = { tagName: "div", children: [deep] };
    }

    expect(() => countMarkdownTableRowsFromNode(deep)).not.toThrow();
    // 根深度已超过 cap，整棵树按有界策略计 0（不炸栈优先于精确行数）
    expect(countMarkdownTableRowsFromNode(deep)).toBe(0);
  });

  it("still counts rows within the max depth bound", () => {
    // table → tbody → tr（深度 0/1/2）远低于 cap
    const table = {
      tagName: "table",
      children: [
        {
          tagName: "tbody",
          children: Array.from({ length: 15 }, () => ({
            tagName: "tr",
            children: [{ tagName: "td", children: [] }],
          })),
        },
      ],
    };
    expect(countMarkdownTableRowsFromNode(table)).toBe(15);
  });

  it("keeps the product kill-switch off so heavy islands never defer", () => {
    expect(MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED).toBe(false);
    expect(shouldDeferCodeBlock({ valueLength: 4_100, lineCount: 12 })).toBe(false);
    expect(shouldDeferCodeBlock({ valueLength: 320, lineCount: 44 })).toBe(false);
    expect(shouldDeferMarkdownTable(12)).toBe(false);
    // Thresholds remain defined for a future re-enable.
    expect(HEAVY_CODE_BLOCK_MIN_LINES).toBeGreaterThan(0);
    expect(HEAVY_CODE_BLOCK_MIN_CHARS).toBeGreaterThan(0);
    expect(HEAVY_TABLE_MIN_ROWS).toBeGreaterThan(0);
  });

  it("refuses table-row counting when kill-switch is off (eager-walk regression)", () => {
    // 当前产品 kill-switch 关闭：即便 heavy summary 为 true，也不得要求遍历
    expect(shouldCountMarkdownTableRowsForDefer(true)).toBe(false);
    expect(shouldCountMarkdownTableRowsForDefer(false)).toBe(false);
  });

  it("documents historical defer thresholds for multi-line code blocks", () => {
    // When MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED is re-enabled, policy should be:
    // lineCount >= HEAVY_CODE_BLOCK_MIN_LINES || valueLength >= HEAVY_CODE_BLOCK_MIN_CHARS
    const wouldDeferByChars = 4_100 >= HEAVY_CODE_BLOCK_MIN_CHARS;
    const wouldDeferByLines = 44 >= HEAVY_CODE_BLOCK_MIN_LINES;
    const wouldNotDefer = 4 < HEAVY_CODE_BLOCK_MIN_LINES && 320 < HEAVY_CODE_BLOCK_MIN_CHARS;
    expect(wouldDeferByChars).toBe(true);
    expect(wouldDeferByLines).toBe(true);
    expect(wouldNotDefer).toBe(true);
  });

  it("documents historical defer thresholds for markdown tables", () => {
    expect(11 < HEAVY_TABLE_MIN_ROWS).toBe(true);
    expect(12 >= HEAVY_TABLE_MIN_ROWS).toBe(true);
  });
});
