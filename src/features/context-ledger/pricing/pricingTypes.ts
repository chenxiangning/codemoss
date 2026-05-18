import type { EngineType } from "../../../types";

export type PricingCurrency = "USD";
export type PricingSourceKind = "fixture" | "config" | "remote";

export type TokenPrice = {
  perMillionTokens: number;
  currency: PricingCurrency;
};

export type PricingSource = {
  engine: EngineType;
  model: string;
  aliases?: readonly string[];
  input: TokenPrice;
  output: TokenPrice;
  cacheRead?: TokenPrice;
  cacheWrite?: TokenPrice;
  source: PricingSourceKind;
  lastUpdatedAt: string;
  stalenessThresholdDays?: number;
  evidence?: string;
};

export type PricingSourceSummary = Pick<
  PricingSource,
  "engine" | "model" | "source" | "lastUpdatedAt"
> & {
  currency: PricingCurrency;
};

export const PRICING_SOURCE_KINDS = [
  "fixture",
  "config",
  "remote",
] as const satisfies readonly PricingSourceKind[];

export const DEFAULT_PRICING_STALENESS_THRESHOLD_DAYS = 90;
