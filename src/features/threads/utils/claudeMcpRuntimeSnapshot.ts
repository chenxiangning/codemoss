type ClaudeMcpServerSnapshot = {
  name: string;
  status: string | null;
};

export type ClaudeMcpRuntimeSnapshot = {
  workspaceId: string;
  sessionId: string | null;
  tools: string[];
  mcpServers: ClaudeMcpServerSnapshot[];
  capturedAt: number;
};

type ClaudeMcpAliasRewriteResult = {
  text: string;
  aliasMentioned: boolean;
  applied: boolean;
  fromServer: string;
  toServer: string;
  diagnostics: string[];
};

type PendingClaudeMcpOutputNotice = {
  notice: string;
  streamed: boolean;
};

const SNAPSHOT_BY_WORKSPACE = new Map<string, ClaudeMcpRuntimeSnapshot>();
const PENDING_OUTPUT_NOTICE_BY_THREAD = new Map<string, PendingClaudeMcpOutputNotice>();
const PLAYWRIGHT_SERVER = "playwright-mcp";
const CHROME_DEVTOOLS_SERVER = "chrome-devtools";
const PLAYWRIGHT_ALIAS_PATTERN = /playwright[\s_-]*mcp/gi;

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTools(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const tools: string[] = [];
  for (const entry of raw) {
    const tool = toNonEmptyString(entry);
    if (!tool || seen.has(tool)) {
      continue;
    }
    seen.add(tool);
    tools.push(tool);
  }
  return tools;
}

function normalizeServers(raw: unknown): ClaudeMcpServerSnapshot[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const servers: ClaudeMcpServerSnapshot[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const name = toNonEmptyString(record.name);
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    servers.push({
      name,
      status: toNonEmptyString(record.status),
    });
  }
  return servers;
}

function hasMcpToolPrefix(snapshot: ClaudeMcpRuntimeSnapshot, serverName: string): boolean {
  const prefix = `mcp__${serverName}__`;
  return snapshot.tools.some((toolName) => toolName.startsWith(prefix));
}

function hasConnectedServer(snapshot: ClaudeMcpRuntimeSnapshot, serverName: string): boolean {
  return snapshot.mcpServers.some((entry) => {
    if (entry.name !== serverName) {
      return false;
    }
    return entry.status !== "failed";
  });
}

function hasRuntimeServer(snapshot: ClaudeMcpRuntimeSnapshot, serverName: string): boolean {
  return hasMcpToolPrefix(snapshot, serverName) || hasConnectedServer(snapshot, serverName);
}

function renderServerList(snapshot: ClaudeMcpRuntimeSnapshot): string {
  if (snapshot.mcpServers.length === 0) {
    return "none";
  }
  return snapshot.mcpServers
    .map((entry) => `${entry.name}${entry.status ? `(${entry.status})` : ""}`)
    .join(", ");
}

function makeThreadNoticeKey(workspaceId: string, threadId: string) {
  return `${workspaceId}\u0000${threadId}`;
}

function splitThreadNoticeKey(key: string): [workspaceId: string, threadId: string] {
  const separatorIndex = key.indexOf("\u0000");
  if (separatorIndex < 0) {
    return ["", ""];
  }
  return [key.slice(0, separatorIndex), key.slice(separatorIndex + 1)];
}

function resolveExistingThreadNoticeKey(workspaceId: string, threadId: string) {
  const exactKey = makeThreadNoticeKey(workspaceId, threadId);
  if (PENDING_OUTPUT_NOTICE_BY_THREAD.has(exactKey)) {
    return exactKey;
  }
  if (!threadId.startsWith("claude:")) {
    return null;
  }
  let matchedPendingKey: string | null = null;
  for (const key of PENDING_OUTPUT_NOTICE_BY_THREAD.keys()) {
    const [keyWorkspaceId, keyThreadId] = splitThreadNoticeKey(key);
    if (keyWorkspaceId !== workspaceId || !keyThreadId.startsWith("claude-pending-")) {
      continue;
    }
    if (matchedPendingKey) {
      // Ambiguous pending mapping; avoid applying wrong notice.
      return null;
    }
    matchedPendingKey = key;
  }
  return matchedPendingKey;
}

function startsWithNotice(text: string, notice: string) {
  return text.trimStart().startsWith(notice);
}

function prependNotice(text: string, notice: string) {
  if (!text) {
    return notice;
  }
  if (startsWithNotice(text, notice)) {
    return text;
  }
  return `${notice}\n\n${text}`;
}

export function captureClaudeMcpRuntimeSnapshotFromRaw(
  workspaceId: string,
  params: Record<string, unknown>,
): ClaudeMcpRuntimeSnapshot | null {
  const subtype = toNonEmptyString(params.subtype)?.toLowerCase();
  const tools = normalizeTools(params.tools);
  const mcpServers = normalizeServers(params.mcp_servers ?? params.mcpServers);
  const isInitLikePayload =
    subtype === "init" || tools.length > 0 || mcpServers.length > 0;
  if (!isInitLikePayload) {
    return null;
  }
  const snapshot: ClaudeMcpRuntimeSnapshot = {
    workspaceId,
    sessionId: toNonEmptyString(params.session_id ?? params.sessionId),
    tools,
    mcpServers,
    capturedAt: Date.now(),
  };
  SNAPSHOT_BY_WORKSPACE.set(workspaceId, snapshot);
  return snapshot;
}

