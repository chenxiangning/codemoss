import { describe, expect, it } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import { aggregateCostRecords } from "./costAggregate";
import {
  createUnsupportedBlockLevelCostRecord,
  projectCost,
} from "./projectCost";

function usageSnapshot(): ThreadTokenUsage {
  return {
    total: {
      totalTokens: 2_050_000,
      inputTokens: 1_000_000,
      cachedInputTokens: 500_000,
      outputTokens: 500_000,
      reasoningOutputTokens: 50_000,
    },
    last: {
      totalTokens: 205_000,
      inputTokens: 100_000,
      cachedInputTokens: 50_000,
      outputTokens: 50_000,
      reasoningOutputTokens: 5_000,
    },
    modelContextWindow: 200_000,
  };
}

describe("projectCost", () => {
  it("projects known session cost from ThreadTokenUsage and traceable pricing", () => {
    const record = projectCost(
      {
        scope: "session",
        engine: "claude",
        model: "sonnet",
        usage: usageSnapshot(),
      },
      { now: new Date("2026-05-18T00:00:00.000Z") },
    );
    expect(record.degraded).toBe(false);
    expect(record.pricingSource).toMatchObject({
      engine: "claude",
      model: "claude-sonnet-4-6",
      source: "fixture",
    });
    expect(record.amount?.currency).toBe("USD");
    expect(record.amount?.amount).toBeCloseTo(11.4);
  });

  it("returns degraded state for unknown pricing instead of silent zero", () => {
    const record = projectCost({
      scope: "turn",
      engine: "opencode",
      model: "user/provider-model",
      usage: usageSnapshot(),
    });
    expect(record.degraded).toBe(true);
    expect(record.degradationReason).toBe("pricing-unavailable");
    expect(record.amount).toBeNull();
  });

  it("marks aggregate partial when any engine cost is degraded", () => {
    const known = projectCost(
      {
        scope: "turn",
        engine: "codex",
        model: "gpt-5.1",
        usage: usageSnapshot(),
      },
      { now: new Date("2026-05-18T00:00:00.000Z") },
    );
    const degraded = projectCost({
      scope: "turn",
      engine: "gemini",
      model: "gemini-unknown",
      usage: usageSnapshot(),
    });
    const aggregate = aggregateCostRecords([known, degraded]);
    expect(aggregate.partial).toBe(true);
    expect(aggregate.amount?.amount).toBeCloseTo(1.14);
    expect(aggregate.engineBreakdown.find((item) => item.engine === "gemini")?.partial).toBe(true);
  });

  it("keeps block-level cost explicitly unsupported", () => {
    expect(createUnsupportedBlockLevelCostRecord()).toMatchObject({
      amount: null,
      degraded: true,
      degradationReason: "block-level-not-supported",
    });
  });
});
