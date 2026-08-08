import type { ConversationItem } from "../../../types";

/**
 * 将合成/失败回退文本尽量整理成 Messages 可用的 user+assistant 消息，
 * 避免 Shared Codex 详情只显示「交付报告」元数据块（与 Grok 会话幕布不一致）。
 */
export function buildTranscriptItemsFromSubagentFallback(input: {
  cardId: string;
  description?: string | null;
  outputText?: string | null;
}): ConversationItem[] {
  const raw = (input.outputText ?? "").trim();
  const description = (input.description ?? "").trim();
  if (!raw && !description) {
    return [];
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metaLine = (line: string) =>
    /^(subagent(\s+completed|\s+started)?|subagent_id\s*[:=]|type\s*[:=]|description\s*[:=]|status\s*[:=]|agentId\s*[:=]|output_file\s*[:=]|use get_command)/i.test(
      line,
    );

  // 历史 tool 信封（_input/_output JSON）不当成可读 assistant 正文
  const looksLikeToolEnvelope =
    /"_input"\s*:/.test(raw) ||
    /"_output"\s*:/.test(raw) ||
    (/^\s*\{/.test(raw) && /"subagent_type"\s*:/.test(raw) && /"prompt"\s*:/.test(raw));

  // 从 JSON 信封里尽量抽出可读 prompt / _output 正文
  let envelopeAssistant = "";
  let envelopeUser = description;
  if (looksLikeToolEnvelope) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const input =
        parsed._input && typeof parsed._input === "object" && parsed._input !== null
          ? (parsed._input as Record<string, unknown>)
          : parsed;
      if (typeof input.prompt === "string" && input.prompt.trim()) {
        envelopeUser = input.prompt.trim();
      } else if (typeof input.description === "string" && input.description.trim()) {
        envelopeUser = input.description.trim();
      }
      if (typeof parsed._output === "string" && parsed._output.trim()) {
        const outLines = parsed._output
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !metaLine(line));
        envelopeAssistant = outLines.join("\n").trim();
      }
    } catch {
      // 非严格 JSON 时仍过滤 meta 行
    }
  }

  const bodyLines = looksLikeToolEnvelope
    ? []
    : lines.filter((line) => !metaLine(line));
  const descFromMeta =
    envelopeUser ||
    lines
      .map((line) => /description\s*[:=]\s*(.+)/i.exec(line)?.[1]?.trim())
      .find(Boolean) ||
    description;

  const assistantText = (envelopeAssistant || bodyLines.join("\n")).trim();
  const items: ConversationItem[] = [];
  const baseId = input.cardId || "subagent-fallback";

  if (descFromMeta) {
    items.push({
      id: `${baseId}:user`,
      kind: "message",
      role: "user",
      text: descFromMeta,
    });
  }
  if (assistantText) {
    items.push({
      id: `${baseId}:assistant`,
      kind: "message",
      role: "assistant",
      text: assistantText,
      isFinal: true,
    });
  }

  // 若整段都是 meta 且没有正文，不生成假消息
  if (items.length === 0 && description) {
    items.push({
      id: `${baseId}:user`,
      kind: "message",
      role: "user",
      text: description,
    });
  }

  return items;
}

/** 可见的 assistant 正文（非空 message） */
export function conversationHasAssistantReply(
  items: readonly ConversationItem[],
): boolean {
  return items.some(
    (item) =>
      item.kind === "message" &&
      item.role === "assistant" &&
      typeof item.text === "string" &&
      item.text.trim().length > 0,
  );
}

function isMetaOnlySubagentText(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return true;
  return lines.every((line) =>
    /^(subagent(\s+completed|\s+started)?|subagent_id\s*[:=]|type\s*[:=]|description\s*[:=]|status\s*[:=]|agentId\s*[:=]|output_file\s*[:=]|use get_command|async agent launched)/i.test(
      line,
    ),
  );
}

