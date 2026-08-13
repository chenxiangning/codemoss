import type { ThreadSummary } from "../../../types";
import {
  classifyContextProtocolText,
  isMossxProgramControlTitle,
} from "../../../utils/contextProtocol";

const GENERIC_SESSION_TITLE_PATTERN =
  /^(codex session|claude session|gemini session|opencode session|grok session|kimi session)$/i;
const ORDINAL_AGENT_TITLE_PATTERN = /^agent\s+\d+$/i;
const SHORT_HEX_TITLE_PATTERN = /^[a-f0-9]{4,8}$/i;
// 历史遗留:斜杠命令原始记录曾被直接剪成标题(如 "<command-m"),视为无效标题
const COMMAND_TAG_TITLE_PATTERN = /^<(?:command-|local-command-)/i;
// 记忆注入 pack 残片（含 engine firstMessage 截断后的半截 open tag）
const PROJECT_MEMORY_TAG_TITLE_PATTERN = /^<project-memory(?:-pack)?\b/i;
// Grok CLI bootstrap 信封污染（user_info + rules 等截成侧栏名）
const GROK_RUNTIME_CONTEXT_TAG_TITLE_PATTERN =
  /^<(?:user_info|rules|git_status|system-reminder|open_and_recently_viewed_files|agent_skills|mcp_servers|image_compression_notice)\b/i;

type SessionDisplayTitleStrength = 0 | 1 | 2;

export type SessionDisplayTitleSources = {
  mappedTitle?: string;
  customTitle?: string;
  nativeTitle?: string;
};

