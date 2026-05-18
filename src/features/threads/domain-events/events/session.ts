import type { DomainEventBase } from "./base";

export type SessionStartedEvent = DomainEventBase<"session.started"> &
  Readonly<{
    source: "new-thread" | "history-restore" | "runtime-resume";
  }>;

export type SessionEndedReason = "completed" | "interrupted" | "archived" | "failed";

export type SessionEndedEvent = DomainEventBase<"session.ended"> &
  Readonly<{
    reason: SessionEndedReason;
  }>;
