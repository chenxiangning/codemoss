import type { ConversationItem } from "../../../types";
import {
  areEquivalentReasoningTexts,
  compactComparableConversationText,
} from "../assembly/conversationNormalization";
import {
  chooseAppleEventDiagnosticTextVariant,
  collapseNearDuplicateParagraphRepeats,
  mergeNearDuplicateParagraphVariants,
} from "../../../utils/assistantDuplicateParagraphs";
import { getMarkdownInlineCodeInfo } from "../../../utils/markdownCodeRegions";
import { longestSuffixPrefixOverlap } from "../../../utils/stringOverlap";
import {
  normalizeItem,
  stripClaudeApprovalResumeArtifacts,
} from "../../../utils/threadItems";
import {
  isClaudeReasoningThread,
  isGeminiReasoningThread,
  isKimiReasoningThread,
} from "./threadReducerReasoningGuards";

function isUserMessageItem(
  item: ConversationItem | undefined,
): item is Extract<ConversationItem, { kind: "message"; role: "user" }> {
  return item?.kind === "message" && item.role === "user";
}

function isReasoningItem(
  item: ConversationItem | undefined,
): item is Extract<ConversationItem, { kind: "reasoning" }> {
  return item?.kind === "reasoning";
}

export function mergeStreamingText(existing: string, delta: string) {
  if (!delta) {
    return existing;
  }
  if (!existing) {
    return delta;
  }
  if (delta === existing) {
    return existing;
  }
  if (delta.startsWith(existing)) {
    return delta;
  }
  if (existing.startsWith(delta)) {
    return existing;
  }
  // KMP 线性重叠检测：旧实现从 maxOverlap 逐字符递减 slice+endsWith，
  // 对 MiB 级 tool output / 长快照是 O(n²)，每次 delta flush 都会命中。
  const overlapLength = longestSuffixPrefixOverlap(existing, delta);
  if (overlapLength > 0) {
    return `${existing}${delta.slice(overlapLength)}`;
  }
  return `${existing}${delta}`;
}

const REASONING_BOUNDARY_MIN_TRAILING_CHARS = 6;
const REASONING_BOUNDARY_PUNCTUATION_REGEX = /[。！？!?;；:：]$/;
const REASONING_FRAGMENT_MIN_RUN = 5;
const REASONING_FRAGMENT_MAX_LENGTH = 14;
const REASONING_FRAGMENT_MIN_TOTAL_CHARS = 12;
const REASONING_FRAGMENT_EDGE_MIN_LENGTH = 6;
const PARAGRAPH_BREAK_SPLIT_REGEX = /\r?\n[^\S\r\n]*\r?\n+/;

function hasParagraphBreak(value: string) {
  return PARAGRAPH_BREAK_SPLIT_REGEX.test(value);
}

const STREAMING_APPEND_MIN_EXISTING_CHARS = 2048;
const STREAMING_APPEND_MAX_DELTA_CHARS = 256;
const STREAMING_APPEND_MAX_DELTA_COMPACT_CHARS = 24;
const STREAMING_APPEND_BOUNDARY_REGEX = /[\n。！？!?]/;

/**
 * 低风险流式追加片段：existing 已足够长而 delta 是不含段落边界的短片段。
 * mergeAgentMessageText 的快照/回显/前缀判定都要求 ≥24 个 comparable 字符或
 * delta 尺寸接近 existing；低于这些下限的片段在完整路径里最终也只会落到
 * mergeStreamingText 追加，因此可以跳过对 existing 的整段扫描（O(L) → O(delta)）。
 */
export function isLowRiskStreamingAppendFragment(existing: string, delta: string) {
  return (
    existing.length >= STREAMING_APPEND_MIN_EXISTING_CHARS &&
    delta.length > 0 &&
    delta.length <= STREAMING_APPEND_MAX_DELTA_CHARS &&
    !hasParagraphBreak(delta)
  );
}

/**
 * 片段连句末/换行边界都没有时，重复/碎片归一化（按句子或段落工作）在本次
 * 追加后不会产生新的可折叠结构，调用方可以把全文归一化推迟到下一个边界。
 */
export function isLowRiskStreamingAppendFragmentWithoutBoundary(
  existing: string,
  delta: string,
) {
  return (
    isLowRiskStreamingAppendFragment(existing, delta) &&
    !STREAMING_APPEND_BOUNDARY_REGEX.test(delta)
  );
}

function shouldMergeReasoningFragment(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= REASONING_FRAGMENT_MAX_LENGTH &&
    !looksLikeMarkdownBlockStart(trimmed)
  );
}

function joinReasoningFragments(segments: string[]) {
  return segments.reduce((combined, segment) => {
    if (!segment) {
      return combined;
    }
    if (!combined) {
      return segment;
    }
    const previousChar = combined[combined.length - 1] ?? "";
    const nextChar = segment[0] ?? "";
    const shouldInsertSpace =
      /[A-Za-z0-9]/.test(previousChar) && /[A-Za-z0-9]/.test(nextChar);
    return shouldInsertSpace ? `${combined} ${segment}` : `${combined}${segment}`;
  }, "");
}

function extractReasoningBlockquoteText(paragraph: string) {
  const lines = paragraph.split(/\r?\n/);
  const fragments: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^\s*>\s?(.*)$/);
    if (!match) {
      return null;
    }
    const content = (match[1] ?? "").trim();
    if (!content || looksLikeMarkdownBlockStart(content)) {
      return null;
    }
    fragments.push(content);
  }
  if (fragments.length === 0) {
    return null;
  }
  return joinReasoningFragments(fragments);
}

