import type { ConversationItem } from "../../../../types";
import {
  buildMessagePresentationMetadata,
  getPresentationContext,
} from "../../../../conversation-presentation/normalizeConversationPresentation";
import { MEMORY_CONTEXT_SUMMARY_PREFIX } from "../../../project-memory/utils/memoryMarkers";
import { parseProjectMemoryRetrievalPackPrefix } from "../../../project-memory/utils/projectMemoryRetrievalPack";
import { isEquivalentUserObservation } from "../../../threads/assembly/conversationNormalization";

export type MemoryContextSummary = {
  preview: string;
  lines: string[];
  markdown?: string;
  rawPayload?: string;
  memoryPacks?: Array<{
    source: string;
    count: number;
    cleanedContext: string;
    rawPayload: string;
  }>;
  source?: string;
  /**
   * 注入模式标识（供 UI i18n）：
   * - `pick`：本轮挑选记忆注入
   * - `always`：整轮开启自动 top(n) 记忆注入
   * 历史中文标签也会被归一到上述枚举。
   */
  injectModeLabel?: "pick" | "always" | string;
  records?: Array<{
    displayIndex: string;
    index: string;
    memoryId: string;
    source: string;
    title: string;
    summary?: string;
    score?: number;
  }>;
};

const PROJECT_MEMORY_KIND_LINE_REGEX =
  /^\[(?:已知问题|技术决策|项目上下文|对话记录|笔记|记忆)\]\s*/;
const LEGACY_MEMORY_RECORD_HINT_REGEX =
  /(?:用户输入[:：]|助手输出摘要[:：]|助手输出[:：])/;
const PROJECT_MEMORY_XML_PREFIX_REGEX =
  /^<project-memory\b[^>]*>([\s\S]*?)<\/project-memory>\s*/i;
const PARAGRAPH_BREAK_SPLIT_REGEX = /\r?\n[^\S\r\n]*\r?\n+/;
const OPTIMISTIC_USER_MESSAGE_PREFIX = "optimistic-user-";
const QUEUED_HANDOFF_MESSAGE_PREFIX = "queued-handoff-";

function normalizeMemorySummaryKeySegment(value: string) {
  return value.trim().replace(/\r\n/g, "\n").replace(/\s+/g, " ");
}

function isPendingUserBubbleId(id: string) {
  return (
    id.startsWith(OPTIMISTIC_USER_MESSAGE_PREFIX) ||
    id.startsWith(QUEUED_HANDOFF_MESSAGE_PREFIX)
  );
}

