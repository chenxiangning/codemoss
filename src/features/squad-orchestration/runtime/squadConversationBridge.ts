import type { SquadProjectionV1 } from "../types";

export const SQUAD_CONVERSATION_ITEM_EVENT =
  "ccgui:squad-conversation-item";

export type SquadConversationItemDetail = {
  workspaceId: string;
  threadId: string;
  item: {
    id: string;
    kind: "message";
    role: "user" | "assistant";
    text: string;
  };
};

function isDetail(value: unknown): value is SquadConversationItemDetail {
  if (!value || typeof value !== "object") return false;
  const detail = value as Partial<SquadConversationItemDetail>;
  const item = detail.item as
    | Partial<SquadConversationItemDetail["item"]>
    | undefined;
  return (
    typeof detail.workspaceId === "string" &&
    detail.workspaceId.trim().length > 0 &&
    typeof detail.threadId === "string" &&
    detail.threadId.startsWith("shared:") &&
    item?.kind === "message" &&
    typeof item.id === "string" &&
    item.id.startsWith("squad:") &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.text === "string" &&
    item.text.trim().length > 0
  );
}

export function subscribeSquadConversationItems(
  listener: (detail: SquadConversationItemDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isDetail(detail)) listener(detail);
  };
  window.addEventListener(SQUAD_CONVERSATION_ITEM_EVENT, handle);
  return () => window.removeEventListener(SQUAD_CONVERSATION_ITEM_EVENT, handle);
}

function emit(detail: SquadConversationItemDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SquadConversationItemDetail>(
      SQUAD_CONVERSATION_ITEM_EVENT,
      { detail },
    ),
  );
}

export function emitSquadConversationItems(
  workspaceId: string,
  threadId: string,
  projection: SquadProjectionV1,
): void {
  emit({
    workspaceId,
    threadId,
    item: {
      id: `squad:${projection.runId}:user`,
      kind: "message",
      role: "user",
      text: projection.requestText,
    },
  });
  if (projection.status !== "succeeded" || !projection.plan) return;
  const finalSummary = projection.nodes
    .find((node) => node.node.id === projection.plan?.finalNodeId)
    ?.outcome?.summary.trim();
  if (!finalSummary) return;
  emit({
    workspaceId,
    threadId,
    item: {
      id: `squad:${projection.runId}:assistant`,
      kind: "message",
      role: "assistant",
      text: finalSummary,
    },
  });
}