function trimReasoningMergeWindow(
  entries: string[],
  start: number,
  end: number,
) {
  let mergeStart = start;
  let mergeEnd = end;
  while (mergeStart < mergeEnd) {
    const edge = entries[mergeStart] ?? "";
    if (
      edge.length >= REASONING_FRAGMENT_EDGE_MIN_LENGTH &&
      REASONING_BOUNDARY_PUNCTUATION_REGEX.test(edge.trim())
    ) {
      mergeStart += 1;
      continue;
    }
    break;
  }
  while (mergeEnd > mergeStart) {
    const edge = entries[mergeEnd - 1] ?? "";
    if (
      edge.length >= REASONING_FRAGMENT_EDGE_MIN_LENGTH &&
      REASONING_BOUNDARY_PUNCTUATION_REGEX.test(edge.trim())
    ) {
      mergeEnd -= 1;
      continue;
    }
    break;
  }
  return { mergeStart, mergeEnd };
}

function normalizeReasoningFragmentedParagraphs(value: string) {
  if (!hasParagraphBreak(value) || value.includes("```")) {
    return value;
  }
  const paragraphs = value.split(PARAGRAPH_BREAK_SPLIT_REGEX);
  if (paragraphs.length < REASONING_FRAGMENT_MIN_RUN) {
    return value;
  }
  const trimmedParagraphs = paragraphs.map((entry) => entry.trim());

  const normalized: string[] = [];
  let changed = false;
  let index = 0;
  while (index < paragraphs.length) {
    const current = paragraphs[index] ?? "";
    const currentQuoteText = extractReasoningBlockquoteText(current);
    if (
      currentQuoteText &&
      shouldMergeReasoningFragment(currentQuoteText)
    ) {
      let cursor = index;
      const quoteEntries: string[] = [];
      while (cursor < paragraphs.length) {
        const candidateQuoteText = extractReasoningBlockquoteText(paragraphs[cursor] ?? "");
        if (
          !candidateQuoteText ||
          !shouldMergeReasoningFragment(candidateQuoteText)
        ) {
          break;
        }
        quoteEntries.push(candidateQuoteText.trim());
        cursor += 1;
      }

      const { mergeStart, mergeEnd } = trimReasoningMergeWindow(
        quoteEntries,
        0,
        quoteEntries.length,
      );
      if (mergeStart > 0) {
        normalized.push(...quoteEntries.slice(0, mergeStart).map((entry) => `> ${entry}`));
      }
      const mergeCandidates = quoteEntries.slice(mergeStart, mergeEnd);
      const mergeTotalChars = mergeCandidates.reduce((sum, entry) => sum + entry.length, 0);
      if (
        mergeCandidates.length >= REASONING_FRAGMENT_MIN_RUN &&
        mergeTotalChars >= REASONING_FRAGMENT_MIN_TOTAL_CHARS
      ) {
        normalized.push(`> ${joinReasoningFragments(mergeCandidates)}`);
        changed = true;
      } else {
        normalized.push(...mergeCandidates.map((entry) => `> ${entry}`));
      }
      if (mergeEnd < quoteEntries.length) {
        normalized.push(...quoteEntries.slice(mergeEnd).map((entry) => `> ${entry}`));
      }
      index = cursor;
      continue;
    }

    if (!shouldMergeReasoningFragment(current)) {
      normalized.push(current);
      index += 1;
      continue;
    }

    let cursor = index;
    while (cursor < paragraphs.length) {
      const candidate = paragraphs[cursor] ?? "";
      if (!shouldMergeReasoningFragment(candidate)) {
        break;
      }
      cursor += 1;
    }

    const { mergeStart, mergeEnd } = trimReasoningMergeWindow(
      trimmedParagraphs,
      index,
      cursor,
    );

    if (mergeStart > index) {
      normalized.push(...paragraphs.slice(index, mergeStart));
    }

    const mergeCandidates = trimmedParagraphs.slice(mergeStart, mergeEnd).filter(Boolean);
    const mergeTotalChars = mergeCandidates.reduce((sum, entry) => sum + entry.length, 0);
    if (
      mergeCandidates.length >= REASONING_FRAGMENT_MIN_RUN &&
      mergeTotalChars >= REASONING_FRAGMENT_MIN_TOTAL_CHARS
    ) {
      normalized.push(joinReasoningFragments(mergeCandidates));
      changed = true;
    } else {
      normalized.push(...paragraphs.slice(mergeStart, mergeEnd));
    }

    if (mergeEnd < cursor) {
      normalized.push(...paragraphs.slice(mergeEnd, cursor));
    }
    index = cursor;
  }
  return changed ? normalized.join("\n\n") : value;
}

function dedupeReasoningParagraphs(value: string) {
  if (!value) {
    return value;
  }
  const paragraphs = value
    .split(PARAGRAPH_BREAK_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    return value;
  }
  const deduped: string[] = [];
  for (const paragraph of paragraphs) {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      compactStreamingText(previous) === compactStreamingText(paragraph) &&
      compactStreamingText(paragraph).length >= 8
    ) {
      continue;
    }
    deduped.push(paragraph);
  }
  return deduped.join("\n\n");
}

