import type { DomainEventIdentity } from "./events/base";
import type {
  MessageCompletedEvent,
  MessageDeltaAppendedEvent,
  SessionEndedEvent,
  SessionStartedEvent,
  ToolCompletedEvent,
  ToolStartedEvent,
  TurnCompletedEvent,
  TurnFailedEvent,
  TurnStartedEvent,
  UsageUpdatedEvent,
} from "./eventTypes";

function freezeInDev<T extends object>(event: T): Readonly<T> {
  return import.meta.env.DEV ? Object.freeze(event) : event;
}

function assertIsoTimestamp(occurredAt: string): void {
  const timestamp = Date.parse(occurredAt);
  if (!occurredAt || Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== occurredAt) {
    throw new Error("AgentDomainEvent occurredAt must be an ISO 8601 timestamp.");
  }
}

function withIdentity<TEvent extends object>(
  identity: DomainEventIdentity,
  event: TEvent,
): Readonly<TEvent> {
  assertIsoTimestamp(identity.occurredAt);
  return freezeInDev(event);
}

export function createSessionStartedEvent(
  input: DomainEventIdentity & Pick<SessionStartedEvent, "source">,
): SessionStartedEvent {
  return withIdentity(input, {
    type: "session.started",
    ...input,
  });
}

export function createSessionEndedEvent(
  input: DomainEventIdentity & Pick<SessionEndedEvent, "reason">,
): SessionEndedEvent {
  return withIdentity(input, {
    type: "session.ended",
    ...input,
  });
}

export function createTurnStartedEvent(
  input: DomainEventIdentity & Pick<TurnStartedEvent, "turnId" | "promptSummary">,
): TurnStartedEvent {
  return withIdentity(input, {
    type: "turn.started",
    ...input,
  });
}

export function createTurnCompletedEvent(
  input: DomainEventIdentity & Pick<TurnCompletedEvent, "turnId" | "durationMs">,
): TurnCompletedEvent {
  return withIdentity(input, {
    type: "turn.completed",
    ...input,
  });
}

export function createTurnFailedEvent(
  input: DomainEventIdentity & Pick<TurnFailedEvent, "turnId" | "reason" | "message">,
): TurnFailedEvent {
  return withIdentity(input, {
    type: "turn.failed",
    ...input,
  });
}

export function createMessageDeltaAppendedEvent(
  input: DomainEventIdentity & Pick<MessageDeltaAppendedEvent, "turnId" | "messageId" | "deltaLength">,
): MessageDeltaAppendedEvent {
  return withIdentity(input, {
    type: "message.delta.appended",
    ...input,
  });
}

export function createMessageCompletedEvent(
  input: DomainEventIdentity & Pick<MessageCompletedEvent, "turnId" | "messageId">,
): MessageCompletedEvent {
  return withIdentity(input, {
    type: "message.completed",
    ...input,
  });
}

export function createToolStartedEvent(
  input: DomainEventIdentity & Pick<ToolStartedEvent, "turnId" | "toolCallId" | "toolName">,
): ToolStartedEvent {
  return withIdentity(input, {
    type: "tool.started",
    ...input,
  });
}

export function createToolCompletedEvent(
  input: DomainEventIdentity & Pick<ToolCompletedEvent, "turnId" | "toolCallId" | "status" | "durationMs">,
): ToolCompletedEvent {
  return withIdentity(input, {
    type: "tool.completed",
    ...input,
  });
}

export function createUsageUpdatedEvent(
  input: DomainEventIdentity & Pick<UsageUpdatedEvent, "turnId" | "usageSnapshot">,
): UsageUpdatedEvent {
  return withIdentity(input, {
    type: "usage.updated",
    ...input,
  });
}
