import type { ProjectMemoryItem } from "../../../services/tauri";
import type { InjectionResult } from "../utils/memoryContextInjection";
import { cleanProjectMemoryRecordsForRequest } from "../utils/projectMemoryCleaner";
import {
  buildProjectMemoryRetrievalPack,
  buildProjectMemorySourceRecords,
  formatProjectMemoryRetrievalPack,
} from "../utils/projectMemoryRetrievalPack";
import {
  resolveProjectMemoryCompactSummary,
  resolveProjectMemoryCompactTitle,
} from "../utils/projectMemoryDisplay";
import type { MemoryPickComposerMode } from "./memoryPickTypes";

/**
 * 幕布摘要卡可解析的 preview（图3 注入摘要用）。
 * 行格式：`#n | id | title | summary | score`
 */
export function buildMemoryPickPreviewText(
  memories: ProjectMemoryItem[],
  mode: MemoryPickComposerMode,
  scoresById?: ReadonlyMap<string, number> | Record<string, number>,
): string {
  if (memories.length === 0) {
    return "";
  }
  const scoreOf = (id: string): number | undefined => {
    if (!scoresById) return undefined;
    if (scoresById instanceof Map) return scoresById.get(id);
    return (scoresById as Record<string, number>)[id];
  };
  // 语义转接：强调「为本轮提问参考」，避免「已发送记忆当任务」口吻
  const header =
    mode === "always"
      ? `为本轮提问参考 · 一直开启 · ${memories.length} 条`
      : `为本轮提问参考 · 本轮 · ${memories.length} 条`;
  const lines = memories.map((memory, index) => {
    const title = resolveProjectMemoryCompactTitle(memory) || memory.id;
    const summary = resolveProjectMemoryCompactSummary(memory);
    const score = scoreOf(memory.id);
    const scorePart =
      typeof score === "number" && Number.isFinite(score)
        ? ` | ${score.toFixed(2)}`
        : "";
    // #n | id | title | summary | score
    return `#${index + 1} | ${memory.id} | ${title} | ${summary || ""}${scorePart}`;
  });
  return [header, ...lines].join("\n");
}

/**
 * 将选中记忆注入为 source=memory-pick 的 retrieval pack。
 * 与 manual-selection 结构一致，仅 source 不同以便审计。
 */
export function injectMemoryPickContext(params: {
  userText: string;
  memories: ProjectMemoryItem[];
  mode: MemoryPickComposerMode;
  queryText?: string;
  retrievalMs?: number;
  startIndex?: number;
  /** 可选：相关分，写入预览供历史卡展示 */
  scoresById?: ReadonlyMap<string, number> | Record<string, number>;
}): InjectionResult {
  if (!params.memories.length) {
    return {
      finalText: params.userText,
      injectedCount: 0,
      injectedChars: 0,
      retrievalMs: params.retrievalMs ?? 0,
      previewText: null,
      packBlock: null,
      disabledReason: "manual_empty",
    };
  }

  const records = buildProjectMemorySourceRecords({
    memories: params.memories,
    startIndex: params.startIndex,
  });
  const cleaner = cleanProjectMemoryRecordsForRequest({
    userText: params.queryText ?? params.userText,
    records,
  });
  const pack = buildProjectMemoryRetrievalPack({
    source: "memory-pick",
    records,
    cleaner,
  });
  const block = formatProjectMemoryRetrievalPack(pack);
  if (!block) {
    return {
      finalText: params.userText,
      injectedCount: 0,
      injectedChars: 0,
      retrievalMs: params.retrievalMs ?? 0,
      previewText: null,
      packBlock: null,
      disabledReason: "manual_empty",
    };
  }

  return {
    finalText: `${block}\n${params.userText}`,
    injectedCount: params.memories.length,
    injectedChars: block.length,
    retrievalMs: params.retrievalMs ?? 0,
    previewText: buildMemoryPickPreviewText(
      params.memories,
      params.mode,
      params.scoresById,
    ),
    packBlock: block,
    disabledReason: null,
  };
}

/** 合并 manual 与 pick 的 id，manual 优先顺序在前 */
export function mergeMemoryIdsPreferManual(
  manualIds: string[],
  pickIds: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of manualIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of pickIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
