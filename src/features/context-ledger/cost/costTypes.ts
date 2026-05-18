import type { EngineType, ThreadTokenUsage } from "../../../types";
import type { PricingCurrency, PricingSourceSummary } from "../pricing/pricingTypes";

export type CostProjectionScope = "turn" | "session";

export type CostDegradationReason =
  | "pricing-unavailable"
  | "pricing-stale"
  | "invalid-usage"
  | "block-level-not-supported";

export type CostAmount = {
  amount: number;
  currency: PricingCurrency;
};

export type CostUsageSnapshot = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  billableOutputTokens: number;
  totalTokens: number;
};

export type CostRecord = {
  scope: CostProjectionScope;
  engine: EngineType;
  model: string | null;
  usage: CostUsageSnapshot;
  amount: CostAmount | null;
  pricingSource: PricingSourceSummary | null;
  degraded: boolean;
  degradationReason: CostDegradationReason | null;
};

export type CostProjectionInput = {
  scope: CostProjectionScope;
  engine: EngineType;
  model: string | null | undefined;
  usage: ThreadTokenUsage;
};

export type EngineCostBreakdown = {
  engine: EngineType;
  amount: CostAmount | null;
  partial: boolean;
  records: readonly CostRecord[];
};

export type WorkspaceCostAggregate = {
  amount: CostAmount | null;
  currency: PricingCurrency;
  partial: boolean;
  records: readonly CostRecord[];
  engineBreakdown: readonly EngineCostBreakdown[];
};
