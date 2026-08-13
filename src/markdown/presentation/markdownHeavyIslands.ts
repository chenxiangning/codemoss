export const HEAVY_CODE_BLOCK_MIN_LINES = 40;
export const HEAVY_CODE_BLOCK_MIN_CHARS = 4_000;
export const HEAVY_TABLE_MIN_ROWS = 12;

/**
 * 正常 hast table 深度极浅（table → thead/tbody → tr → th/td）。
 * 上限用于挡住环引用 / 异常深嵌套，避免 reduce 递归炸调用栈。
 */
export const MARKDOWN_TABLE_ROW_COUNT_MAX_DEPTH = 64;

/**
 * Product kill-switch for block-level heavy Markdown deferral
 * ("重型 Markdown 详情已延迟" / "显示详情").
 *
 * Keep thresholds + Deferred* UI code paths; set true to re-enable.
 */
export const MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED = false;

/**
 * 是否需要为 defer 决策遍历 table 节点。
 * kill-switch 关闭时永远不需要 rowCount，禁止无意义的树遍历。
 */
export function shouldCountMarkdownTableRowsForDefer(
  shouldDeferMarkdownHeavyIslands: boolean,
): boolean {
  return MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED && shouldDeferMarkdownHeavyIslands;
}

/**
 * 统计 hast-like 节点树中的 table 行数（tagName === "tr"）。
 *
 * 有界：WeakSet 断环 + 最大深度；环 / 超深分支计 0，不抛 RangeError。
 * 调用方应先用 `shouldCountMarkdownTableRowsForDefer` 短路，避免无用遍历。
 */
export function countMarkdownTableRowsFromNode(node: unknown): number {
  return countMarkdownTableRowsFromNodeBounded(
    node,
    0,
    new WeakSet<object>(),
  );
}

function countMarkdownTableRowsFromNodeBounded(
  node: unknown,
  depth: number,
  seen: WeakSet<object>,
): number {
  if (!node || typeof node !== "object") {
    return 0;
  }
  if (depth >= MARKDOWN_TABLE_ROW_COUNT_MAX_DEPTH) {
    return 0;
  }
  if (seen.has(node)) {
    return 0;
  }
  seen.add(node);

  const record = node as { tagName?: string; children?: unknown[] };
  const ownCount = record.tagName === "tr" ? 1 : 0;
  const children = record.children;
  if (!Array.isArray(children) || children.length === 0) {
    return ownCount;
  }

  // for 循环而非 reduce：栈帧更清晰，且与「递归 + 聚合」语义一致。
  let nestedCount = 0;
  for (const child of children) {
    nestedCount += countMarkdownTableRowsFromNodeBounded(
      child,
      depth + 1,
      seen,
    );
  }
  return ownCount + nestedCount;
}

export function shouldDeferCodeBlock(input: {
  valueLength: number;
  lineCount: number;
}) {
  if (!MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED) {
    return false;
  }
  return (
    input.lineCount >= HEAVY_CODE_BLOCK_MIN_LINES ||
    input.valueLength >= HEAVY_CODE_BLOCK_MIN_CHARS
  );
}

export function shouldDeferMarkdownTable(rowCount: number) {
  if (!MARKDOWN_HEAVY_ISLAND_DEFER_ENABLED) {
    return false;
  }
  return rowCount >= HEAVY_TABLE_MIN_ROWS;
}
