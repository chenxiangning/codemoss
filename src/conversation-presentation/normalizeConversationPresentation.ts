import type {
  BrowserContextSendAttachment,
  BrowserPresentationContextView,
  ConversationItem,
  ConversationPresentationContext,
  IntentCanvasContextSendAttachment,
  MessagePresentationMetadata,
  NoteCardPresentationNote,
} from "../types";
import {
  parseBrowserContextPrompt,
  stripBrowserContextPrompt,
} from "../features/browser-agent/utils/attachment";
import {
  parseIntentCanvasContextSummaries,
  stripIntentCanvasContextPrompt,
} from "../features/intent-canvas/utils/messageContext";
import { NOTE_CARD_CONTEXT_SUMMARY_PREFIX } from "@mossx/plugin-notes/runtime";
import {
  MEMORY_CONTEXT_SUMMARY_PREFIX,
  MEMORY_PICK_STATUS_PREFIX,
} from "../features/project-memory/utils/memoryMarkers";
import { parseProjectMemoryRetrievalPackPrefix } from "../features/project-memory/utils/projectMemoryRetrievalPack";
import { extractCommandMessageDisplayText } from "../utils/commandMessageTags";
import {
  extractLatestUserInputTextPreserveFormatting,
  stripAgentPromptBlockFromTail,
  stripModeFallbackBlock,
  stripSharedSessionContextSyncBlock,
} from "../utils/threadItemsUserMessage";

type MessageItem = Extract<ConversationItem, { kind: "message" }>;

const PROJECT_MEMORY_XML_PREFIX_REGEX =
  /^<project-memory\b[^>]*>([\s\S]*?)<\/project-memory>\s*/i;
const PROJECT_MEMORY_KIND_LINE_REGEX =
  /^\[(?:已知问题|技术决策|项目上下文|对话记录|笔记|记忆)\]\s*/;
const LEGACY_MEMORY_RECORD_HINT_REGEX =
  /(?:用户输入[:：]|助手输出摘要[:：]|助手输出[:：])/;
const NOTE_CARD_CONTEXT_BLOCK_REGEX =
  /<note-card-context>\s*([\s\S]*?)\s*<\/note-card-context>/i;
const NOTE_CARD_BLOCK_REGEX = /<note-card\b([^>]*)>([\s\S]*?)<\/note-card>/gi;
const NOTE_CARD_CONTEXT_SUFFIX_REGEX =
  /(?:\r?\n){1,2}(<note-card-context>[\s\S]*<\/note-card-context>)\s*$/i;

const MEMORY_PICK_RECORD_LINE_REGEX =
  /^#(\d+)\s*\|\s*([^\s|]+)\s*\|\s*([^|]+?)(?:\s*\|\s*([^|]*?))?(?:\s*\|\s*([0-9.]+))?\s*$/;

