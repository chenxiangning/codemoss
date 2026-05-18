import type { MessageCompletedEvent, MessageDeltaAppendedEvent } from "./events/message";
import type { SessionEndedEvent, SessionStartedEvent } from "./events/session";
import type { ToolCompletedEvent, ToolStartedEvent } from "./events/tool";
import type { TurnCompletedEvent, TurnFailedEvent, TurnStartedEvent } from "./events/turn";
import type { UsageUpdatedEvent } from "./events/usage";

export type AgentDomainEvent =
  | SessionStartedEvent
  | SessionEndedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | MessageDeltaAppendedEvent
  | MessageCompletedEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | UsageUpdatedEvent;

export type { DomainEventBase, DomainEventIdentity, DomainEventType } from "./events/base";
export type { MessageCompletedEvent, MessageDeltaAppendedEvent } from "./events/message";
export type { SessionEndedEvent, SessionEndedReason, SessionStartedEvent } from "./events/session";
export type { ToolCompletedEvent, ToolCompletedStatus, ToolStartedEvent } from "./events/tool";
export type { TurnCompletedEvent, TurnFailedEvent, TurnFailedReason, TurnStartedEvent } from "./events/turn";
export type { UsageUpdatedEvent } from "./events/usage";