function dedupeRepeatedReasoningSentences(value: string) {
  if (!value) {
    return value;
  }
  const sliceByCompactLength = (text: string, targetCompactLength: number) => {
    let compactLength = 0;
    for (let index = 0; index < text.length; index += 1) {
      const currentChar = text[index] ?? "";
      if (!/\s/.test(currentChar)) {
        compactLength += 1;
      }
      if (compactLength >= targetCompactLength) {
        return text.slice(0, index + 1).trim();
      }
    }
    return text.trim();
  };

  const collapseRepeatedParagraph = (paragraph: string) => {
    const trimmed = paragraph.trim();
    if (trimmed.length < 12) {
      return trimmed;
    }
    const directRepeat = trimmed.match(/^([\s\S]{6,}?)\s+\1$/);
    if (directRepeat?.[1]) {
      return directRepeat[1].trim();
    }
    const compact = compactStreamingText(trimmed);
    if (compact.length >= 12 && compact.length % 2 === 0) {
      const halfLength = compact.length / 2;
      const half = compact.slice(0, halfLength);
      if (`${half}${half}` === compact) {
        return sliceByCompactLength(trimmed, halfLength);
      }
    }
    const sentenceMatches = trimmed.match(/[^。！？!?]+[。！？!?]/g);
    if (sentenceMatches && sentenceMatches.length >= 4 && sentenceMatches.length % 2 === 0) {
      const half = sentenceMatches.length / 2;
      const leftCompact = compactStreamingText(sentenceMatches.slice(0, half).join(""));
      const rightCompact = compactStreamingText(sentenceMatches.slice(half).join(""));
      if (leftCompact.length >= 6 && leftCompact === rightCompact) {
        return sentenceMatches.slice(0, half).join("").trim();
      }
    }
    return trimmed;
  };

  const dedupeParagraph = (paragraph: string) => {
    const collapsed = collapseRepeatedParagraph(paragraph);
    const sentenceMatches = collapsed.match(/[^。！？!?]+[。！？!?]/g);
    if (!sentenceMatches || sentenceMatches.length < 2) {
      return collapsed;
    }
    const deduped: string[] = [];
    for (const sentence of sentenceMatches) {
      const trimmed = sentence.trim();
      const previous = deduped[deduped.length - 1];
      if (
        previous &&
        compactStreamingText(previous) === compactStreamingText(trimmed) &&
        compactStreamingText(trimmed).length >= 6
      ) {
        continue;
      }
      deduped.push(trimmed);
    }
    const remainder = collapsed.slice(sentenceMatches.join("").length);
    return `${deduped.join("")}${remainder}`.trim();
  };

  if (!hasParagraphBreak(value)) {
    return dedupeParagraph(value);
  }
  return value
    .split(PARAGRAPH_BREAK_SPLIT_REGEX)
    .map((entry) => dedupeParagraph(entry.trim()))
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeReasoningReadableText(value: string) {
  const compacted = normalizeReasoningFragmentedParagraphs(value);
  return dedupeRepeatedReasoningSentences(dedupeReasoningParagraphs(compacted));
}

function trailingSummaryFragment(value: string) {
  const fragments = value
    .split(PARAGRAPH_BREAK_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return fragments.length > 0 ? fragments[fragments.length - 1] : "";
}

function compactStreamingText(value: string) {
  return value.replace(/\s+/g, "");
}

function compactComparableStreamingText(value: string) {
  return compactComparableConversationText(compactStreamingText(value));
}

function collapseRepeatedAssistantEcho(value: string) {
  const comparable = compactComparableStreamingText(value);
  if (comparable.length < 16 || comparable.length % 2 !== 0) {
    return value;
  }
  const halfLength = comparable.length / 2;
  const prefix = comparable.slice(0, halfLength);
  if (!prefix || `${prefix}${prefix}` !== comparable) {
    return value;
  }
  return takeByCompactStreamingLength(value, halfLength).trimEnd();
}

export function findDuplicateReasoningSnapshotIndex(
  list: ConversationItem[],
  incoming: Extract<ConversationItem, { kind: "reasoning" }>,
) {
  const incomingText = normalizeReasoningReadableText(
    incoming.content || incoming.summary || "",
  );
  if (!incomingText) {
    return -1;
  }
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const candidate = list[index];
    if (isUserMessageItem(candidate)) {
      break;
    }
    if (!isReasoningItem(candidate)) {
      continue;
    }
    const candidateText = normalizeReasoningReadableText(
      candidate.content || candidate.summary || "",
    );
    if (!candidateText) {
      continue;
    }
    if (areEquivalentReasoningTexts(candidateText, incomingText)) {
      return index;
    }
  }
  return -1;
}

function sharedPrefixLength(left: string, right: string) {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function tailAnchor(value: string) {
  if (!value) {
    return "";
  }
  const anchorLength = Math.min(24, Math.max(8, Math.floor(value.length * 0.3)));
  return value.slice(-anchorLength);
}

function sliceByCompactStreamingLength(value: string, compactLength: number) {
  if (compactLength <= 0) {
    return value;
  }
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const currentChar = value[index] ?? "";
    if (!/\s/.test(currentChar)) {
      count += 1;
    }
    if (count >= compactLength) {
      return value.slice(index + 1);
    }
  }
  return "";
}

function takeByCompactStreamingLength(value: string, compactLength: number) {
  if (compactLength <= 0) {
    return "";
  }
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const currentChar = value[index] ?? "";
    if (!/\s/.test(currentChar)) {
      count += 1;
    }
    if (count >= compactLength) {
      let end = index + 1;
      while (end < value.length && /\s/.test(value[end] ?? "")) {
        end += 1;
      }
      return value.slice(0, end);
    }
  }
  return value;
}