export function normalizeSessionDisplayTitle(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isWeakSessionDisplayTitle(value: string | null | undefined): boolean {
  return getSessionDisplayTitleStrength(value) < 2;
}

/**
 * 过滤不可展示的 native/firstMessage 残片（记忆注入包、命令 tag、MOSSX 控制串）。
 * Agent N / Claude Session 等 weak 展示名仍保留（引擎原生列表需要）。
 */
export function sanitizeNativeSessionTitle(
  value: string | null | undefined,
): string {
  const normalized = normalizeSessionDisplayTitle(value);
  if (!normalized) {
    return "";
  }
  if (
    PROJECT_MEMORY_TAG_TITLE_PATTERN.test(normalized) ||
    GROK_RUNTIME_CONTEXT_TAG_TITLE_PATTERN.test(normalized) ||
    COMMAND_TAG_TITLE_PATTERN.test(normalized) ||
    isMossxProgramControlTitle(normalized) ||
    classifyContextProtocolText(normalized) !== null
  ) {
    return "";
  }
  return normalized;
}

function getSessionDisplayTitleStrength(
  value: string | null | undefined,
): SessionDisplayTitleStrength {
  const normalized = normalizeSessionDisplayTitle(value);
  if (
    !normalized
    || ORDINAL_AGENT_TITLE_PATTERN.test(normalized)
    || SHORT_HEX_TITLE_PATTERN.test(normalized)
    || COMMAND_TAG_TITLE_PATTERN.test(normalized)
    || PROJECT_MEMORY_TAG_TITLE_PATTERN.test(normalized)
    || GROK_RUNTIME_CONTEXT_TAG_TITLE_PATTERN.test(normalized)
    || isMossxProgramControlTitle(normalized)
    || classifyContextProtocolText(normalized) !== null
  ) {
    return 0;
  }
  if (GENERIC_SESSION_TITLE_PATTERN.test(normalized)) {
    return 1;
  }
  return 2;
}

export function selectProjectedSessionDisplayName(
  params: {
    previous?: ThreadSummary;
    nextName: string;
  } & SessionDisplayTitleSources,
): string {
  // Central title resolver: explicit user naming wins over mapped/native
  // evidence, and weak fallbacks cannot erase a meaningful previous title.
  const customTitle = normalizeSessionDisplayTitle(params.customTitle);
  if (customTitle) {
    return customTitle;
  }

  const rawMappedTitle = normalizeSessionDisplayTitle(params.mappedTitle);
  // 丢弃 control-plane mapped title（含截断后的 MOSSX_* 半截）
  const mappedTitle =
    !isMossxProgramControlTitle(rawMappedTitle) &&
    classifyContextProtocolText(rawMappedTitle) === null
      ? rawMappedTitle
      : "";
  if (mappedTitle) {
    return mappedTitle;
  }

  // nativeTitle 权威，但注入包残片 / 协议控制串不可当 native 名（会盖掉「你好」）
  const nativeTitle = sanitizeNativeSessionTitle(params.nativeTitle);
  if (nativeTitle) {
    return nativeTitle;
  }

  const nextName = normalizeSessionDisplayTitle(params.nextName);
  if (
    params.previous &&
    getSessionDisplayTitleStrength(params.previous.name) >
      getSessionDisplayTitleStrength(nextName)
  ) {
    return params.previous.name;
  }
  // 注入包 / Grok bootstrap 残片不能落成侧栏名（无 previous 时回退空，由调用方 fallback）
  if (
    PROJECT_MEMORY_TAG_TITLE_PATTERN.test(nextName) ||
    GROK_RUNTIME_CONTEXT_TAG_TITLE_PATTERN.test(nextName)
  ) {
    const previousName = normalizeSessionDisplayTitle(params.previous?.name);
    if (
      previousName &&
      !PROJECT_MEMORY_TAG_TITLE_PATTERN.test(previousName) &&
      !GROK_RUNTIME_CONTEXT_TAG_TITLE_PATTERN.test(previousName)
    ) {
      return previousName;
    }
    return "";
  }

  return nextName;
}

export function mergeSessionDisplaySummary(
  previous: ThreadSummary | undefined,
  next: ThreadSummary,
  options: SessionDisplayTitleSources = {},
): ThreadSummary {
  if (!previous || previous.id !== next.id) {
    const projectedName = selectProjectedSessionDisplayName({
      nextName: next.name,
      mappedTitle: options.mappedTitle,
      customTitle: options.customTitle,
      nativeTitle: options.nativeTitle,
    });
    return projectedName === next.name ? next : { ...next, name: projectedName };
  }

  const engineSource = next.engineSource ?? previous.engineSource;
  return {
    ...previous,
    ...next,
    engineSource,
    name: selectProjectedSessionDisplayName({
      previous,
      nextName: next.name,
      mappedTitle: options.mappedTitle,
      customTitle: options.customTitle,
      nativeTitle: options.nativeTitle,
    }),
    parentThreadId: next.parentThreadId ?? previous.parentThreadId ?? null,
    folderId: next.folderId ?? previous.folderId ?? null,
    autoSession: next.autoSession ?? previous.autoSession ?? null,
  };
}

export function projectSessionDisplaySummaries(params: {
  baseSummaries: ThreadSummary[];
  candidateSummaries: ThreadSummary[];
  excludedThreadIds?: ReadonlySet<string>;
  canRetainCandidate?: (summary: ThreadSummary) => boolean;
  mergeOlderCandidates?: boolean;
}): ThreadSummary[] {
  const {
    baseSummaries,
    candidateSummaries,
    excludedThreadIds = new Set<string>(),
    canRetainCandidate = () => true,
    mergeOlderCandidates = false,
  } = params;
  const mergedById = new Map<string, ThreadSummary>();
  baseSummaries.forEach((entry) => {
    if (!excludedThreadIds.has(entry.id)) {
      mergedById.set(entry.id, entry);
    }
  });

  candidateSummaries.forEach((candidate) => {
    if (excludedThreadIds.has(candidate.id) || !canRetainCandidate(candidate)) {
      return;
    }
    const previous = mergedById.get(candidate.id);
    if (previous && candidate.updatedAt < previous.updatedAt) {
      if (!mergeOlderCandidates) {
        return;
      }
      mergedById.set(candidate.id, mergeSessionDisplaySummary(candidate, previous));
      return;
    }
    mergedById.set(candidate.id, mergeSessionDisplaySummary(previous, candidate));
  });

  return Array.from(mergedById.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
}
