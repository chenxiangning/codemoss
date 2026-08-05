/**
 * Multi-Agent 阶段直播通道。
 * Plan/Execute worker 的正文写入此处，仅供右侧 Inspector 实时渲染。
 * 主卡片只展示生命周期节点，不复读全文。
 */

export type AgentLivePhaseEntry = {
  attemptId: string;
  phase: "plan" | "execute" | "review" | string;
  text: string;
  version: number;
  updatedAt: number;
};

const entriesByScope = new Map<string, AgentLivePhaseEntry>();
const listeners = new Set<() => void>();
const PUBLISH_MS = 48;
let publishTimer: ReturnType<typeof setTimeout> | undefined;
let lastPublishedAt = 0;
let publishedSnapshot = new Map<string, AgentLivePhaseEntry>();

function scopeKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}\u0000${threadId}`;
}

function notify(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[multi-agent livePhase] listener failed", error);
    }
  }
}

function flushPublish(): void {
  publishTimer = undefined;
  publishedSnapshot = new Map(entriesByScope);
  lastPublishedAt = Date.now();
  notify();
}

function schedulePublish(): void {
  const elapsed = Date.now() - lastPublishedAt;
  if (elapsed >= PUBLISH_MS) {
    flushPublish();
    return;
  }
  if (publishTimer !== undefined) return;
  publishTimer = setTimeout(flushPublish, Math.max(0, PUBLISH_MS - elapsed));
}

/**
 * 引擎事件有时是「真 delta」，有时是「累计快照」。
 * 盲目 append 会变成图2那种 writeLet me write / files. 4 files 双重串字。
 */
export function mergeLiveText(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;
  if (incoming === previous) return previous;
  // 累计快照：新文本以旧文本为前缀
  if (incoming.startsWith(previous)) return incoming;
  // 回退/乱序更短快照，忽略
  if (previous.startsWith(incoming)) return previous;
  // 重复下发同一段 delta
  if (previous.endsWith(incoming)) return previous;
  // 新快照覆盖（长度更长且重叠较多）
  if (
    incoming.length > previous.length &&
    previous.length > 24 &&
    incoming.includes(previous.slice(-Math.min(80, previous.length)))
  ) {
    return incoming;
  }
  return previous + incoming;
}

export function beginAgentLivePhase(
  workspaceId: string,
  threadId: string,
  attemptId: string,
  phase: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  entriesByScope.set(key, {
    attemptId,
    phase,
    text: "",
    version: 0,
    updatedAt: Date.now(),
  });
  schedulePublish();
}

export function appendAgentLivePhaseText(
  workspaceId: string,
  threadId: string,
  attemptId: string,
  delta: string,
): void {
  if (!delta) return;
  const key = scopeKey(workspaceId, threadId);
  const current = entriesByScope.get(key);
  if (!current || current.attemptId !== attemptId) {
    entriesByScope.set(key, {
      attemptId,
      phase: current?.phase ?? "plan",
      text: delta,
      version: (current?.version ?? 0) + 1,
      updatedAt: Date.now(),
    });
  } else {
    entriesByScope.set(key, {
      ...current,
      text: mergeLiveText(current.text, delta),
      version: current.version + 1,
      updatedAt: Date.now(),
    });
  }
  schedulePublish();
}

export function setAgentLivePhaseText(
  workspaceId: string,
  threadId: string,
  attemptId: string,
  text: string,
  phase?: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  const current = entriesByScope.get(key);
  entriesByScope.set(key, {
    attemptId,
    phase: phase ?? current?.phase ?? "plan",
    text,
    version: (current?.version ?? 0) + 1,
    updatedAt: Date.now(),
  });
  schedulePublish();
}

export function clearAgentLivePhase(
  workspaceId: string,
  threadId: string,
): void {
  const key = scopeKey(workspaceId, threadId);
  if (!entriesByScope.has(key) && !publishedSnapshot.has(key)) return;
  entriesByScope.delete(key);
  publishedSnapshot = new Map(entriesByScope);
  notify();
}

export function getAgentLivePhase(
  workspaceId: string | null | undefined,
  threadId: string | null | undefined,
): AgentLivePhaseEntry | null {
  if (!workspaceId || !threadId) return null;
  return publishedSnapshot.get(scopeKey(workspaceId, threadId)) ?? null;
}

export function subscribeAgentLivePhase(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 从 realtime payload 抽出可能的正文；调用方用 mergeLiveText 合并。 */
export function extractRealtimeTextDelta(
  method: string,
  params: Record<string, unknown> | null | undefined,
): string {
  if (!params) return "";
  const m = method.toLowerCase();
  const looksTextish =
    m.includes("agentmessage") ||
    m.includes("text") ||
    m.includes("content") ||
    m.includes("message") ||
    m.includes("delta") ||
    m.includes("assistant") ||
    m.includes("stream");
  if (!looksTextish) return "";

  const fromValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.delta === "string") return obj.delta;
    if (typeof obj.partial === "string") return obj.partial;
    if (typeof obj.content === "string") return obj.content;
    if (Array.isArray(obj.content)) {
      return obj.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const p = part as Record<string, unknown>;
            if (typeof p.text === "string") return p.text;
            if (typeof p.content === "string") return p.content;
          }
          return "";
        })
        .join("");
    }
    return "";
  };

  const candidates = [
    params.delta,
    params.text,
    params.content,
    params.partial,
    params.output,
    (params.item as Record<string, unknown> | undefined)?.text,
    (params.item as Record<string, unknown> | undefined)?.content,
    (params.item as Record<string, unknown> | undefined)?.delta,
    (params.message as Record<string, unknown> | undefined)?.content,
    (params.message as Record<string, unknown> | undefined)?.text,
    (params.event as Record<string, unknown> | undefined)?.delta,
    (params.event as Record<string, unknown> | undefined)?.text,
    (params.data as Record<string, unknown> | undefined)?.text,
    (params.data as Record<string, unknown> | undefined)?.delta,
  ];
  for (const value of candidates) {
    const text = fromValue(value);
    if (text) return text;
  }
  return "";
}
