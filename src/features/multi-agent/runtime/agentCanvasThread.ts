/**
 * 协作节点 Inspector 幕布 thread 身份。
 *
 * 与主幕 shared: 隔离：realtime / liveAssistantTextChannel / itemsByThread
 * 都写到 agent-canvas: 键，复用主幕 adapter 与 MessageRow 流式，不污染主时间线。
 */

export const AGENT_CANVAS_THREAD_PREFIX = "agent-canvas:";

export function buildAgentCanvasThreadId(
  sharedThreadId: string,
  attemptId: string,
): string {
  const shared = sharedThreadId.trim();
  const attempt = attemptId.trim();
  if (!shared || !attempt) return "";
  return `${AGENT_CANVAS_THREAD_PREFIX}${shared}:${attempt}`;
}

export function isAgentCanvasThreadId(
  threadId: string | null | undefined,
): boolean {
  return Boolean(threadId?.startsWith(AGENT_CANVAS_THREAD_PREFIX));
}

export function parseAgentCanvasThreadId(
  threadId: string | null | undefined,
): { sharedThreadId: string; attemptId: string } | null {
  if (!isAgentCanvasThreadId(threadId)) return null;
  const rest = threadId!.slice(AGENT_CANVAS_THREAD_PREFIX.length);
  // sharedThreadId 形如 shared:<uuid>，attempt 在最后一个独立 attempt 段
  // 格式：agent-canvas:shared:<uuid>:<attemptId>
  const marker = "shared:";
  const sharedStart = rest.indexOf(marker);
  if (sharedStart < 0) return null;
  const afterShared = rest.slice(sharedStart);
  // shared:uuid:attemptId — uuid 不含冒号以外的结构；attempt 可能含 :
  // 用 shared: 后第一段 uuid + 剩余为 attempt
  const withoutPrefix = afterShared.slice(marker.length);
  const slash = withoutPrefix.indexOf(":");
  if (slash < 0) return null;
  const uuid = withoutPrefix.slice(0, slash).trim();
  const attemptId = withoutPrefix.slice(slash + 1).trim();
  if (!uuid || !attemptId) return null;
  return {
    sharedThreadId: `shared:${uuid}`,
    attemptId,
  };
}
