import { describe, expect, it } from "vitest";
import { buildPromptEnhancerDedupPathEvents, buildStreamJsonFirstTokenSlowPathEvents } from "./realtimePerfExtendedFixture";
import { REALTIME_REPLAY_BATCH_WINDOW_MS } from "./realtimeReplayFixture";
import { runReplayProfile } from "./realtimeReplayHarness";
import type { RealtimeReplayEvent } from "./realtimeReplayTypes";
import {
  flattenRealtimeBatchDeliveries,
  planRealtimeBatchDeliveries,
} from "./realtimeBatchingContract";

function event(
  id: string,
  kind: RealtimeReplayEvent["kind"],
  delta: string,
  atMs: number,
): RealtimeReplayEvent {
  const base = {
    id,
    workspaceId: "ws-batching-contract",
    threadId: "codex:batching-thread",
    itemId: "assistant-1",
    atMs,
  };
  if (kind === "agentDelta") {
    return { ...base, kind, delta };
  }
  if (kind === "toolOutputDelta") {
    return { ...base, kind, itemId: "tool-1", delta };
  }
  if (kind === "reasoningSummaryDelta" || kind === "reasoningContentDelta") {
    return { ...base, kind, itemId: "reasoning-1", delta };
  }
  if (kind === "toolStarted") {
    return { ...base, kind, itemId: "tool-1", command: "npm test" };
  }
  return { ...base, kind: "agentCompleted", text: delta };
}

describe("realtime batching contract", () => {
  it("flushes first visible assistant delta immediately", () => {
    const deliveries = planRealtimeBatchDeliveries(
      buildStreamJsonFirstTokenSlowPathEvents(),
      REALTIME_REPLAY_BATCH_WINDOW_MS,
    );
    const firstAgentDelivery = deliveries.find((delivery) =>
      delivery.events.some((entry) => entry.kind === "agentDelta"),
    );
    expect(firstAgentDelivery).toMatchObject({
      flushReason: "first-token",
      atMs: 5_000,
    });
    expect(firstAgentDelivery?.events).toHaveLength(1);
  });

  it("preserves order and final content while coalescing later deltas", () => {
    const events = [
      event("a", "agentDelta", "first ", 0),
      event("b", "agentDelta", "second ", 4),
      event("c", "toolOutputDelta", "tool ", 8),
      event("d", "agentDelta", "third", 10),
      event("e", "agentCompleted", "first second third", 20),
    ];
    const deliveries = planRealtimeBatchDeliveries(events, 12);
    expect(flattenRealtimeBatchDeliveries(deliveries).map((entry) => entry.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(deliveries.some((delivery) => delivery.events.length > 1)).toBe(true);
  });

  it("flushes pending deltas before terminal completion", () => {
    const deliveries = planRealtimeBatchDeliveries(
      [
        event("a", "agentDelta", "first ", 0),
        event("b", "agentDelta", "second", 4),
        event("c", "agentCompleted", "first second", 6),
      ],
      12,
    );
    const terminalIndex = deliveries.findIndex((delivery) =>
      delivery.events.some((entry) => entry.kind === "agentCompleted"),
    );
    expect(terminalIndex).toBeGreaterThan(0);
    expect(deliveries[terminalIndex - 1]).toMatchObject({
      flushReason: "terminal",
    });
    expect(deliveries[terminalIndex - 1]?.events.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("flushes pending deltas before non-delta tool lifecycle events", () => {
    const deliveries = planRealtimeBatchDeliveries(
      [
        event("a", "agentDelta", "first ", 0),
        event("b", "agentDelta", "second", 4),
        event("c", "toolStarted", "", 6),
      ],
      12,
    );
    const toolStartedIndex = deliveries.findIndex((delivery) =>
      delivery.events.some((entry) => entry.kind === "toolStarted"),
    );
    expect(toolStartedIndex).toBeGreaterThan(0);
    expect(deliveries[toolStartedIndex - 1]).toMatchObject({
      flushReason: "terminal",
    });
    expect(deliveries[toolStartedIndex - 1]?.events.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("keeps prompt enhancer dedup replay semantics stable", async () => {
    const events = buildPromptEnhancerDedupPathEvents();
    const baseline = await runReplayProfile({
      events,
      profile: "baseline",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    const optimized = await runReplayProfile({
      events,
      profile: "optimized",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    expect(optimized.semanticsHash).toBe(baseline.semanticsHash);
    expect(optimized.integrity).toEqual(baseline.integrity);
  });

  it("keeps first-token slow path replay semantics stable under optimized batching", async () => {
    const events = buildStreamJsonFirstTokenSlowPathEvents();
    const baseline = await runReplayProfile({
      events,
      profile: "baseline",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    const optimized = await runReplayProfile({
      events,
      profile: "optimized",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    expect(optimized.actionPlan[0]?.atMs).toBe(baseline.actionPlan[0]?.atMs);
    expect(optimized.semanticsHash).toBe(baseline.semanticsHash);
    expect(optimized.integrity).toEqual(baseline.integrity);
  });
});
