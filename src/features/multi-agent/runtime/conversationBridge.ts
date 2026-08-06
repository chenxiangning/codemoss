import type { AgentProjectionV1 } from "../types";
import { isTerminalAgentStatus } from "../types";
import { formatDurationMs } from "../utils/format";
import { registerHistoryFold } from "../store/historyFoldRegistry";
import { getAgentRoundList } from "../store/agentStore";
import {
  multiAgentHistFoldItemId,
  multiAgentPendingUserItemId,
  multiAgentUserItemId,
} from "../utils/canvasItems";

export const MULTI_AGENT_CONVERSATION_ITEM_EVENT =
  "ccgui:multi-agent-conversation-item";

export type MultiAgentConversationItemDetail = {
  workspaceId: string;
  threadId: string;
  item: {
    id: string;
    kind: "message";
    role: "user" | "assistant";
    text: string;
  };
};

/** 已写入主幕的终态 run，避免 publish 风暴重复 upsert 噪音 */
const emittedTerminalKeys = new Set<string>();
const emittedUserKeys = new Set<string>();
/** 折叠卡消息项：首次 publish 即 emit，出现在 user 消息之后、编排输出之前 */
const emittedFoldKeys = new Set<string>();
/** 折叠卡上次 emit 的 text：相同则跳过 upsert，减少阶段切换时时间线重绘 */
const lastFoldEmitText = new Map<string, string>();
const MAX_EMIT_KEYS = 512;

function rememberKey(set: Set<string>, key: string): boolean {
  if (set.has(key)) return false;
  set.add(key);
  while (set.size > MAX_EMIT_KEYS) {
    const oldest = set.values().next().value;
    if (oldest === undefined) break;
    set.delete(oldest);
  }
  return true;
}

function isDetail(value: unknown): value is MultiAgentConversationItemDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Partial<MultiAgentConversationItemDetail>;
  const item = detail.item as
    | Partial<MultiAgentConversationItemDetail["item"]>
    | undefined;
  return (
    typeof detail.workspaceId === "string" &&
    detail.workspaceId.trim().length > 0 &&
    typeof detail.threadId === "string" &&
    detail.threadId.startsWith("shared:") &&
    item?.kind === "message" &&
    typeof item.id === "string" &&
    (item.id.startsWith("squad:") || item.id.startsWith("agent:")) &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.text === "string" &&
    item.text.trim().length > 0
  );
}

export function subscribeMultiAgentConversationItems(
  listener: (detail: MultiAgentConversationItemDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isDetail(detail)) listener(detail);
  };
  window.addEventListener(MULTI_AGENT_CONVERSATION_ITEM_EVENT, handle);
  window.addEventListener("ccgui:squad-conversation-item", handle);
  return () => {
    window.removeEventListener(MULTI_AGENT_CONVERSATION_ITEM_EVENT, handle);
    window.removeEventListener("ccgui:squad-conversation-item", handle);
  };
}

function emitItem(
  workspaceId: string,
  threadId: string,
  item: MultiAgentConversationItemDetail["item"],
): void {
  window.dispatchEvent(
    new CustomEvent(MULTI_AGENT_CONVERSATION_ITEM_EVENT, {
      detail: { workspaceId, threadId, item },
    }),
  );
}

