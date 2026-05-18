import type { DomainEventBase } from "./base";

export type MessageDeltaAppendedEvent = DomainEventBase<"message.delta.appended"> &
  Readonly<{
    turnId: string;
    messageId: string;
    deltaLength: number;
  }>;

export type MessageCompletedEvent = DomainEventBase<"message.completed"> &
  Readonly<{
    turnId: string;
    messageId: string;
  }>;
