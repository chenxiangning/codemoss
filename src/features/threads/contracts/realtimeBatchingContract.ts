import type { RealtimeReplayEvent } from "./realtimeReplayTypes";

export type RealtimeBatchDelivery = {
  events: readonly RealtimeReplayEvent[];
  flushReason: "first-token" | "window" | "terminal" | "final";
  atMs: number;
};

function isBatchableDelta(event: RealtimeReplayEvent): boolean {
  return (
    event.kind === "agentDelta"
    || event.kind === "reasoningSummaryDelta"
    || event.kind === "reasoningContentDelta"
    || event.kind === "toolOutputDelta"
  );
}

function isTerminalEvent(event: RealtimeReplayEvent): boolean {
  return event.kind === "agentCompleted";
}

function isFirstVisibleAssistantDelta(
  event: RealtimeReplayEvent,
  seenAssistantItems: Set<string>,
): boolean {
  return event.kind === "agentDelta" && !seenAssistantItems.has(event.itemId);
}

function sortRealtimeEvents(events: readonly RealtimeReplayEvent[]): RealtimeReplayEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      if (left.event.atMs !== right.event.atMs) {
        return left.event.atMs - right.event.atMs;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.event);
}

export function planRealtimeBatchDeliveries(
  events: readonly RealtimeReplayEvent[],
  batchWindowMs: number,
): RealtimeBatchDelivery[] {
  const orderedEvents = sortRealtimeEvents(events);
  const deliveries: RealtimeBatchDelivery[] = [];
  const pending: RealtimeReplayEvent[] = [];
  const seenAssistantItems = new Set<string>();
  let pendingStartedAtMs = -1;

  const flushPending = (flushReason: RealtimeBatchDelivery["flushReason"], atMs: number) => {
    if (pending.length === 0) {
      return;
    }
    deliveries.push({
      events: [...pending],
      flushReason,
      atMs,
    });
    pending.length = 0;
    pendingStartedAtMs = -1;
  };

  for (const event of orderedEvents) {
    if (isTerminalEvent(event)) {
      flushPending("terminal", event.atMs);
      deliveries.push({
        events: [event],
        flushReason: "terminal",
        atMs: event.atMs,
      });
      continue;
    }

    if (!isBatchableDelta(event)) {
      flushPending("terminal", event.atMs);
      deliveries.push({
        events: [event],
        flushReason: "terminal",
        atMs: event.atMs,
      });
      continue;
    }

    if (isFirstVisibleAssistantDelta(event, seenAssistantItems)) {
      flushPending("window", event.atMs);
      deliveries.push({
        events: [event],
        flushReason: "first-token",
        atMs: event.atMs,
      });
      seenAssistantItems.add(event.itemId);
      continue;
    }

    if (event.kind === "agentDelta") {
      seenAssistantItems.add(event.itemId);
    }

    if (pending.length === 0) {
      pending.push(event);
      pendingStartedAtMs = event.atMs;
      continue;
    }

    if (event.atMs - pendingStartedAtMs <= batchWindowMs) {
      pending.push(event);
      continue;
    }

    flushPending("window", event.atMs);
    pending.push(event);
    pendingStartedAtMs = event.atMs;
  }

  flushPending("final", orderedEvents.at(-1)?.atMs ?? 0);
  return deliveries;
}

export function flattenRealtimeBatchDeliveries(
  deliveries: readonly RealtimeBatchDelivery[],
): RealtimeReplayEvent[] {
  return deliveries.flatMap((delivery) => delivery.events);
}
