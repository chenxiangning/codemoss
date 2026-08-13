import { extractCommandMessagePromptText } from "./commandMessageTags";
import { normalizeAgentIcon } from "./agentIcons";

export const MAX_DEFAULT_THREAD_TITLE_CHARS = 50;

const USER_INPUT_BLOCK_MARKER_REGEX = /\[User Input\]\s*/g;
const AGENT_PROMPT_BLOCK_AT_TAIL_REGEX =
  /(?:\r?\n){2}##\s*Agent Role and Instructions\s*(?:\r?\n){2}([\s\S]*)$/;
const AGENT_PROMPT_NAME_LINE_REGEX =
  /^(?:agent\s*name|selected\s*agent|智能体(?:名称|标题)?|agent)\s*[:：]\s*(.+)$/i;
const AGENT_PROMPT_ICON_LINE_REGEX =
  /^(?:agent\s*icon|selected\s*agent\s*icon|智能体图标|agent\s*icon\s*id)\s*[:：]\s*(.+)$/i;
const TITLE_INJECTED_LINE_PREFIX_REGEX =
  /^\[(?:System|Session Spec Link|Spec Root Priority|Skill Prompt|Commons Prompt)\][^\n]*(?:\r?\n|$)/i;
// 与 conversationNormalization 对齐：legacy project-memory + 现网 project-memory-pack
const PROJECT_MEMORY_BLOCK_REGEX =
  /^<project-memory(?:-pack)?\b[\s\S]*?<\/project-memory(?:-pack)?>\s*/i;
/** 未闭合/被 engine firstMessage 截断的注入包（侧栏标题污染源） */
const PROJECT_MEMORY_OPEN_TAG_PREFIX_REGEX =
  /^<project-memory(?:-pack)?\b/i;
/**
 * Grok CLI bootstrap 信封（user_info + rules 等）被截断进 firstMessage 时的
 * 侧栏污染形态：`<user_info> OS Version: macos Shell...`
 */
const GROK_RUNTIME_CONTEXT_OPEN_TAG_PREFIX_REGEX =
  /^<(?:user_info|rules|git_status|system-reminder|open_and_recently_viewed_files|agent_skills|mcp_servers|image_compression_notice)\b/i;
const PROJECT_MEMORY_CLOSE_TAG_REGEX =
  /<\/project-memory(?:-pack)?>/i;
const PROJECT_MEMORY_LINE_PREFIX_REGEX =
  /^\[(?:已知问题|技术决策|项目上下文|对话记录|笔记|记忆)\]\s+/;
const MODE_FALLBACK_PREFIX_REGEX =
  /^(?:collaboration mode:\s*code\.|execution policy \(default mode\):|execution policy \(plan mode\):)/i;
const MODE_FALLBACK_MARKER_REGEX = /User request\s*:\s*/i;
const SHARED_SESSION_SYNC_PREFIX_REGEX =
  /^Shared session context sync\.\s*Continue from these recent turns before answering the new request:\s*/i;
const SHARED_SESSION_CURRENT_REQUEST_MARKER_REGEX =
  /(?:\r?\n){1,2}Current user request:\s*(?:\r?\n)?/i;
const MAX_INJECTED_MEMORY_LINES = 12;
const MESSAGE_PARAGRAPH_BREAK_SPLIT_REGEX = /\r?\n[^\S\r\n]*\r?\n+/;

function asString(value: unknown) {
  return typeof value === "string" ? value : value ? String(value) : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractModeFallbackMode(text: string): "plan" | "code" | null {
  const trimmed = text.trimStart();
  if (!MODE_FALLBACK_PREFIX_REGEX.test(trimmed)) {
    return null;
  }
  return /^execution policy \(plan mode\):/i.test(trimmed) ? "plan" : "code";
}

function normalizeCollaborationMode(value: unknown): "plan" | "code" | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "default") {
    return "code";
  }
  return normalized === "plan" || normalized === "code"
    ? normalized
    : null;
}

