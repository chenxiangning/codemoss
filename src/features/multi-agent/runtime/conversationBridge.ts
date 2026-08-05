import type { AgentProjectionV1 } from "../types";

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
  // 兼容旧事件名（历史会话 hydration）
  window.addEventListener("ccgui:squad-conversation-item", handle);
  return () => {
    window.removeEventListener(MULTI_AGENT_CONVERSATION_ITEM_EVENT, handle);
    window.removeEventListener("ccgui:squad-conversation-item", handle);
  };
}

export function emitMultiAgentConversationItems(
  workspaceId: string,
  threadId: string,
  projection: AgentProjectionV1,
): void {
  if (typeof window === "undefined") return;
  const emit = (item: MultiAgentConversationItemDetail["item"]) => {
    window.dispatchEvent(
      new CustomEvent(MULTI_AGENT_CONVERSATION_ITEM_EVENT, {
        detail: { workspaceId, threadId, item },
      }),
    );
  };
  emit({
    id: `agent:${projection.runId}:user`,
    kind: "message",
    role: "user",
    text: projection.requestText,
  });
  // 失败也把诊断写进对话，避免黑盒。
  if (projection.status === "failed") {
    const diagnosticsList = projection.diagnostics ?? [];
    const diagnostics =
      diagnosticsList.length > 0
        ? diagnosticsList.join("\n")
        : "协作失败。";
    emit({
      id: `agent:${projection.runId}:assistant`,
      kind: "message",
      role: "assistant",
      text: `**协作失败**\n\n${diagnostics}`,
    });
    return;
  }
  if (projection.status !== "succeeded") return;
  // 主对话只收短汇总，不 dump 节点全文
  const finalSummary = projection.finalSummary?.trim();
  if (!finalSummary) return;
  emit({
    id: `agent:${projection.runId}:assistant`,
    kind: "message",
    role: "assistant",
    text: finalSummary,
  });
}
