import type { PricingSource } from "../pricingTypes";

const LAST_UPDATED_AT = "2026-05-17T00:00:00.000Z";

export const CLAUDE_PRICING_FIXTURES = [
  {
    engine: "claude",
    model: "claude-sonnet-4-6",
    aliases: ["claude-sonnet-4-5-20250929", "sonnet"],
    input: { perMillionTokens: 3, currency: "USD" },
    output: { perMillionTokens: 15, currency: "USD" },
    cacheWrite: { perMillionTokens: 3.75, currency: "USD" },
    cacheRead: { perMillionTokens: 0.3, currency: "USD" },
    source: "fixture",
    lastUpdatedAt: LAST_UPDATED_AT,
    stalenessThresholdDays: 90,
    evidence: "aligned-with-existing-local-usage-rates",
  },
  {
    engine: "claude",
    model: "claude-opus-4-6",
    aliases: ["claude-opus-4-5-20251101", "opus"],
    input: { perMillionTokens: 15, currency: "USD" },
    output: { perMillionTokens: 75, currency: "USD" },
    cacheWrite: { perMillionTokens: 18.75, currency: "USD" },
    cacheRead: { perMillionTokens: 1.5, currency: "USD" },
    source: "fixture",
    lastUpdatedAt: LAST_UPDATED_AT,
    stalenessThresholdDays: 90,
    evidence: "aligned-with-existing-local-usage-rates",
  },
  {
    engine: "claude",
    model: "claude-haiku-4-5",
    aliases: ["haiku"],
    input: { perMillionTokens: 0.8, currency: "USD" },
    output: { perMillionTokens: 4, currency: "USD" },
    cacheWrite: { perMillionTokens: 1, currency: "USD" },
    cacheRead: { perMillionTokens: 0.08, currency: "USD" },
    source: "fixture",
    lastUpdatedAt: LAST_UPDATED_AT,
    stalenessThresholdDays: 90,
    evidence: "aligned-with-existing-local-usage-rates",
  },
] as const satisfies readonly PricingSource[];