export function getClaudeMcpRuntimeSnapshot(
  workspaceId: string,
): ClaudeMcpRuntimeSnapshot | null {
  return SNAPSHOT_BY_WORKSPACE.get(workspaceId) ?? null;
}

export function setPendingClaudeMcpOutputNotice(
  workspaceId: string,
  threadId: string,
  notice: string | null,
) {
  if (!workspaceId || !threadId) {
    return;
  }
  const key = makeThreadNoticeKey(workspaceId, threadId);
  const normalized = typeof notice === "string" ? notice.trim() : "";
  if (!normalized) {
    PENDING_OUTPUT_NOTICE_BY_THREAD.delete(key);
    return;
  }
  PENDING_OUTPUT_NOTICE_BY_THREAD.set(key, {
    notice: normalized,
    streamed: false,
  });
}

export function clearPendingClaudeMcpOutputNotice(
  workspaceId: string,
  threadId: string,
) {
  if (!workspaceId || !threadId) {
    return;
  }
  const key = makeThreadNoticeKey(workspaceId, threadId);
  PENDING_OUTPUT_NOTICE_BY_THREAD.delete(key);
}

export function applyPendingClaudeMcpOutputNoticeToAgentDelta(
  workspaceId: string,
  threadId: string,
  delta: string,
) {
  if (!workspaceId || !threadId) {
    return delta;
  }
  const key = resolveExistingThreadNoticeKey(workspaceId, threadId);
  if (!key) {
    return delta;
  }
  const pending = PENDING_OUTPUT_NOTICE_BY_THREAD.get(key);
  if (!pending) {
    return delta;
  }
  if (pending.streamed || !delta.trim()) {
    return delta;
  }
  PENDING_OUTPUT_NOTICE_BY_THREAD.set(key, {
    notice: pending.notice,
    streamed: true,
  });
  return prependNotice(delta, pending.notice);
}

export function applyPendingClaudeMcpOutputNoticeToAgentCompleted(
  workspaceId: string,
  threadId: string,
  completedText: string,
) {
  if (!workspaceId || !threadId) {
    return completedText;
  }
  const key = resolveExistingThreadNoticeKey(workspaceId, threadId);
  if (!key) {
    return completedText;
  }
  const pending = PENDING_OUTPUT_NOTICE_BY_THREAD.get(key);
  if (!pending) {
    return completedText;
  }
  PENDING_OUTPUT_NOTICE_BY_THREAD.delete(key);
  return prependNotice(completedText, pending.notice);
}

export function rewriteClaudePlaywrightAlias(
  workspaceId: string,
  text: string,
): ClaudeMcpAliasRewriteResult {
  const snapshot = getClaudeMcpRuntimeSnapshot(workspaceId);
  const aliasMentioned = PLAYWRIGHT_ALIAS_PATTERN.test(text);
  PLAYWRIGHT_ALIAS_PATTERN.lastIndex = 0;
  if (!aliasMentioned) {
    return {
      text,
      aliasMentioned: false,
      applied: false,
      fromServer: PLAYWRIGHT_SERVER,
      toServer: CHROME_DEVTOOLS_SERVER,
      diagnostics: [],
    };
  }

  const diagnostics: string[] = [];
  if (!snapshot) {
    diagnostics.push(
      "MCP 诊断: 当前尚未拿到 Claude init.tools 快照，无法确认 playwright-mcp 可见性。",
    );
    return {
      text,
      aliasMentioned,
      applied: false,
      fromServer: PLAYWRIGHT_SERVER,
      toServer: CHROME_DEVTOOLS_SERVER,
      diagnostics,
    };
  }

  const hasPlaywright = hasRuntimeServer(snapshot, PLAYWRIGHT_SERVER);
  const hasChromeDevtools = hasRuntimeServer(snapshot, CHROME_DEVTOOLS_SERVER);
  diagnostics.push(
    `MCP 快照: tools=${snapshot.tools.length}, servers=${renderServerList(snapshot)}`,
  );
  if (hasPlaywright || !hasChromeDevtools) {
    if (!hasPlaywright) {
      diagnostics.push(
        "MCP 诊断: 快照未发现 playwright-mcp，且也未发现可用的 chrome-devtools，模型可能回退到 webfetch/curl。",
      );
    }
    return {
      text,
      aliasMentioned,
      applied: false,
      fromServer: PLAYWRIGHT_SERVER,
      toServer: CHROME_DEVTOOLS_SERVER,
      diagnostics,
    };
  }

  const rewrittenText = text.replace(PLAYWRIGHT_ALIAS_PATTERN, CHROME_DEVTOOLS_SERVER);
  diagnostics.push(
    "MCP 路由: 快照未发现 playwright-mcp，但存在 chrome-devtools，已自动映射到可用 MCP server。",
  );
  return {
    text: rewrittenText,
    aliasMentioned,
    applied: rewrittenText !== text,
    fromServer: PLAYWRIGHT_SERVER,
    toServer: CHROME_DEVTOOLS_SERVER,
    diagnostics,
  };
}