function mergeShiftedSnapshot(existing: string, delta: string) {
  const comparableExisting = compactComparableStreamingText(existing);
  const comparableDelta = compactComparableStreamingText(delta);
  if (comparableExisting.length < 24 || comparableDelta.length < 24) {
    return null;
  }
  if (comparableDelta.length < Math.floor(comparableExisting.length * 0.45)) {
    return null;
  }
  const anchorLength = Math.min(
    28,
    Math.max(10, Math.floor(comparableDelta.length * 0.2)),
  );
  const deltaAnchor = comparableDelta.slice(0, anchorLength);
  if (!deltaAnchor) {
    return null;
  }
  const shiftIndex = comparableExisting.indexOf(deltaAnchor);
  if (shiftIndex <= 0) {
    return null;
  }
  const existingTail = comparableExisting.slice(shiftIndex);
  const comparableOverlap = sharedPrefixLength(existingTail, comparableDelta);
  const minComparableLength = Math.min(existingTail.length, comparableDelta.length);
  if (
    minComparableLength < 16 ||
    comparableOverlap < Math.floor(minComparableLength * 0.72)
  ) {
    return null;
  }
  const existingPrefix = takeByCompactStreamingLength(existing, shiftIndex);
  if (!existingPrefix.trim()) {
    return null;
  }
  return `${existingPrefix}${delta}`;
}

function scoreParagraphFragmentation(value: string) {
  const segments = value
    .split(PARAGRAPH_BREAK_SPLIT_REGEX)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return 0;
  }
  const shortSegments = segments.filter((entry) => entry.length <= 8).length;
  return shortSegments * 3 + segments.length;
}

function chooseReadableText(existing: string, incoming: string) {
  const diagnosticText = chooseAppleEventDiagnosticTextVariant(existing, incoming);
  if (diagnosticText) {
    return diagnosticText;
  }
  const existingScore = scoreParagraphFragmentation(existing);
  const incomingScore = scoreParagraphFragmentation(incoming);
  if (incomingScore < existingScore) {
    return incoming;
  }
  if (existingScore < incomingScore) {
    return existing;
  }
  return incoming.length >= existing.length ? incoming : existing;
}

function mergeReasoningSnapshotText(existing: string, incoming: string) {
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }
  const comparableExisting = compactComparableStreamingText(existing);
  const comparableIncoming = compactComparableStreamingText(incoming);
  if (!comparableExisting) {
    return incoming;
  }
  if (!comparableIncoming) {
    return existing;
  }
  if (comparableExisting === comparableIncoming) {
    return chooseReadableText(existing, incoming);
  }
  if (comparableIncoming.includes(comparableExisting)) {
    return incoming;
  }
  if (comparableExisting.includes(comparableIncoming)) {
    return existing;
  }
  return `${existing}\n\n${incoming}`;
}

function looksLikeMarkdownBlockStart(value: string) {
  const trimmed = value.trimStart();
  return (
    /^[-*+]\s/.test(trimmed) ||
    /^\d+\.\s/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^#{1,6}\s/.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^\|/.test(trimmed)
  );
}

function sanitizeTinyLeadingBreakDelta(existing: string, delta: string) {
  if (!existing || !delta.startsWith("\n\n")) {
    return delta;
  }
  const withoutLeadingBreaks = delta.replace(/^\n{2,}/, "");
  if (!withoutLeadingBreaks) {
    return delta;
  }
  const trimmed = withoutLeadingBreaks.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 20 ||
    looksLikeMarkdownBlockStart(withoutLeadingBreaks)
  ) {
    return delta;
  }
  const previousChar = existing.trimEnd().slice(-1);
  if (!previousChar || /[\n。！？!?;；:：]/.test(previousChar)) {
    return delta;
  }
  return withoutLeadingBreaks;
}

function stripLeadingEchoFromSnapshot(existing: string, candidate: string) {
  if (!existing || !candidate || !candidate.startsWith(existing)) {
    return candidate;
  }
  const compactExisting = compactStreamingText(existing);
  if (compactExisting.length < 12) {
    return candidate;
  }
  let current = candidate;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!current.startsWith(existing)) {
      break;
    }
    const suffix = current.slice(existing.length);
    const trimmedSuffix = suffix.trimStart();
    if (!trimmedSuffix) {
      return existing;
    }
    const compactSuffix = compactStreamingText(trimmedSuffix);
    if (!compactSuffix.startsWith(compactExisting)) {
      break;
    }
    const tail = sliceByCompactStreamingLength(trimmedSuffix, compactExisting.length);
    if (!tail.trim()) {
      return existing;
    }
    current = `${existing}${tail}`;
  }
  return current;
}

function collapseMergedAssistantRepeats(value: string) {
  if (!value.includes("\n") || value.includes("```") || value.includes("~~~")) {
    return value;
  }
  return collapseNearDuplicateParagraphRepeats(value);
}