function parseMemoryPickPreviewRecordsFromText(preview: string) {
  const records: Array<{
    displayIndex: string;
    index: string;
    memoryId: string;
    source: string;
    title: string;
    summary?: string;
    score?: number;
  }> = [];
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

function buildMemoryPreviewContext(preview: string): ConversationPresentationContext | null {
  const normalizedPreview = preview.trim();
  if (!normalizedPreview) {
    return null;
  }
  const pickRecords = parseMemoryPickPreviewRecordsFromText(normalizedPreview);
  if (pickRecords.length > 0) {
    const lines = pickRecords.map(
      (record) => `${record.displayIndex} ${record.title}`.trim(),
    );
    return {
      kind: "memory",
      preview: lines.slice(0, 3).join("；"),
      lines,
      markdown: lines.join("\n"),
      source: "memory-pick",
      records: pickRecords,
      packs: [],
    };
  }
  const lines = normalizedPreview
    .split(/[；\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("记忆挑选"));
  return {
    kind: "memory",
    preview: lines.length > 0 ? lines.join("；") : normalizedPreview,
    lines: lines.length > 0 ? lines : [normalizedPreview],
    markdown: normalizedPreview,
    records: [],
    packs: [],
  };
}

function parseInjectedMemoryContext(text: string): {
  context: ConversationPresentationContext;
  remainingText: string;
} | null {
  const normalized = text.trimStart();
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
    const records = packSummaries
      .flatMap((summary) =>
        summary.records.map((record) => ({
          ...record,
          source: summary.source,
        })),
      )
      .map((record, index) => ({
        ...record,
        displayIndex: `#${index + 1}`,
      }));
    const lines = records.length > 0
      ? records.map((record) =>
          `${record.displayIndex} ${record.title || record.memoryId}`.trim(),
        )
      : packSummaries.flatMap((summary) => summary.lines);
    const preview = lines.slice(0, 3).join("；") ||
      packSummaries.map((summary) => summary.preview).filter(Boolean).join("；");
    return {
      context: {
        kind: "memory",
        preview,
        lines,
        markdown: preview,
        source: packSummaries.map((summary) => summary.source).filter(Boolean).join(","),
        rawPayload: packSummaries.map((summary) => summary.rawPayload).join("\n\n"),
        records,
        packs: packSummaries.map((summary) => ({
          source: summary.source,
          count: summary.count,
          cleanedContext: summary.cleanedContext,
          rawPayload: summary.rawPayload,
        })),
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
      .filter((line) => PROJECT_MEMORY_KIND_LINE_REGEX.test(line));
    const context = buildMemoryPreviewContext(
      memoryLines.length > 0 ? memoryLines.join("；") : blockBody,
    );
    return context
      ? {
          context,
          remainingText: normalized.slice(xmlMatch[0].length).trimStart(),
        }
      : null;
  }

  if (
    PROJECT_MEMORY_KIND_LINE_REGEX.test(normalized) &&
    LEGACY_MEMORY_RECORD_HINT_REGEX.test(normalized)
  ) {
    const [memoryBlock = "", ...remainingBlocks] = normalized.split(
      /\r?\n[^\S\r\n]*\r?\n+/,
    );
    const context = buildMemoryPreviewContext(memoryBlock);
    return context && remainingBlocks.length > 0
      ? { context, remainingText: remainingBlocks.join("\n\n").trimStart() }
      : null;
  }
  return null;
}

function parseMemoryPickEmptyStatusContext(
  text: string,
): ConversationPresentationContext | null {
  const normalized = text.trim();
  if (!normalized.startsWith(MEMORY_PICK_STATUS_PREFIX)) {
    return null;
  }
  const body = normalized.slice(MEMORY_PICK_STATUS_PREFIX.length).trim();
  const lines = body
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  // reason \n title \n message
  const reason = lines[0] ?? "no_match";
  const title = lines[1] ?? "记忆参考";
  const message = lines.slice(2).join(" ") || lines[1] || body;
  return {
    kind: "memory",
    preview: message,
    lines: [title, message],
    markdown: message,
    source: "memory-pick-empty",
    records: [],
    packs: [],
    // reason 放 markdown 旁路字段不够；用 rawPayload 轻量携带
    rawPayload: reason,
  };
}

function parseAssistantMemoryContext(text: string): ConversationPresentationContext | null {
  const normalized = text.trim();
  const emptyStatus = parseMemoryPickEmptyStatusContext(normalized);
  if (emptyStatus) {
    return emptyStatus;
  }
  if (!normalized.startsWith(MEMORY_CONTEXT_SUMMARY_PREFIX)) {
    return null;
  }
  return buildMemoryPreviewContext(
    normalized.slice(MEMORY_CONTEXT_SUMMARY_PREFIX.length).trim(),
  );
}

function readNoteCardAttribute(attributes: string, name: string) {
  return new RegExp(`${name}="([^"]*)"`, "i").exec(attributes)?.[1]?.trim() ?? "";
}

function parseNoteCardBody(rawBody: string) {
  const normalized = rawBody.trim();
  const lines = normalized.split(/\r?\n/);
  const imagesMarkerIndex = lines.findIndex((line) => line.trim() === "Images:");
  if (imagesMarkerIndex < 0) {
    return { bodyMarkdown: normalized, attachments: [] };
  }
  const attachments = lines
    .slice(imagesMarkerIndex + 1)
    .map((line) => /^\s*-\s*(.+?)\s*\|\s*(.+?)\s*$/.exec(line))
    .flatMap((match) =>
      match?.[2]
        ? [{ fileName: match[1]?.trim() ?? "", absolutePath: match[2].trim() }]
        : [],
    );
  return {
    bodyMarkdown: lines.slice(0, imagesMarkerIndex).join("\n").trim(),
    attachments,
  };
}

function parseNoteCardContextBlock(text: string): ConversationPresentationContext | null {
  const blockMatch = text.trim().match(NOTE_CARD_CONTEXT_BLOCK_REGEX);
  if (!blockMatch?.[1]) {
    return null;
  }
  const notes: NoteCardPresentationNote[] = [];
  for (const noteMatch of blockMatch[1].matchAll(NOTE_CARD_BLOCK_REGEX)) {
    const parsedBody = parseNoteCardBody(noteMatch[2] ?? "");
    notes.push({
      title: readNoteCardAttribute(noteMatch[1] ?? "", "title"),
      archived: readNoteCardAttribute(noteMatch[1] ?? "", "archived").toLowerCase() === "true",
      bodyMarkdown: parsedBody.bodyMarkdown,
      attachments: parsedBody.attachments,
    });
  }
  if (notes.length === 0) {
    return null;
  }
  const imagePaths = Array.from(
    new Set(notes.flatMap((note) => note.attachments.map((attachment) => attachment.absolutePath))),
  );
  const title = notes[0]?.title || "Note card";
  return {
    kind: "note-card",
    title,
    summary: notes.map((note) => note.title || note.bodyMarkdown).filter(Boolean).join("；"),
    notes,
    imagePaths,
  };
}

function parseInjectedNoteCardContext(text: string): {
  context: ConversationPresentationContext;
  remainingText: string;
} | null {
  const normalized = text.trimEnd();
  const contextMatch = normalized.match(NOTE_CARD_CONTEXT_SUFFIX_REGEX);
  if (!contextMatch?.[1] || contextMatch.index === undefined) {
    return null;
  }
  const context = parseNoteCardContextBlock(contextMatch[1]);
  return context
    ? {
        context,
        remainingText: normalized.slice(0, contextMatch.index).replace(/\s+$/, ""),
      }
    : null;
}

function parseAssistantNoteCardContext(text: string): ConversationPresentationContext | null {
  const normalized = text.trim();
  if (!normalized.startsWith(NOTE_CARD_CONTEXT_SUMMARY_PREFIX)) {
    return null;
  }
  return parseNoteCardContextBlock(
    normalized.slice(NOTE_CARD_CONTEXT_SUMMARY_PREFIX.length).trim(),
  );
}

function toBrowserContext(
  attachment: BrowserPresentationContextView | BrowserContextSendAttachment,
): ConversationPresentationContext {
  const view: BrowserPresentationContextView = {
    ...attachment,
  };
  const evidenceCount =
    (attachment.readableBlocks?.length ?? 0) +
    (attachment.visualEvidence?.length ?? 0) +
    (attachment.screenshotRefs?.length ?? 0) +
    (attachment.ocrTextSupplements?.length ?? 0) +
    (attachment.codeCandidates?.length ?? 0);
  return {
    kind: "browser",
    title: attachment.title?.trim() || attachment.url,
    summary: attachment.summary,
    evidenceCount,
    view,
  };
}

function toIntentCanvasContext(
  attachment: IntentCanvasContextSendAttachment,
): ConversationPresentationContext {
  const { kind: _kind, ...view } = attachment;
  return {
    kind: "intent-canvas",
    title: attachment.title,
    summary: attachment.title,
    view,
  };
}

function normalizeVisibleUserText(text: string, enableCollaborationBadge: boolean) {
  const modeSafeText = enableCollaborationBadge ? stripModeFallbackBlock(text) : text;
  const sharedSafeText = stripSharedSessionContextSyncBlock(modeSafeText);
  const commandSafeText = extractCommandMessageDisplayText(sharedSafeText);
  const latestUserInput = extractLatestUserInputTextPreserveFormatting(commandSafeText);
  return stripAgentPromptBlockFromTail(latestUserInput).trim();
}

export function buildMessagePresentationMetadata(
  item: MessageItem,
  options: { enableCollaborationBadge?: boolean } = {},
): MessagePresentationMetadata {
  if (item.presentationMetadata) {
    return item.presentationMetadata;
  }
  if (item.role === "assistant") {
    const contexts = [
      parseAssistantMemoryContext(item.text),
      parseAssistantNoteCardContext(item.text),
    ].filter((context): context is ConversationPresentationContext => context !== null);
    return {
      displayText: contexts.length > 0 ? "" : item.text,
      stickyCandidateText: contexts.length > 0 ? "" : item.text,
      contexts,
    };
  }

  const contexts: ConversationPresentationContext[] = [];
  const browserAttachment = item.browserContextAttachment ?? parseBrowserContextPrompt(item.text);
  if (browserAttachment) {
    contexts.push(toBrowserContext(browserAttachment));
  }
  let visibleText = stripBrowserContextPrompt(item.text);

  const memoryMatch = parseInjectedMemoryContext(visibleText);
  if (memoryMatch) {
    contexts.push(memoryMatch.context);
    visibleText = memoryMatch.remainingText;
  }
  const noteCardMatch = parseInjectedNoteCardContext(visibleText);
  if (noteCardMatch) {
    contexts.push(noteCardMatch.context);
    visibleText = noteCardMatch.remainingText;
  }

  const intentAttachments = item.intentCanvasContextAttachments?.length
    ? item.intentCanvasContextAttachments
    : parseIntentCanvasContextSummaries(visibleText);
  contexts.push(...intentAttachments.map(toIntentCanvasContext));
  visibleText = stripIntentCanvasContextPrompt(visibleText);

  const normalizedVisibleText = normalizeVisibleUserText(
    visibleText,
    options.enableCollaborationBadge ?? item.engineSource === "codex",
  );
  const fallbackContextText = contexts.find(
    (context): context is Extract<ConversationPresentationContext, { kind: "memory" }> =>
      context.kind === "memory",
  )?.preview ?? "";
  return {
    displayText: normalizedVisibleText || fallbackContextText,
    stickyCandidateText: normalizedVisibleText,
    contexts,
  };
}

export function withMessagePresentationMetadata(item: MessageItem): MessageItem {
  if (item.role === "user" && item.presentationMetadata) {
    return item;
  }
  const { presentationMetadata: _presentationMetadata, ...metadataSource } = item;
  return {
    ...metadataSource,
    presentationMetadata: buildMessagePresentationMetadata(metadataSource),
  };
}

export function getPresentationContext<TKind extends ConversationPresentationContext["kind"]>(
  metadata: MessagePresentationMetadata,
  kind: TKind,
): Extract<ConversationPresentationContext, { kind: TKind }> | null {
  return metadata.contexts.find(
    (context): context is Extract<ConversationPresentationContext, { kind: TKind }> =>
      context.kind === kind,
  ) ?? null;
}

export function getPresentationContexts<TKind extends ConversationPresentationContext["kind"]>(
  metadata: MessagePresentationMetadata,
  kind: TKind,
): Array<Extract<ConversationPresentationContext, { kind: TKind }>> {
  return metadata.contexts.filter(
    (context): context is Extract<ConversationPresentationContext, { kind: TKind }> =>
      context.kind === kind,
  );
}
