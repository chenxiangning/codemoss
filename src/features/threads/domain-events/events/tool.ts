import type { DomainEventBase } from "./base";

export type ToolStartedEvent = DomainEventBase<"tool.started"> &
  Readonly<{
    turnId: string;
    toolCallId: string;
    toolName: string;
  }>;

export type ToolCompletedStatus = "completed" | "failed" | "cancelled";

export type ToolCompletedEvent = DomainEventBase<"tool.completed"> &
  Readonly<{
    turnId: string;
    toolCallId: string;
    status: ToolCompletedStatus;
    durationMs: number | null;
  }>;
