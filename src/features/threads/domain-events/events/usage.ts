import type { ThreadTokenUsage } from "../../../../types";
import type { DomainEventBase } from "./base";

export type UsageUpdatedEvent = DomainEventBase<"usage.updated"> &
  Readonly<{
    turnId: string;
    usageSnapshot: Readonly<ThreadTokenUsage>;
  }>;
