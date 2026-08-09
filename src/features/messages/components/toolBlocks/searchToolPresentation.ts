/**
 * Search/Grep/Glob 工具块的折叠摘要展示逻辑。
 * 目标：标题行像 Read 工具一样短可读，而不是 dump 协议包装 + 绝对路径。
 */

const QUERY_KEYS = ["query", "q", "searchQuery", "search_query", "text", "pattern"] as const;

const MATCH_COUNT_RULES: Array<{ re: RegExp; atLeast: boolean }> = [
  { re: /Found\s+at\s+least\s+(\d+)\s+matching\s+lines?/i, atLeast: true },
  { re: /Found\s+(\d+)\s+matching\s+lines?/i, atLeast: false },
  { re: /Found\s+at\s+least\s+(\d+)\s+files?/i, atLeast: true },
  { re: /Found\s+(\d+)\s+files?/i, atLeast: false },
  { re: /(\d+)\s+matches?\b/i, atLeast: false },
];

export type SearchMatchCount = {
  count: number;
  atLeast: boolean;
};

export type SearchInlinePresentation = {
  /**
   * 单条工具折叠行主文案（可含 pattern · matches）。
   */
  headerSummary: string;
  /**
   * title 属性用：尽量保留更完整可读信息，仍避免协议噪声。
   */
  headerTitle: string;
  /**
   * 分组行里紧挨 pattern 的结果提示（不含 pattern，避免重复）。
   */
  resultHint: string;
};

export function extractQueryLikeText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = extractQueryLikeText(entry);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of QUERY_KEYS) {
      if (key in record) {
        const found = extractQueryLikeText(record[key]);
        if (found) return found;
      }
    }
  }

  return null;
}

export function extractSearchMatchCount(text: string): SearchMatchCount | null {
  if (!text.trim()) return null;
  for (const rule of MATCH_COUNT_RULES) {
    const match = rule.re.exec(text);
    if (!match?.[1]) continue;
    const count = Number.parseInt(match[1], 10);
    if (!Number.isFinite(count) || count < 0) continue;
    return { count, atLeast: rule.atLeast };
  }
  return null;
}

export type SearchMatchLabelTranslate = (
  key: string,
  options?: { count: number },
) => string;

/**
 * 匹配计数标签。可注入 t；未注入或 t 未加载资源时回退英文，
 * 避免单测 / 无 i18n 环境显示裸 key。
 */
export function formatSearchMatchLabel(
  match: SearchMatchCount,
  t?: SearchMatchLabelTranslate,
): string {
  const fallback = match.atLeast
    ? `≥${match.count} matches`
    : `${match.count} matches`;
  if (!t) return fallback;
  const key = match.atLeast ? "tools.matchCountAtLeast" : "tools.matchCount";
  const translated = t(key, { count: match.count });
  if (!translated || translated === key) return fallback;
  return translated;
}