function collapseLeadingCompletedSnapshotEcho(value: string) {
  const comparableValue = compactComparableStreamingText(value);
  if (comparableValue.length < 48) {
    return value;
  }
  const anchorLength = Math.min(24, Math.floor(comparableValue.length / 2));
  if (anchorLength < 12) {
    return value;
  }
  const leadingAnchor = comparableValue.slice(0, anchorLength);
  if (!leadingAnchor) {
    return value;
  }

  let echoStartIndex = comparableValue.indexOf(leadingAnchor, anchorLength);
  while (echoStartIndex >= 0) {
    if (echoStartIndex >= 24) {
      const leadingComparablePrefix = comparableValue.slice(0, echoStartIndex);
      const comparableRemainder = comparableValue.slice(echoStartIndex);
      if (
        comparableRemainder.length > leadingComparablePrefix.length &&
        comparableRemainder.startsWith(leadingComparablePrefix)
      ) {
        const readableRemainder = sliceByCompactStreamingLength(
          value,
          echoStartIndex,
        ).trimStart();
        if (readableRemainder) {
          return readableRemainder;
        }
      }
    }
    echoStartIndex = comparableValue.indexOf(leadingAnchor, echoStartIndex + 1);
  }

  return value;
}

const CLEAN_SNAPSHOT_LEADING_ECHO_PROBE_CHARS = 16;
/** Floor so tiny openers are never treated as early-body echo. */
const EARLY_BODY_ECHO_MIN_CHARS = 24;
/**
 * Suffix must cover a large share of existing (early-body / full restate).
 * Short trailing citations of the opening line must NOT collapse.
 */
const EARLY_BODY_ECHO_MIN_COVERAGE = 0.5;

/**
 * 快照增长快路径的回显护栏：delta 恰以 existing 为前缀时，新增后缀本应是全新内容；
 * 但若后缀 trimStart 后又以 existing 的开头重放（Claude 偶发的整段回显 existing+existing…），
 * 则需回退到完整去重机器。只探测 existing 头部固定字符，O(1) 成本，不扫全文。
 */
function suffixReplaysLeadingSnapshot(existing: string, suffix: string) {
  if (existing.length < CLEAN_SNAPSHOT_LEADING_ECHO_PROBE_CHARS) {
    return false;
  }
  const probe = existing.slice(0, CLEAN_SNAPSHOT_LEADING_ECHO_PROBE_CHARS);
  return suffix.trimStart().startsWith(probe);
}

function isSubstantialEarlyBodyEcho(existing: string, trimmedSuffix: string): boolean {
  if (
    trimmedSuffix.length < EARLY_BODY_ECHO_MIN_CHARS ||
    trimmedSuffix.length > existing.length ||
    !existing.startsWith(trimmedSuffix)
  ) {
    return false;
  }
  return trimmedSuffix.length >= Math.ceil(existing.length * EARLY_BODY_ECHO_MIN_COVERAGE);
}

/**
 * 折叠「更长稿 A2 + 分隔 + 前半段 A 回显」：
 * 当 incoming 以 existing 为前缀，且后缀（trim 后）是 existing 的 substantial early body 时，保留 existing。
 * 热路径上只做 startsWith / 前缀判定，避免对 clean-prefix 快路径引入额外 O(L) compact。
 */
function collapseEarlyBodyEchoAfterLongerDraft(
  existing: string,
  incoming: string,
): string | null {
  if (!existing || !incoming || incoming.length <= existing.length) {
    return null;
  }

  if (incoming.startsWith(existing)) {
    const trimmedSuffix = incoming.slice(existing.length).replace(/^[\s\u00a0]+/u, "");
    if (!trimmedSuffix) {
      return existing;
    }
    if (isSubstantialEarlyBodyEcho(existing, trimmedSuffix)) {
      return existing;
    }
    return null;
  }

  // 非严格前缀（空白差异）时才走 compact；completed 路径偶发需要。
  const compactExisting = compactComparableStreamingText(existing);
  const compactIncoming = compactComparableStreamingText(incoming);
  if (
    compactExisting.length >= EARLY_BODY_ECHO_MIN_CHARS &&
    compactIncoming.length > compactExisting.length &&
    compactIncoming.startsWith(compactExisting)
  ) {
    const compactRemainder = compactIncoming.slice(compactExisting.length);
    if (
      compactRemainder.length >= EARLY_BODY_ECHO_MIN_CHARS &&
      compactRemainder.length <= compactExisting.length &&
      compactExisting.startsWith(compactRemainder) &&
      compactRemainder.length >= Math.ceil(compactExisting.length * EARLY_BODY_ECHO_MIN_COVERAGE)
    ) {
      return existing;
    }
  }

  return null;
}

