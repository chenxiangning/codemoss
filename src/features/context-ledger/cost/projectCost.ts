import type { ThreadTokenUsage, TokenUsageBreakdown } from "../../../types";
import {
  isPricingSourceStale,
  lookupPricingSource,
} from "../pricing/pricingRegistry";
import type { PricingSource } from "../pricing/pricingTypes";
import type {
  CostProjectionInput,
  CostRecord,
  CostUsageSnapshot,
} from "./costTypes";

function positiveTokenCount(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function selectUsageBreakdown(
  usage: ThreadTokenUsage,
  scope: CostProjectionInput["scope"],
): TokenUsageBreakdown {
  return scope === "turn" ? usage.last : usage.total;
}

export function snapshotCostUsage(
  usage: ThreadTokenUsage,
  scope: CostProjectionInput["scope"],
): CostUsageSnapshot {
  const breakdown = selectUsageBreakdown(usage, scope);
  const outputTokens = positiveTokenCount(breakdown.outputTokens);
  const reasoningOutputTokens = positiveTokenCount(breakdown.reasoningOutputTokens);
  return {
    inputTokens: positiveTokenCount(breakdown.inputTokens),
    cachedInputTokens: positiveTokenCount(breakdown.cachedInputTokens),
    outputTokens,
    reasoningOutputTokens,
    billableOutputTokens: outputTokens + reasoningOutputTokens,
    totalTokens: positiveTokenCount(breakdown.totalTokens),
  };
}

function projectKnownCost(
  usage: CostUsageSnapshot,
  pricingSource: PricingSource,
): number {
  const inputCost =
    (usage.inputTokens / 1_000_000) * pricingSource.input.perMillionTokens;
  const outputCost =
    (usage.billableOutputTokens / 1_000_000) * pricingSource.output.perMillionTokens;
  const cacheReadCost =
    (usage.cachedInputTokens / 1_000_000) * (pricingSource.cacheRead?.perMillionTokens ?? 0);
  return inputCost + outputCost + cacheReadCost;
}

export function projectCost(
  input: CostProjectionInput,
  options: {
    pricingSources?: readonly PricingSource[];
    now?: Date;
  } = {},
): CostRecord {
  const usage = snapshotCostUsage(input.usage, input.scope);
  const pricingSource = lookupPricingSource(
    input.engine,
    input.model,
    options.pricingSources,
  );
  if (!pricingSource) {
    return {
      scope: input.scope,
      engine: input.engine,
      model: input.model?.trim() || null,
      usage,
      amount: null,
      pricingSource: null,
      degraded: true,
      degradationReason: "pricing-unavailable",
    };
  }
  const stale = isPricingSourceStale(pricingSource, options.now);
  return {
    scope: input.scope,
    engine: input.engine,
    model: input.model?.trim() || null,
    usage,
    amount: stale
      ? null
      : {
          amount: projectKnownCost(usage, pricingSource),
          currency: pricingSource.input.currency,
        },
    pricingSource: {
      engine: pricingSource.engine,
      model: pricingSource.model,
      source: pricingSource.source,
      lastUpdatedAt: pricingSource.lastUpdatedAt,
      currency: pricingSource.input.currency,
    },
    degraded: stale,
    degradationReason: stale ? "pricing-stale" : null,
  };
}

export function createUnsupportedBlockLevelCostRecord(): Pick<
  CostRecord,
  "amount" | "degraded" | "degradationReason" | "pricingSource"
> {
  return {
    amount: null,
    degraded: true,
    degradationReason: "block-level-not-supported",
    pricingSource: null,
  };
}