function stripWorkspaceResultMarkup(text: string): string {
  return text
    .replace(/<\/?workspace_result\b[^>]*>/gi, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function isProtocolHeavySearchOutput(text: string): boolean {
  if (/<\/?workspace_result\b/i.test(text)) return true;
  // 多行 path + 行号 dump（Grep 典型输出）
  if (text.includes("\n") && text.length > 160 && /:\d+:\s/.test(text)) {
    return true;
  }
  return false;
}

function looksLikeUrlSummary(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // 单段 URL，或短文本以 URL 为主
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (trimmed.length <= 160 && /^https?:\/\/\S+/i.test(trimmed) && !trimmed.includes("\n")) {
    return true;
  }
  return false;
}

/**
 * 非 JSON 时尽量清洗协议噪声；JSON 则优先抽出 query 类字段。
 * 保留对 URL / 短可读文本的兼容。
 */
export function normalizeSearchSummaryText(
  raw: string,
  args: unknown,
  t?: SearchMatchLabelTranslate,
): string {
  const trimmedRaw = raw.trim();
  if (trimmedRaw) {
    try {
      const parsed = JSON.parse(trimmedRaw);
      const fromParsed = extractQueryLikeText(parsed);
      if (fromParsed) return fromParsed;
    } catch {
      // raw 不是 JSON
    }

    if (!(trimmedRaw.startsWith("{") || trimmedRaw.startsWith("["))) {
      if (isProtocolHeavySearchOutput(trimmedRaw)) {
        const match = extractSearchMatchCount(trimmedRaw);
        if (match) return formatSearchMatchLabel(match, t);
        // 无计数时不强行从 dump 里抠 token（易得到 "1:" 这类噪声）
        return "";
      }
      return trimmedRaw;
    }
  }

  const fromArgs = extractQueryLikeText(args);
  if (fromArgs) return fromArgs;

  return trimmedRaw;
}

function joinPatternAndHint(pattern: string, hint: string, maxLength: number): string {
  const p = pattern.trim();
  const h = hint.trim();
  if (p && h) {
    const combined = `${p} · ${h}`;
    return truncateForSummary(combined, maxLength);
  }
  return truncateForSummary(p || h, maxLength);
}

function truncateForSummary(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  if (maxLength <= 1) return "…";
  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

/**
 * 统一生成搜索工具折叠摘要。
 * - Grep 类：`pattern · ≥65 matches`
 * - Web 搜索 URL：保留可点击 URL
 * - 协议 dump：不把 workspace_result / 绝对路径塞进标题
 */
export function resolveSearchInlinePresentation(
  raw: string,
  args: unknown,
  options?: {
    maxLength?: number;
    pattern?: string;
    t?: SearchMatchLabelTranslate;
  },
): SearchInlinePresentation {
  const maxLength = options?.maxLength ?? 120;
  const t = options?.t;
  const patternFromOptions = (options?.pattern ?? "").trim();
  const patternFromArgs = extractQueryLikeText(args)?.trim() ?? "";
  const pattern = patternFromOptions || patternFromArgs;

  const trimmedRaw = raw.trim();
  const matchCount = extractSearchMatchCount(trimmedRaw);

  // 1) 有明确匹配计数：优先 pattern · N matches
  if (matchCount) {
    const hint = formatSearchMatchLabel(matchCount, t);
    return {
      headerSummary: joinPatternAndHint(pattern, hint, maxLength),
      headerTitle: pattern ? `${pattern} · ${hint}` : hint,
      resultHint: hint,
    };
  }

  // 2) 协议噪声输出：不要 dump 到标题；有 pattern 就只留 pattern
  if (trimmedRaw && isProtocolHeavySearchOutput(trimmedRaw)) {
    if (pattern) {
      return {
        headerSummary: truncateForSummary(pattern, maxLength),
        headerTitle: pattern,
        resultHint: "",
      };
    }
    const cleaned = normalizeSearchSummaryText(trimmedRaw, args, t);
    const fallback = truncateForSummary(cleaned || stripWorkspaceResultMarkup(trimmedRaw), maxLength);
    return {
      headerSummary: fallback,
      headerTitle: fallback,
      resultHint: fallback,
    };
  }

  // 3) 常规 normalize（JSON query / URL / 短文本）
  const normalized = normalizeSearchSummaryText(trimmedRaw, args, t);
  const collapsed = truncateForSummary(normalized, maxLength);

  // URL 类摘要优先展示链接本身（可点击）
  if (looksLikeUrlSummary(collapsed)) {
    return {
      headerSummary: collapsed,
      headerTitle: pattern && pattern !== collapsed ? `${pattern} · ${normalized}` : normalized,
      resultHint: collapsed,
    };
  }

  // 若 normalize 结果与 pattern 相同，避免分组行重复
  if (pattern && collapsed && collapsed === pattern) {
    return {
      headerSummary: truncateForSummary(pattern, maxLength),
      headerTitle: pattern,
      resultHint: "",
    };
  }

  // 有 pattern 且 normalize 结果像「另一段 query/摘要」时：pattern 优先进 header
  // （兼容旧行为：无 pattern 时直接展示 normalize 结果）
  if (pattern && collapsed && collapsed !== pattern && !trimmedRaw) {
    // output 空、detail 被 normalize 成 query：header 用 query 即可
    return {
      headerSummary: collapsed,
      headerTitle: collapsed,
      resultHint: "",
    };
  }

  if (pattern && collapsed && isProtocolHeavySearchOutput(normalized)) {
    return {
      headerSummary: truncateForSummary(pattern, maxLength),
      headerTitle: pattern,
      resultHint: "",
    };
  }

  // 默认：有可读 output 用 output；否则用 pattern
  if (collapsed) {
    return {
      headerSummary: collapsed,
      headerTitle: normalized || collapsed,
      resultHint: collapsed === pattern ? "" : collapsed,
    };
  }

  if (pattern) {
    return {
      headerSummary: truncateForSummary(pattern, maxLength),
      headerTitle: pattern,
      resultHint: "",
    };
  }

  return {
    headerSummary: "",
    headerTitle: "",
    resultHint: "",
  };
}
