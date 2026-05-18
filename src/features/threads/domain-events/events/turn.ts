import type { DomainEventBase } from "./base";

export type TurnStartedEvent = DomainEventBase<"turn.started"> &
  Readonly<{
    turnId: string;
    promptSummary: string;
  }>;

export type TurnCompletedEvent = DomainEventBase<"turn.completed"> &
  Readonly<{
    turnId: string;
    durationMs: number;
  }>;

export type TurnFailedReason = "error" | "interrupted" | "timeout" | "cancelled";

export type TurnFailedEvent = DomainEventBase<"turn.failed"> &
  Readonly<{
    turnId: string;
    reason: TurnFailedReason;
    message: string | null;
  }>;