export function mergeAgentMessageText(existing: string, delta: string) {
  if (!delta) {
    return existing;
  }
  if (!existing) {
    return collapseMergedAssistantRepeats(delta);
  }

  // 快照增长快路径（Claude 主路径）：delta 是不断增长的整段快照、恰以 existing 为前缀时，
  // 新增后缀若不跨段落边界（去重按 \n\n 段落工作）也不回显 existing 头部，直接追加即可，
  // 把整段去重/归一化推迟到下一个边界快照或收尾——与 mergeReasoningText 等既有的
  // “归一化推迟到边界”约束一致。由此跳过 stripLeadingEchoFromSnapshot / compact /
  // getMarkdownInlineCodeInfo / sharedPrefixLength 对整段 existing 的多趟 O(L) 扫描，
  // 把每次快照更新从 ~O(L) 多趟降到单趟 O(L) 前缀比对 + O(后缀)，消除长回复的 O(L^2) 累计成本。
  if (delta.length > existing.length && delta.startsWith(existing)) {
    const appendedSuffix = delta.slice(existing.length);
    if (
      appendedSuffix &&
      !hasParagraphBreak(appendedSuffix) &&
      !suffixReplaysLeadingSnapshot(existing, appendedSuffix)
    ) {
      return `${existing}${appendedSuffix}`;
    }
    // 跨段落增长：优先折叠 early-body 回显，再进入完整去重机器。
    const earlyBodyEcho = collapseEarlyBodyEchoAfterLongerDraft(existing, delta);
    if (earlyBodyEcho !== null) {
      return collapseMergedAssistantRepeats(earlyBodyEcho);
    }
  } else {
    const earlyBodyEcho = collapseEarlyBodyEchoAfterLongerDraft(existing, delta);
    if (earlyBodyEcho !== null) {
      return collapseMergedAssistantRepeats(earlyBodyEcho);
    }
  }
  const snapshotCandidate = collapseRepeatedAssistantEcho(
    stripLeadingEchoFromSnapshot(
      existing,
      sanitizeTinyLeadingBreakDelta(existing, delta),
    ),
  );
  const normalizedDelta =
    existing && snapshotCandidate.startsWith(existing)
      ? collapseNearDuplicateParagraphRepeats(snapshotCandidate)
      : snapshotCandidate;
  if (!normalizedDelta) {
    return existing;
  }
  if (!existing) {
    return collapseMergedAssistantRepeats(normalizedDelta);
  }
  if (
    isLowRiskStreamingAppendFragment(existing, normalizedDelta) &&
    !existing.startsWith(normalizedDelta) &&
    compactComparableStreamingText(normalizedDelta).length <
      STREAMING_APPEND_MAX_DELTA_COMPACT_CHARS
  ) {
    return mergeStreamingText(existing, normalizedDelta);
  }
  const compactExisting = compactComparableStreamingText(existing);
  const compactDelta = compactComparableStreamingText(normalizedDelta);
  const existingInlineCode = getMarkdownInlineCodeInfo(existing);
  const deltaInlineCode = getMarkdownInlineCodeInfo(normalizedDelta);
  const hasInlineCodeMergeRisk =
    existingInlineCode.hasInlineCode ||
    deltaInlineCode.hasInlineCode ||
    existingInlineCode.hasUnclosedInlineCode ||
    deltaInlineCode.hasUnclosedInlineCode;
  if (compactExisting && compactDelta) {
    if (compactDelta === compactExisting) {
      return collapseMergedAssistantRepeats(chooseReadableText(existing, normalizedDelta));
    }
    if (compactDelta.startsWith(compactExisting) && normalizedDelta.length >= existing.length) {
      return collapseMergedAssistantRepeats(normalizedDelta);
    }
    if (compactExisting.startsWith(compactDelta) && existing.length >= normalizedDelta.length) {
      return collapseMergedAssistantRepeats(existing);
    }
    if (
      !hasInlineCodeMergeRisk &&
      compactDelta.includes(compactExisting) &&
      normalizedDelta.length >= existing.length * 0.8
    ) {
      const firstIndex = compactDelta.indexOf(compactExisting);
      const secondIndex = compactDelta.indexOf(
        compactExisting,
        firstIndex + Math.max(1, Math.floor(compactExisting.length / 2)),
      );
      if (firstIndex > 0 || secondIndex >= 0) {
        return collapseMergedAssistantRepeats(chooseReadableText(existing, normalizedDelta));
      }
      return collapseMergedAssistantRepeats(normalizedDelta);
    }
    if (!hasInlineCodeMergeRisk) {
      const minComparableLength = Math.min(compactDelta.length, compactExisting.length);
      if (minComparableLength >= 24) {
        const sharedComparablePrefix = sharedPrefixLength(compactExisting, compactDelta);
        if (sharedComparablePrefix >= Math.floor(minComparableLength * 0.72)) {
          return collapseMergedAssistantRepeats(chooseReadableText(existing, normalizedDelta));
        }
        const existingTailAnchor = tailAnchor(compactExisting);
        if (
          sharedComparablePrefix >= 12 &&
          existingTailAnchor.length >= 8 &&
          compactDelta.includes(existingTailAnchor)
        ) {
          return collapseMergedAssistantRepeats(chooseReadableText(existing, normalizedDelta));
        }
      }
      const shiftedSnapshot = mergeShiftedSnapshot(existing, normalizedDelta);
      if (shiftedSnapshot) {
        return collapseMergedAssistantRepeats(chooseReadableText(existing, shiftedSnapshot));
      }
    }
  }
  return collapseMergedAssistantRepeats(mergeStreamingText(existing, normalizedDelta));
}

function mergeReasoningText(existing: string, delta: string) {
  const merged = mergeAgentMessageText(existing, delta);
  // 归一化按句子/段落边界工作；无边界的追加片段推迟到下一个边界再整段归一。
  if (isLowRiskStreamingAppendFragmentWithoutBoundary(existing, delta)) {
    return merged;
  }
  return normalizeReasoningReadableText(merged);
}

const REASONING_APPEND_OVERLAP_WINDOW_SLACK_CHARS = 512;
const REASONING_APPEND_OVERLAP_SCAN_LIMIT_CHARS = 512;

