import type { EngineType } from "../../../../types";

export type DomainEventType =
  | "session.started"
  | "session.ended"
  | "turn.started"
  | "turn.completed"
  | "turn.failed"
  | "message.delta.appended"
  | "message.completed"
  | "tool.started"
  | "tool.completed"
  | "usage.updated";

export type DomainEventBase<TType extends DomainEventType> = Readonly<{
  type: TType;
  occurredAt: string;
  workspaceId: string;
  sessionId: string;
  engine: EngineType;
}>;

export type DomainEventIdentity = Omit<DomainEventBase<DomainEventType>, "type">;
