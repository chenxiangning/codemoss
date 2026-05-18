import type { PricingSource } from "../pricingTypes";

const LAST_UPDATED_AT = "2026-05-17T00:00:00.000Z";

export const CODEX_PRICING_FIXTURES = [
  {
    engine: "codex",
    model: "gpt-5.2",
    aliases: ["gpt-5.1", "gpt-5"],
    input: { perMillionTokens: 3, currency: "USD" },
    output: { perMillionTokens: 15, currency: "USD" },
    cacheRead: { perMillionTokens: 0.3, currency: "USD" },
    source: "fixture",
    lastUpdatedAt: LAST_UPDATED_AT,
    stalenessThresholdDays: 90,
    evidence: "aligned-with-existing-local-usage-rates",
  },
] as const satisfies readonly PricingSource[];