function appendReasoningTextWithoutReplacement(existing: string, incoming: string) {
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }
  const comparableIncoming = compactComparableStreamingText(incoming);
  // 重叠长度不会超过 |comparableIncoming|，且 compact 变换是逐字符局部的
  // （去空白 + 标点归一），后缀窗口的 compact 恰是全文 compact 的后缀。
  // 因此 existing 只取尾窗即可等价完成重叠判断，避免每个 delta 全文扫描。
  const windowChars = incoming.length + REASONING_APPEND_OVERLAP_WINDOW_SLACK_CHARS;
  let comparableExisting: string;
  let comparableExistingIsFull = true;
  if (existing.length > windowChars) {
    comparableExisting = compactComparableStreamingText(existing.slice(-windowChars));
    comparableExistingIsFull = false;
    if (comparableExisting.length <= comparableIncoming.length) {
      // 尾窗几乎全是空白，compact 后不足以覆盖可能的重叠，退回全文比较。
      comparableExisting = compactComparableStreamingText(existing);
      comparableExistingIsFull = true;
    }
  } else {
    comparableExisting = compactComparableStreamingText(existing);
  }
  if (!comparableExisting || !comparableIncoming) {
    return `${existing}${incoming}`;
  }
  // 窗口模式下 comparableExisting 严格长于 comparableIncoming，整体相等不可能成立。
  if (comparableExistingIsFull && comparableExisting === comparableIncoming) {
    return existing;
  }
  // KMP 线性重叠检测（保留 SCAN_LIMIT 截断语义）：对截断后的输入求最长
  // 「existing 后缀 = incoming 前缀」，替代逐字符递减 endsWith 的二次扫描。
  const overlapLength = longestSuffixPrefixOverlap(
    comparableExisting.length > REASONING_APPEND_OVERLAP_SCAN_LIMIT_CHARS
      ? comparableExisting.slice(-REASONING_APPEND_OVERLAP_SCAN_LIMIT_CHARS)
      : comparableExisting,
    comparableIncoming.length > REASONING_APPEND_OVERLAP_SCAN_LIMIT_CHARS
      ? comparableIncoming.slice(0, REASONING_APPEND_OVERLAP_SCAN_LIMIT_CHARS)
      : comparableIncoming,
  );
  if (overlapLength > 0) {
    const suffix = sliceByCompactStreamingLength(incoming, overlapLength);
    return suffix ? `${existing}${suffix}` : existing;
  }
  return `${existing}${incoming}`;
}

function shouldTreatGeminiReasoningAsSnapshot(existing: string, incoming: string) {
  const normalizedExisting = normalizeReasoningReadableText(existing);
  const normalizedIncoming = normalizeReasoningReadableText(incoming);
  if (!normalizedExisting || !normalizedIncoming) {
    return true;
  }
  const comparableExisting = compactComparableStreamingText(normalizedExisting);
  const comparableIncoming = compactComparableStreamingText(normalizedIncoming);
  if (!comparableExisting || !comparableIncoming) {
    return true;
  }
  if (
    comparableIncoming.includes(comparableExisting) ||
    comparableExisting.includes(comparableIncoming)
  ) {
    return true;
  }
  const minComparableLength = Math.min(
    comparableExisting.length,
    comparableIncoming.length,
  );
  if (minComparableLength >= 24) {
    const sharedComparablePrefix = sharedPrefixLength(
      comparableExisting,
      comparableIncoming,
    );
    if (sharedComparablePrefix >= Math.floor(minComparableLength * 0.7)) {
      return comparableIncoming.length >= comparableExisting.length;
    }
  }
  return false;
}

export function mergeReasoningTextForThread(
  threadId: string,
  existing: string,
  incoming: string,
) {
  if (isGeminiReasoningThread(threadId) || isKimiReasoningThread(threadId)) {
    const normalizedExisting = normalizeReasoningReadableText(existing);
    const normalizedIncoming = normalizeReasoningReadableText(incoming);
    if (!normalizedExisting) {
      return normalizedIncoming;
    }
    if (!normalizedIncoming) {
      return normalizedExisting;
    }
    const merged = shouldTreatGeminiReasoningAsSnapshot(
      normalizedExisting,
      normalizedIncoming,
    )
      ? mergeReasoningSnapshotText(normalizedExisting, normalizedIncoming)
      : appendReasoningTextWithoutReplacement(
        normalizedExisting,
        normalizedIncoming,
      );
    return normalizeReasoningReadableText(merged);
  }
  if (isClaudeReasoningThread(threadId)) {
    const merged = appendReasoningTextWithoutReplacement(existing, incoming);
    if (isLowRiskStreamingAppendFragmentWithoutBoundary(existing, incoming)) {
      return merged;
    }
    return normalizeReasoningReadableText(merged);
  }
  return mergeReasoningText(existing, incoming);
}

export function mergeReasoningSnapshotTextForThread(
  threadId: string,
  existing: string,
  incoming: string,
) {
  if (isClaudeReasoningThread(threadId)) {
    return normalizeReasoningReadableText(
      appendReasoningTextWithoutReplacement(existing, incoming),
    );
  }
  return mergeReasoningSnapshotText(existing, incoming);
}