/**
 * 从父会话 tool 结果中抽取该子代理的可读回复。
 * Grok 等常把子代理结果回写到父线 get_command_or_subagent_output，子会话历史只有 user prompt。
 */
export function extractSubagentAssistantFromParentItems(
  parentItems: readonly ConversationItem[] | null | undefined,
  agentKeys: readonly string[],
): string | null {
  if (!parentItems?.length || agentKeys.length === 0) {
    return null;
  }
  const keys = agentKeys.map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return null;

  const matchesKey = (hay: string) =>
    keys.some((key) => {
      if (!key) return false;
      if (hay.includes(key)) return true;
      // grok:uuid / bare uuid
      const bare = key.includes(":") ? (key.split(":").pop() ?? key) : key;
      return bare.length >= 8 && hay.includes(bare);
    });

  // 从后往前：最近的 get_command / 带 subagent 结果的 tool 优先
  for (let i = parentItems.length - 1; i >= 0; i -= 1) {
    const item = parentItems[i];
    if (!item || item.kind !== "tool") continue;
    const title = typeof item.title === "string" ? item.title.toLowerCase() : "";
    const toolType =
      typeof item.toolType === "string" ? item.toolType.toLowerCase() : "";
    const isPoller =
      title.includes("get_command_or_subagent") ||
      toolType.includes("get_command_or_subagent") ||
      title.includes("subagent_output") ||
      toolType.includes("subagent_output");
    const detail = typeof item.detail === "string" ? item.detail : "";
    const output = typeof item.output === "string" ? item.output : "";
    const hay = `${detail}\n${output}`;
    if (!matchesKey(hay) && !isPoller) {
      continue;
    }
    if (isPoller && !matchesKey(hay) && !matchesKey(detail)) {
      // poller 但 task_ids 不匹配则跳过
      continue;
    }
    if (!isPoller && !matchesKey(hay)) {
      continue;
    }
    const body = output.trim() || detail.trim();
    if (!body || isMetaOnlySubagentText(body) || isOpaqueCiphertextOutput(body)) {
      continue;
    }
    // 去掉纯 meta 行
    const cleaned = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !/^(subagent(\s+completed|\s+started)?|subagent_id\s*[:=]|type\s*[:=]|status\s*[:=]|use get_command)/i.test(
            line,
          ),
      )
      .join("\n")
      .trim();
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return null;
}

/**
 * 子会话 transcript 缺 assistant 时，把补充正文接到末尾。
 */
export function appendAssistantReplyIfMissing(
  items: readonly ConversationItem[],
  assistantText: string | null | undefined,
  cardId: string,
): ConversationItem[] {
  const text = (assistantText ?? "").trim();
  if (!text || conversationHasAssistantReply(items)) {
    return [...items];
  }
  return [
    ...items,
    {
      id: `${cardId || "subagent"}:assistant-supplement`,
      kind: "message",
      role: "assistant",
      text,
      isFinal: true,
    },
  ];
}

/** 是否是我们合成的 subagent 元数据块（不应原样当交付报告） */
export function isSyntheticSubagentMetaOutput(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) {
    return false;
  }
  return (
    /^Subagent (completed|started)/i.test(raw) &&
    /subagent_id\s*[:=]/i.test(raw) &&
    /status\s*[:=]/i.test(raw)
  );
}

/** Codex 官方加密 message / 无意义 token，禁止当交付报告 */
export function isOpaqueCiphertextOutput(text: string | null | undefined): boolean {
  const raw = (text ?? "").trim();
  if (!raw) {
    return false;
  }
  if (raw.startsWith("gAAAAA")) {
    return true;
  }
  if (
    raw.length >= 64 &&
    !/\s/.test(raw) &&
    !/[\u4e00-\u9fff]/.test(raw) &&
    /^[A-Za-z0-9+/=_:-]+$/.test(raw)
  ) {
    return true;
  }
  return false;
}