function statusLabelZh(status: string): string {
  switch (status) {
    case "succeeded":
      return "已完成";
    case "cancelled":
      return "已取消";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function isReplanCancel(projection: AgentProjectionV1): boolean {
  return (projection.diagnostics ?? []).some(
    (d) =>
      d.includes("reject replan") ||
      d.includes("打回重规划") ||
      d.includes("reject-replan"),
  );
}

/** 计算当前 run 在 roundList 中的 index，用于 registerHistoryFold 的 roundIndex */
function projectRoundIndex(
  workspaceId: string,
  threadId: string,
  runId: string,
): number {
  const rounds = getAgentRoundList(workspaceId, threadId);
  const idx = rounds.findIndex((r) => r.runId === runId);
  return idx >= 0 ? idx : Math.max(0, rounds.length - 1);
}

/**
 * 终态写入主幕的轻量锚点（图3 一行摘要风格）。
 * 详细展开在左栏 HistoryFold / 右栏 Messages 幕布，避免把全文倾倒进时间线。
 */
export function formatTerminalOrchMarkdown(
  projection: AgentProjectionV1,
): string {
  const stages = projection.stages ?? [];
  const done = stages.filter((s) => s.status === "succeeded").length;
  const first = stages[0]?.startedAt;
  const last = stages[stages.length - 1]?.settledAt;
  const dur = formatDurationMs(first, last) ?? "—";
  const title = projection.requestText.trim().slice(0, 42) || "协作编排";
  const mark =
    projection.status === "succeeded"
      ? "✓"
      : projection.status === "failed"
        ? "✗"
        : "○";
  // 精确轮次 UI 由 HistoryFold 承担；主幕只留轻量锚点，避免长文倾倒
  const lines = [
    `${mark} **协作 · ${title}**`,
    `${statusLabelZh(projection.status)} · ${done}/${stages.length || 0} 完成 · ${dur}`,
  ];
  const summary = projection.finalSummary?.trim();
  if (summary && projection.status === "succeeded") {
    const oneLine = summary.replace(/\s+/g, " ").slice(0, 100);
    lines.push(oneLine + (summary.length > 100 ? "…" : ""));
  }
  return lines.join("\n");
}

/**
 * 协作一点击发送就立刻上屏的干净用户气泡（仅用户原文，无调度指令）。
 * run 尚未创建时用 pending id；后续 filter 会与正式 squad:run:user 按文案去重。
 */
export function emitCollabVisibleUserMessage(
  workspaceId: string,
  threadId: string,
  text: string,
  nonce?: string,
): void {
  if (typeof window === "undefined") return;
  const body = text.trim();
  if (!body) return;
  const key = `${workspaceId}\0${threadId}\0visible-user\0${body}`;
  if (!rememberKey(emittedUserKeys, key)) return;
  emitItem(workspaceId, threadId, {
    id: multiAgentPendingUserItemId(nonce ?? String(Date.now())),
    kind: "message",
    role: "user",
    text: body,
  });
}

/**
 * 主幕短状态（调度确认 / 阶段切换），不进 durable shared 用户历史，避免污染后续普通 CLI。
 */
export function emitCollabStatusAssistantMessage(
  workspaceId: string,
  threadId: string,
  statusId: string,
  text: string,
): void {
  if (typeof window === "undefined") return;
  const body = text.trim();
  if (!body || !statusId.trim()) return;
  emitItem(workspaceId, threadId, {
    id: `agent:collab-status:${statusId}`,
    kind: "message",
    role: "assistant",
    text: body,
  });
}

export function emitMultiAgentConversationItems(
  workspaceId: string,
  threadId: string,
  projection: AgentProjectionV1,
): void {
  if (typeof window === "undefined") return;

  // ① 用户消息：干净原文；与 pending 气泡同文案时由 filter 去重
  const userKey = `${workspaceId}\0${threadId}\0${projection.runId}\0user`;
  if (rememberKey(emittedUserKeys, userKey) && projection.requestText.trim()) {
    emitItem(workspaceId, threadId, {
      id: multiAgentUserItemId(projection.runId),
      kind: "message",
      role: "user",
      text: projection.requestText,
    });
  }

  // ② 折叠卡：registry 始终刷新；text 未变则不 emit，避免阶段切换无 upsert 卡顿
  const foldKey = `${workspaceId}\0${threadId}\0${projection.runId}\0fold`;
  const foldItemId = multiAgentHistFoldItemId(projection.runId);
  const roundIndex = projectRoundIndex(workspaceId, threadId, projection.runId);
  const foldText = formatTerminalOrchMarkdown(projection);
  registerHistoryFold({
    workspaceId,
    threadId,
    runId: projection.runId,
    roundIndex,
    projection,
  });
  const firstFold = rememberKey(emittedFoldKeys, foldKey);
  const prevFoldText = lastFoldEmitText.get(foldItemId);
  if (firstFold || prevFoldText !== foldText) {
    lastFoldEmitText.set(foldItemId, foldText);
    emitItem(workspaceId, threadId, {
      id: foldItemId,
      kind: "message",
      role: "assistant",
      text: foldText,
    });
  }

  // ③ 终态附加消息（取消提示等）
  if (!isTerminalAgentStatus(projection.status)) return;

  const terminalKey = `${workspaceId}\0${threadId}\0${projection.runId}\0${projection.status}`;
  if (!rememberKey(emittedTerminalKeys, terminalKey)) return;

  // 打回重规划：不刷终态卡，由 replan 事件接叙事
  if (projection.status === "cancelled" && isReplanCancel(projection)) {
    return;
  }

  if (projection.status === "cancelled") {
    emitItem(workspaceId, threadId, {
      id: `agent:${projection.runId}:assistant-cancel`,
      kind: "message",
      role: "assistant",
      text: "协作已停止。修改需求后，可再次开启协作继续。",
    });
  }
}

/** 打回重规划：主幕线性事件（中文、克制） */
export function emitReplanConversationItems(
  workspaceId: string,
  threadId: string,
  runId: string,
  requestText: string,
  replanNote?: string,
): void {
  if (typeof window === "undefined") return;
  const note = replanNote?.trim() ?? "";
  const excerpt = requestText.trim().slice(0, 160);
  emitItem(workspaceId, threadId, {
    id: `agent:${runId}:replan-user`,
    kind: "message",
    role: "user",
    text: note ? `打回重规划\n\n补充：${note}` : "打回重规划",
  });
  const ackBody = note
    ? `已打回。将按原任务 + 你的补充重新规划：\n\n> ${excerpt}${requestText.trim().length > 160 ? "…" : ""}`
    : excerpt
      ? `已打回。将按原任务重新规划：\n\n> ${excerpt}${requestText.trim().length > 160 ? "…" : ""}`
      : "已打回。将按原任务重新规划。";
  emitItem(workspaceId, threadId, {
    id: `agent:${runId}:replan-ack`,
    kind: "message",
    role: "assistant",
    text: ackBody,
  });
}