function parseCollaborationModeValue(value: unknown): "plan" | "code" | null {
  const direct = normalizeCollaborationMode(value);
  if (direct) {
    return direct;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return (
    normalizeCollaborationMode(record.mode) ??
    normalizeCollaborationMode(record.id) ??
    normalizeCollaborationMode(record.name) ??
    null
  );
}

export function extractCollaborationModeFromUserMessageItem(
  item: Record<string, unknown>,
  fallbackMode: "plan" | "code" | null,
): "plan" | "code" | null {
  const metadata = asRecord(item.metadata);
  const candidates: unknown[] = [
    item.collaborationMode,
    item.collaboration_mode,
    item.selectedUiMode,
    item.selected_ui_mode,
    item.effectiveUiMode,
    item.effective_ui_mode,
    item.mode,
    metadata?.collaborationMode,
    metadata?.collaboration_mode,
    metadata?.mode,
  ];
  for (const candidate of candidates) {
    const mode = parseCollaborationModeValue(candidate);
    if (mode) {
      return mode;
    }
  }
  return fallbackMode;
}

export function stripInjectedProjectMemoryBlock(text: string) {
  if (!text) {
    return "";
  }
  let normalized = text;
  let changed = false;
  let trimmedLeading = normalized.trimStart();
  while (PROJECT_MEMORY_BLOCK_REGEX.test(trimmedLeading)) {
    normalized = trimmedLeading.replace(PROJECT_MEMORY_BLOCK_REGEX, "");
    changed = true;
    trimmedLeading = normalized.trimStart();
  }

  // engine firstMessage / nativeTitle 常截到 50~200 字，闭合标签丢失 → 正则匹配失败，
  // 侧栏就会显示「<project-memory-pack s…」。未闭合时整段视为注入残片丢弃。
  if (
    PROJECT_MEMORY_OPEN_TAG_PREFIX_REGEX.test(trimmedLeading) &&
    !PROJECT_MEMORY_CLOSE_TAG_REGEX.test(trimmedLeading)
  ) {
    return "";
  }

  const blocks = normalized.trimStart().split(MESSAGE_PARAGRAPH_BREAK_SPLIT_REGEX);
  if (blocks.length >= 2) {
    const firstBlock = blocks[0] ?? "";
    const firstBlockLines = firstBlock
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const looksLikeInjectedMemoryLines =
      firstBlockLines.length > 0 &&
      firstBlockLines.length <= MAX_INJECTED_MEMORY_LINES &&
      firstBlockLines.every((line) => PROJECT_MEMORY_LINE_PREFIX_REGEX.test(line));
    if (looksLikeInjectedMemoryLines) {
      normalized = blocks.slice(1).join("\n\n");
      changed = true;
    }
  }
  if (!changed) {
    return text;
  }
  return normalized.trimStart();
}

export function stripModeFallbackBlock(text: string) {
  if (!extractModeFallbackMode(text)) {
    return text;
  }
  const marker = MODE_FALLBACK_MARKER_REGEX.exec(text);
  if (!marker || marker.index < 0) {
    return text;
  }
  const extracted = text.slice(marker.index + marker[0].length).trim();
  return extracted || text;
}

export function stripSharedSessionContextSyncBlock(text: string) {
  if (!SHARED_SESSION_SYNC_PREFIX_REGEX.test(text.trimStart())) {
    return text;
  }
  const marker = SHARED_SESSION_CURRENT_REQUEST_MARKER_REGEX.exec(text);
  if (!marker || marker.index < 0) {
    return text;
  }
  const extractedRaw = text.slice(marker.index + marker[0].length);
  const extracted = extractedRaw.replace(/^\r?\n/, "").replace(/^ /, "");
  return extracted.trim().length > 0 ? extracted : text;
}

export function extractLatestUserInputTextPreserveFormatting(text: string): string {
  const userInputMatches = [...text.matchAll(USER_INPUT_BLOCK_MARKER_REGEX)];
  if (userInputMatches.length === 0) {
    return text;
  }
  const lastMatch = userInputMatches[userInputMatches.length - 1];
  if (!lastMatch) {
    return text;
  }
  const markerIndex = lastMatch.index ?? -1;
  if (markerIndex < 0) {
    return text;
  }
  const markerLength = lastMatch[0]?.length ?? 0;
  const extractedRaw = text.slice(markerIndex + markerLength);
  const extracted = extractedRaw.replace(/^\r?\n/, "").replace(/^ /, "");
  return extracted.trim().length > 0 ? extracted : text;
}

export function stripAgentPromptBlockFromTail(text: string): string {
  const match = AGENT_PROMPT_BLOCK_AT_TAIL_REGEX.exec(text);
  if (!match || typeof match.index !== "number" || match.index < 0) {
    return text;
  }
  const baseText = text.slice(0, match.index).replace(/\s+$/, "");
  return baseText || text;
}

function normalizeSelectedAgentName(value: unknown): string | null {
  const text = asString(value).trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(/^#+\s*/, "").trim();
  return normalized || null;
}

function extractAgentNameFromPromptLine(value: string | null): string | null {
  const normalized = normalizeSelectedAgentName(value);
  if (!normalized) {
    return null;
  }
  const namedMatch = AGENT_PROMPT_NAME_LINE_REGEX.exec(normalized);
  if (namedMatch?.[1]) {
    return normalizeSelectedAgentName(namedMatch[1]);
  }
  const firstClause = normalized.split(/[,:，；;：。！？!?]/)[0]?.trim() ?? "";
  if (firstClause && firstClause.length <= 24) {
    return firstClause;
  }
  return null;
}

function extractSelectedAgentNameFromPromptText(text: string): string | null {
  const match = AGENT_PROMPT_BLOCK_AT_TAIL_REGEX.exec(text);
  if (!match) {
    return null;
  }
  const tailText = match[1] ?? "";
  if (!tailText.trim()) {
    return null;
  }
  const firstLine =
    tailText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? null;
  return extractAgentNameFromPromptLine(firstLine);
}

function extractSelectedAgentIconFromPromptText(text: string): string | null {
  const match = AGENT_PROMPT_BLOCK_AT_TAIL_REGEX.exec(text);
  if (!match) {
    return null;
  }
  const tailText = match[1] ?? "";
  if (!tailText.trim()) {
    return null;
  }
  for (const line of tailText.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }
    const iconMatch = AGENT_PROMPT_ICON_LINE_REGEX.exec(trimmedLine);
    if (!iconMatch?.[1]) {
      continue;
    }
    const normalized = normalizeAgentIcon(iconMatch[1]);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function extractRawUserMessageTextCandidates(item: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const directText = asString(item.text);
  if (directText.trim()) {
    candidates.push(directText);
  }
  const content = Array.isArray(item.content) ? item.content : [];
  for (const entry of content) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const text = asString(record.text ?? record.value ?? record.content ?? "");
    if (text.trim()) {
      candidates.push(text);
    }
  }
  return candidates;
}

export function extractSelectedAgentNameFromUserMessageItem(
  item: Record<string, unknown>,
  text: string,
): string | null {
  const metadata = asRecord(item.metadata);
  const explicitNameCandidates: unknown[] = [
    item.selectedAgentName,
    item.selected_agent_name,
    item.agentName,
    item.agent_name,
    asRecord(item.selectedAgent)?.name,
    asRecord(item.selected_agent)?.name,
    metadata?.selectedAgentName,
    metadata?.selected_agent_name,
    metadata?.agentName,
    metadata?.agent_name,
  ];
  for (const candidate of explicitNameCandidates) {
    const normalized = normalizeSelectedAgentName(candidate);
    if (normalized) {
      return normalized;
    }
  }
  const promptTextCandidates = [text, ...extractRawUserMessageTextCandidates(item)];
  for (const candidate of promptTextCandidates) {
    const extracted = extractSelectedAgentNameFromPromptText(candidate);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

export function extractSelectedAgentIconFromUserMessageItem(
  item: Record<string, unknown>,
  text: string,
): string | null {
  const metadata = asRecord(item.metadata);
  const explicitIconCandidates: unknown[] = [
    item.selectedAgentIcon,
    item.selected_agent_icon,
    item.agentIcon,
    item.agent_icon,
    asRecord(item.selectedAgent)?.icon,
    asRecord(item.selected_agent)?.icon,
    metadata?.selectedAgentIcon,
    metadata?.selected_agent_icon,
    metadata?.agentIcon,
    metadata?.agent_icon,
  ];
  for (const candidate of explicitIconCandidates) {
    const normalized = normalizeAgentIcon(candidate);
    if (normalized) {
      return normalized;
    }
  }
  const promptTextCandidates = [text, ...extractRawUserMessageTextCandidates(item)];
  for (const candidate of promptTextCandidates) {
    const extracted = extractSelectedAgentIconFromPromptText(candidate);
    if (extracted) {
      return extracted;
    }
  }
  return null;
}

export function stripInjectedPrefixLines(text: string): string {
  let normalized = text.trimStart();
  while (TITLE_INJECTED_LINE_PREFIX_REGEX.test(normalized)) {
    normalized = normalized.replace(TITLE_INJECTED_LINE_PREFIX_REGEX, "").trimStart();
  }
  return normalized;
}

export function clipByChars(text: string, maxChars: number): string {
  return Array.from(text).slice(0, maxChars).join("");
}

export function previewThreadName(text: string, fallback: string) {
  const strippedCommandTags = extractCommandMessagePromptText(text);
  const strippedAgentPrompt = stripAgentPromptBlockFromTail(strippedCommandTags);
  const strippedModeFallback = stripModeFallbackBlock(strippedAgentPrompt);
  const strippedMemory = stripInjectedProjectMemoryBlock(strippedModeFallback);
  const strippedSharedSync = stripSharedSessionContextSyncBlock(strippedMemory);
  const extractedUserInput = extractLatestUserInputTextPreserveFormatting(strippedSharedSync);
  const strippedInjectedPrefix = stripInjectedPrefixLines(extractedUserInput);
  const collapsed = strippedInjectedPrefix.replace(/\s+/g, " ").trim();
  // 二次闸：strip 后仍以注入包 / Grok bootstrap 开标签开头 → 不要截成侧栏污染名
  if (
    !collapsed ||
    PROJECT_MEMORY_OPEN_TAG_PREFIX_REGEX.test(collapsed) ||
    GROK_RUNTIME_CONTEXT_OPEN_TAG_PREFIX_REGEX.test(collapsed)
  ) {
    return fallback;
  }
  const clipped = clipByChars(collapsed, MAX_DEFAULT_THREAD_TITLE_CHARS).trim();
  return clipped || fallback;
}

export function normalizeUserMessageText(text: string): string {
  return stripSharedSessionContextSyncBlock(
    stripModeFallbackBlock(stripInjectedProjectMemoryBlock(text)),
  );
}

function collectUserMessageFallbackImages(item: Record<string, unknown>): string[] {
  const collect = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((entry) => {
        if (typeof entry === "string") {
          return entry.trim();
        }
        const record = asRecord(entry);
        if (!record) {
          return "";
        }
        return asString(
          record.url ??
            record.path ??
            record.src ??
            record.image ??
            record.imageUrl ??
            "",
        ).trim();
      })
      .filter(Boolean);
  };

  const direct = collect(item.images);
  if (direct.length > 0) {
    return direct;
  }
  const urlStyle = collect(item.imageUrls);
  if (urlStyle.length > 0) {
    return urlStyle;
  }
  return collect(item.image_urls);
}

export function extractFallbackUserMessagePayload(item: Record<string, unknown>): {
  text: string;
  collaborationMode: "plan" | "code" | null;
  images: string[];
} {
  const contentRecord = asRecord(item.content);
  const rawTextCandidates: unknown[] = [
    item.text,
    item.inputText,
    item.input_text,
    item.prompt,
    item.message,
    typeof item.content === "string" ? item.content : null,
    contentRecord?.text,
    contentRecord?.value,
    contentRecord?.content,
  ];
  const fallbackImages = collectUserMessageFallbackImages(item);
  for (const candidate of rawTextCandidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const normalizedText = normalizeUserMessageText(candidate).trim();
    if (!normalizedText) {
      continue;
    }
    return {
      text: normalizedText,
      collaborationMode: extractModeFallbackMode(candidate),
      images: fallbackImages,
    };
  }
  return { text: "", collaborationMode: null, images: fallbackImages };
}
