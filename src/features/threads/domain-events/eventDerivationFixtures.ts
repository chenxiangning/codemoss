import type { ConversationItem, ThreadTokenUsage } from "../../../types";
import type { ConversationState } from "../contracts/conversationCurtainContracts";
import type { AgentDomainEvent, DomainEventIdentity } from "./eventTypes";
import {
  createMessageCompletedEvent,
  createMessageDeltaAppendedEvent,
  createSessionEndedEvent,
  createSessionStartedEvent,
  createToolCompletedEvent,
  createToolStartedEvent,
  createTurnCompletedEvent,
  createTurnFailedEvent,
  createTurnStartedEvent,
  createUsageUpdatedEvent,
} from "./eventFactories";

type DerivationContext = DomainEventIdentity & {
  turnId: string;
};

function findItem(
  state: ConversationState,
  itemId: string,
): ConversationItem | null {
  return state.items.find((item) => item.id === itemId) ?? null;
}

function findMessageText(state: ConversationState, messageId: string): string {
  const item = findItem(state, messageId);
  return item?.kind === "message" ? item.text : "";
}

function findToolItem(
  state: ConversationState,
  toolCallId: string,
): Extract<ConversationItem, { kind: "tool" }> | null {
  const item = findItem(state, toolCallId);
  return item?.kind === "tool" ? item : null;
}

function findLatestUserMessage(
  state: ConversationState,
): Extract<ConversationItem, { kind: "message" }> | null {
  for (let index = state.items.length - 1; index >= 0; index -= 1) {
    const item = state.items[index];
    if (item?.kind === "message" && item.role === "user") {
      return item;
    }
  }
  return null;
}

export function deriveSessionStartedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DomainEventIdentity,
): AgentDomainEvent | null {
  if (previous.meta.historyRestoredAtMs !== null || next.meta.historyRestoredAtMs === null) {
    return null;
  }
  return createSessionStartedEvent({
    ...context,
    source: "history-restore",
  });
}

export function deriveSessionEndedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DomainEventIdentity,
): AgentDomainEvent | null {
  if (previous.meta.isThinking || next.meta.isThinking) {
    return null;
  }
  if (previous.items.length === 0 || next.items.length !== 0) {
    return null;
  }
  return createSessionEndedEvent({
    ...context,
    reason: "archived",
  });
}

export function deriveTurnStartedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
): AgentDomainEvent | null {
  if (previous.meta.activeTurnId === next.meta.activeTurnId || next.meta.activeTurnId !== context.turnId) {
    return null;
  }
  const latestUserMessage = findLatestUserMessage(next);
  return createTurnStartedEvent({
    ...context,
    promptSummary: latestUserMessage?.text.slice(0, 200) ?? "",
  });
}

export function deriveTurnCompletedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  durationMs: number,
): AgentDomainEvent | null {
  if (previous.meta.activeTurnId !== context.turnId || next.meta.activeTurnId !== null) {
    return null;
  }
  return createTurnCompletedEvent({
    ...context,
    durationMs,
  });
}

export function deriveTurnFailedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  message: string,
): AgentDomainEvent | null {
  if (previous.meta.isThinking || next.meta.isThinking) {
    return null;
  }
  if (previous.meta.activeTurnId !== context.turnId || next.meta.activeTurnId !== null) {
    return null;
  }
  return createTurnFailedEvent({
    ...context,
    reason: "error",
    message,
  });
}

export function deriveMessageDeltaAppendedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  messageId: string,
): AgentDomainEvent | null {
  const beforeText = findMessageText(previous, messageId);
  const afterText = findMessageText(next, messageId);
  if (afterText.length <= beforeText.length) {
    return null;
  }
  return createMessageDeltaAppendedEvent({
    ...context,
    messageId,
    deltaLength: afterText.length - beforeText.length,
  });
}

export function deriveMessageCompletedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  messageId: string,
): AgentDomainEvent | null {
  const before = findItem(previous, messageId);
  const after = findItem(next, messageId);
  if (before?.kind !== "message" || after?.kind !== "message") {
    return null;
  }
  if (before.role !== "assistant" || after.role !== "assistant" || before.isFinal === after.isFinal) {
    return null;
  }
  if (!after.isFinal) {
    return null;
  }
  return createMessageCompletedEvent({
    ...context,
    messageId,
  });
}

export function deriveToolStartedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  toolCallId: string,
): AgentDomainEvent | null {
  if (findToolItem(previous, toolCallId)) {
    return null;
  }
  const tool = findToolItem(next, toolCallId);
  if (!tool) {
    return null;
  }
  return createToolStartedEvent({
    ...context,
    toolCallId,
    toolName: tool.toolType,
  });
}

export function deriveToolCompletedEvent(
  previous: ConversationState,
  next: ConversationState,
  context: DerivationContext,
  toolCallId: string,
): AgentDomainEvent | null {
  const before = findToolItem(previous, toolCallId);
  const after = findToolItem(next, toolCallId);
  if (!before || !after || before.status === after.status || after.status !== "completed") {
    return null;
  }
  return createToolCompletedEvent({
    ...context,
    toolCallId,
    status: "completed",
    durationMs: after.durationMs ?? null,
  });
}

export function deriveUsageUpdatedEvent(
  previousUsage: ThreadTokenUsage | null,
  nextUsage: ThreadTokenUsage | null,
  context: DerivationContext,
): AgentDomainEvent | null {
  if (!nextUsage || previousUsage === nextUsage) {
    return null;
  }
  return createUsageUpdatedEvent({
    ...context,
    usageSnapshot: nextUsage,
  });
}