export function mergeCompletedAgentText(
  existing: string,
  completed: string,
  preserveCompletedMessageLength?: boolean,
) {
  const normalizedCompleted = normalizeCompletedAssistantText(completed);
  if (!normalizedCompleted) {
    return existing;
  }
  if (!existing) {
    return normalizedCompleted;
  }

  // live-text settle 竞态：provider complete 可能只带回建壳首字，而 durable 已
  // 有更长正文。禁止把全文缩回「这」「已」「**」。
  if (
    existing.length > normalizedCompleted.length &&
    (existing.startsWith(normalizedCompleted) ||
      (normalizedCompleted.length <= 8 && existing.includes(normalizedCompleted)))
  ) {
    return existing;
  }

  const earlyBodyEcho = collapseEarlyBodyEchoAfterLongerDraft(
    existing,
    normalizedCompleted,
  );
  if (earlyBodyEcho !== null) {
    return collapseMergedAssistantRepeats(earlyBodyEcho);
  }

  const compactExisting = compactStreamingText(existing);
  const compactCompleted = compactStreamingText(normalizedCompleted);
  if (!compactExisting || !compactCompleted) {
    return normalizedCompleted;
  }

  if (compactCompleted === compactExisting) {
    return chooseReadableText(existing, normalizedCompleted);
  }

  const nearDuplicateParagraphMerge = mergeNearDuplicateParagraphVariants(
    existing,
    normalizedCompleted,
  );
  if (nearDuplicateParagraphMerge) {
    return chooseReadableText(nearDuplicateParagraphMerge, normalizedCompleted);
  }

  const comparableExisting = compactComparableStreamingText(existing);
  const comparableCompleted = compactComparableStreamingText(normalizedCompleted);
  if (comparableExisting && comparableCompleted) {
    if (
      comparableExisting.length >= 48 &&
      comparableExisting.length > comparableCompleted.length &&
      comparableExisting.includes(comparableCompleted)
    ) {
      return existing;
    }
    const comparableLengthDelta = Math.abs(
      comparableCompleted.length - comparableExisting.length,
    );
    const sharedComparablePrefix = sharedPrefixLength(
      comparableExisting,
      comparableCompleted,
    );
    if (
      Math.min(comparableExisting.length, comparableCompleted.length) >= 24 &&
      comparableLengthDelta <= 6 &&
      sharedComparablePrefix >= 6
    ) {
      const existingTailAnchor = tailAnchor(comparableExisting);
      const completedTailAnchor = tailAnchor(comparableCompleted);
      if (
        existingTailAnchor.length >= 8 &&
        completedTailAnchor.length >= 8 &&
        comparableCompleted.includes(existingTailAnchor) &&
        comparableExisting.includes(completedTailAnchor)
      ) {
        return chooseReadableText(existing, normalizedCompleted);
      }
    }
  }

  const repeatedFromStart =
    compactCompleted.startsWith(compactExisting) &&
    compactCompleted.endsWith(compactExisting) &&
    compactCompleted.length > compactExisting.length &&
    compactCompleted.indexOf(compactExisting, 1) >= compactExisting.length;
  if (
    repeatedFromStart &&
    scoreParagraphFragmentation(normalizedCompleted) > scoreParagraphFragmentation(existing)
  ) {
    return existing;
  }

  return normalizeCompletedAssistantText(
    mergeAgentMessageText(existing, normalizedCompleted),
    preserveCompletedMessageLength,
  );
}

function normalizeCompletedAssistantText(
  value: string,
  preserveMessageTextLength?: boolean,
) {
  const cleanedValue = collapseLeadingCompletedSnapshotEcho(
    stripClaudeApprovalResumeArtifacts(value),
  );
  const collapsedRawParagraphBlocks =
    collapseNearDuplicateParagraphRepeats(cleanedValue);
  if (collapsedRawParagraphBlocks !== cleanedValue) {
    return collapsedRawParagraphBlocks;
  }
  const normalizedMessage = normalizeItem({
    id: "__completed-assistant-normalization__",
    kind: "message",
    role: "assistant",
    text: cleanedValue,
  }, { preserveMessageTextLength });
  const normalizedByItem =
    normalizedMessage.kind === "message" ? normalizedMessage.text : cleanedValue;
  if (normalizedByItem && normalizedByItem !== value) {
    return collapseNearDuplicateParagraphRepeats(normalizedByItem);
  }

  const trimmed = cleanedValue.trim();
  if (!trimmed) {
    return cleanedValue;
  }

  // 非 markdown 普通文本里，偶发会收到 "A + 空白 + A" 的重复 completed payload。
  // 这里优先压缩为单份，避免最终气泡出现整段重复拼接。
  if (!/```/.test(trimmed) && !looksLikeMarkdownBlockStart(trimmed)) {
    const directRepeat = trimmed.match(/^([\s\S]{12,}?)\s+\1$/);
    if (directRepeat?.[1]) {
      return directRepeat[1].trim();
    }
  }

  return collapseNearDuplicateParagraphRepeats(cleanedValue);
}

export function addSummaryBoundary(existing: string) {
  if (!existing) {
    return existing;
  }
  const trailingFragment = trailingSummaryFragment(existing);
  if (!trailingFragment) {
    return existing;
  }
  if (
    trailingFragment.length < REASONING_BOUNDARY_MIN_TRAILING_CHARS &&
    !REASONING_BOUNDARY_PUNCTUATION_REGEX.test(trailingFragment)
  ) {
    return existing;
  }
  if (existing.endsWith("\n\n")) {
    return existing;
  }
  if (existing.endsWith("\n")) {
    return `${existing}\n`;
  }
  return `${existing}\n\n`;
}