function buildMemorySummary(preview: string): MemoryContextSummary | null {
  const normalizedPreview = preview.trim();
  if (!normalizedPreview) {
    return null;
  }
  const lines = normalizedPreview
    .split(/[；\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    preview: normalizedPreview,
    lines: lines.length > 0 ? lines : [normalizedPreview],
    markdown: normalizedPreview,
  };
}

function getMemoryContextSummary(item: Extract<ConversationItem, { kind: "message" }>) {
  const context = getPresentationContext(buildMessagePresentationMetadata(item), "memory");
  if (!context) {
    return null;
  }
  return {
    preview: context.preview,
    lines: context.lines,
    markdown: context.markdown,
    rawPayload: context.rawPayload,
    memoryPacks: context.packs,
    source: context.source,
    records: context.records,
  } satisfies MemoryContextSummary;
}

/**
 * 解析记忆挑选结构化 preview 行：
 * `#1 | memoryId | title | summary | 0.91`
 */
const MEMORY_PICK_RECORD_LINE_REGEX =
  /^#(\d+)\s*\|\s*([^\s|]+)\s*\|\s*([^|]+?)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*([0-9.]+))?\s*$/;

export function parseMemoryPickPreviewRecords(preview: string): NonNullable<
  MemoryContextSummary["records"]
> {
  const records: NonNullable<MemoryContextSummary["records"]> = [];
  for (const rawLine of preview.split(/\r?\n+/)) {
    const line = rawLine.trim();
    const match = MEMORY_PICK_RECORD_LINE_REGEX.exec(line);
    if (!match) continue;
    const displayIndex = `#${match[1]}`;
    const memoryId = (match[2] ?? "").trim();
    const title = (match[3] ?? "").trim() || memoryId;
    const summary = (match[4] ?? "").trim();
    const scoreRaw = (match[5] ?? "").trim();
    const score = scoreRaw ? Number.parseFloat(scoreRaw) : undefined;
    records.push({
      displayIndex,
      index: displayIndex,
      memoryId,
      source: "memory-pick",
      title,
      summary: summary || undefined,
      score: Number.isFinite(score) ? score : undefined,
    });
  }
  return records;
}

function parseMemoryPickModeLabel(
  preview: string,
): "pick" | "always" | undefined {
  const header = preview.split(/\r?\n/)[0]?.trim() ?? "";
  // 兼容历史中文 header 与未来 mode token
  if (
    header.includes("一直开启") ||
    header.includes("整轮开启") ||
    header.includes("整轮自动") ||
    /\balways\b/i.test(header)
  ) {
    return "always";
  }
  if (
    header.includes("本轮") ||
    header.includes("记忆挑选") ||
    /\bpick\b/i.test(header)
  ) {
    return "pick";
  }
  return undefined;
}

export function parseMemoryContextSummary(text: string): MemoryContextSummary | null {
  const normalized = text.trim();
  if (!normalized.startsWith(MEMORY_CONTEXT_SUMMARY_PREFIX)) {
    return null;
  }
  const preview = normalized.slice(MEMORY_CONTEXT_SUMMARY_PREFIX.length).trim();
  if (!preview) {
    return null;
  }
  const pickRecords = parseMemoryPickPreviewRecords(preview);
  if (pickRecords.length > 0) {
    const lines = pickRecords.map(
      (record) => `${record.displayIndex} ${record.title}`.trim(),
    );
    return {
      preview: lines.slice(0, 3).join("；"),
      lines,
      markdown: lines.join("\n"),
      source: "memory-pick",
      injectModeLabel: parseMemoryPickModeLabel(preview),
      records: pickRecords,
    };
  }
  const lines = preview
    .split(/[；\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    // 丢掉纯 header 行
    .filter((line) => !line.startsWith("记忆挑选"));
  return {
    preview: lines.length > 0 ? lines.join("；") : preview,
    lines: lines.length > 0 ? lines : [preview],
    markdown: preview,
  };
}

export function buildMemoryContextSummaryKey(summary: MemoryContextSummary | null) {
  if (!summary) {
    return null;
  }
  const normalizedLines = summary.lines
    .map((line) => normalizeMemorySummaryKeySegment(line))
    .filter(Boolean);
  if (normalizedLines.length === 0) {
    return null;
  }
  const previewHead = normalizedLines.slice(0, 2).join("；");
  const previewLooksTruncated =
    summary.preview.trim().endsWith("...") || normalizedLines.length > 2;
  if (!previewHead) {
    return null;
  }
  return previewLooksTruncated && !previewHead.endsWith("...")
    ? `${previewHead}...`
    : previewHead;
}

export function parseInjectedMemoryPrefixFromUser(
  text: string,
): { memorySummary: MemoryContextSummary; remainingText: string } | null {
  const normalized = text.trimStart();
  if (!normalized) {
    return null;
  }

  const packSummaries: Array<NonNullable<
    ReturnType<typeof parseProjectMemoryRetrievalPackPrefix>
  >["packSummary"]> = [];
  let remainingPackText = normalized;
  let packMatch = parseProjectMemoryRetrievalPackPrefix(remainingPackText);
  while (packMatch) {
    packSummaries.push(packMatch.packSummary);
    remainingPackText = packMatch.remainingText;
    packMatch = parseProjectMemoryRetrievalPackPrefix(remainingPackText);
  }
  if (packSummaries.length > 0) {
    const records = packSummaries.flatMap((summary) =>
      summary.records.map((record) => ({
        ...record,
        source: summary.source,
      })),
    ).map((record, index) => ({
      ...record,
      displayIndex: `#${index + 1}`,
    }));
    const recordLines = records.map((record) => {
      const sourcePrefix = packSummaries.length > 1 && record.source
        ? `${record.source}: `
        : "";
      return `${sourcePrefix}${record.displayIndex} ${record.title || record.memoryId}`.trim();
    });
    const fallbackLines = packSummaries.flatMap((summary) =>
      packSummaries.length > 1 && summary.source
        ? summary.lines.map((line) => `${summary.source}: ${line}`)
        : summary.lines,
    );
    const combinedLines = recordLines.length > 0 ? recordLines : fallbackLines;
    const preview = combinedLines.length > 0
      ? combinedLines.slice(0, 3).join("；")
      : packSummaries.map((summary) => summary.preview).filter(Boolean).join("；");
    const memorySummary = buildMemorySummary(preview);
    if (!memorySummary) {
      return null;
    }
    return {
      memorySummary: {
        ...memorySummary,
        source: packSummaries.map((summary) => summary.source).filter(Boolean).join(","),
        rawPayload: packSummaries.map((summary) => summary.rawPayload).join("\n\n"),
        memoryPacks: packSummaries.map((summary) => ({
          source: summary.source,
          count: summary.count,
          cleanedContext: summary.cleanedContext,
          rawPayload: summary.rawPayload,
        })),
        records,
        lines: combinedLines.length > 0
          ? combinedLines
          : memorySummary.lines,
      },
      remainingText: remainingPackText,
    };
  }

  const xmlMatch = normalized.match(PROJECT_MEMORY_XML_PREFIX_REGEX);
  if (xmlMatch) {
    const blockBody = (xmlMatch[1] ?? "").trim();
    const memoryLines = blockBody
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => PROJECT_MEMORY_KIND_LINE_REGEX.test(line));
    const previewText = memoryLines.length > 0 ? memoryLines.join("；") : blockBody;
    const memorySummary = buildMemorySummary(previewText);
    if (!memorySummary) {
      return null;
    }
    const remainingText = normalized.slice(xmlMatch[0].length).trimStart();
    return { memorySummary, remainingText };
  }

  if (!PROJECT_MEMORY_KIND_LINE_REGEX.test(normalized)) {
    return null;
  }
  if (!LEGACY_MEMORY_RECORD_HINT_REGEX.test(normalized)) {
    return null;
  }

  const paragraphBlocks = normalized.split(PARAGRAPH_BREAK_SPLIT_REGEX);
  if (paragraphBlocks.length >= 2) {
    const firstBlock = (paragraphBlocks[0] ?? "").trim();
    if (
      PROJECT_MEMORY_KIND_LINE_REGEX.test(firstBlock) &&
      LEGACY_MEMORY_RECORD_HINT_REGEX.test(firstBlock)
    ) {
      const memorySummary = buildMemorySummary(firstBlock);
      if (!memorySummary) {
        return null;
      }
      return {
        memorySummary,
        remainingText: paragraphBlocks.slice(1).join("\n\n").trimStart(),
      };
    }
  }

  const lines = normalized.split(/\r?\n/);
  if (lines.length >= 2) {
    const firstLine = (lines[0] ?? "").trim();
    if (
      PROJECT_MEMORY_KIND_LINE_REGEX.test(firstLine) &&
      LEGACY_MEMORY_RECORD_HINT_REGEX.test(firstLine)
    ) {
      const memorySummary = buildMemorySummary(firstLine);
      if (!memorySummary) {
        return null;
      }
      return {
        memorySummary,
        remainingText: lines.slice(1).join("\n").trimStart(),
      };
    }
  }

  return null;
}

export function buildSuppressedUserMemoryContextMessageIdSet(items: ConversationItem[]) {
  const suppressedMessageIds = new Set<string>();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || item.kind !== "message" || item.role !== "user") {
      continue;
    }
    const userSummaryKey = buildMemoryContextSummaryKey(getMemoryContextSummary(item));
    if (!userSummaryKey) {
      continue;
    }

    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
      const previousItem = items[previousIndex];
      if (!previousItem || previousItem.kind !== "message") {
        continue;
      }
      if (previousItem.role === "user") {
        if (
          isPendingUserBubbleId(previousItem.id) &&
          isEquivalentUserObservation(previousItem, item)
        ) {
          continue;
        }
        break;
      }
      const assistantSummaryKey = buildMemoryContextSummaryKey(
        getMemoryContextSummary(previousItem),
      );
      if (assistantSummaryKey && assistantSummaryKey === userSummaryKey) {
        suppressedMessageIds.add(item.id);
        break;
      }
    }
  }

  return suppressedMessageIds;
}
