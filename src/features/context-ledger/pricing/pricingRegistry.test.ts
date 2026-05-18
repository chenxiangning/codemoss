import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRICING_SOURCES,
  ENGINE_PRICING_FIXTURES,
  isPricingSourceStale,
  lookupPricingSource,
} from "./pricingRegistry";

describe("pricingRegistry", () => {
  it("keeps pricing fixtures split by engine", () => {
    expect(Object.keys(ENGINE_PRICING_FIXTURES).sort()).toEqual([
      "claude",
      "codex",
      "gemini",
      "opencode",
    ]);
    expect(DEFAULT_PRICING_SOURCES.every((source) => source.source === "fixture")).toBe(true);
  });

  it("looks up known engine model pricing and returns null for unknown pricing", () => {
    expect(lookupPricingSource("claude", "sonnet")?.input.perMillionTokens).toBe(3);
    expect(lookupPricingSource("codex", "gpt-5.1")?.output.perMillionTokens).toBe(15);
    expect(lookupPricingSource("opencode", "user/provider-model")).toBeNull();
    expect(lookupPricingSource("gemini", "gemini-unknown")).toBeNull();
  });

  it("detects stale fixture pricing from lastUpdatedAt and threshold", () => {
    const source = lookupPricingSource("claude", "sonnet");
    expect(source).not.toBeNull();
    expect(isPricingSourceStale(source!, new Date("2026-05-18T00:00:00.000Z"))).toBe(false);
    expect(isPricingSourceStale(source!, new Date("2026-09-01T00:00:00.000Z"))).toBe(true);
  });
});
