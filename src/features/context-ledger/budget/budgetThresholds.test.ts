import { describe, expect, it } from "vitest";
import { createSessionBudget } from "./budgetStore";
import {
  evaluateSessionBudget,
  shouldInterruptRuntimeForBudget,
} from "./budgetThresholds";

describe("budgetThresholds", () => {
  it("evaluates info warn and block tiers by ratio", () => {
    const budget = createSessionBudget(10);
    expect(evaluateSessionBudget({ amount: 4.9, currency: "USD" }, budget).tier).toBe("none");
    expect(evaluateSessionBudget({ amount: 5, currency: "USD" }, budget).tier).toBe("info");
    expect(evaluateSessionBudget({ amount: 8, currency: "USD" }, budget).tier).toBe("warn");
    expect(evaluateSessionBudget({ amount: 10, currency: "USD" }, budget)).toMatchObject({
      tier: "block",
      overBudget: true,
      shouldInterruptRuntime: false,
    });
  });

  it("treats missing or mismatched budget as no signal", () => {
    expect(evaluateSessionBudget(null, createSessionBudget(10))).toMatchObject({
      tier: "none",
      ratio: null,
    });
    expect(evaluateSessionBudget({ amount: 10, currency: "USD" }, null).tier).toBe("none");
  });

  it("documents that block tier does not interrupt runtime in this capability", () => {
    expect(shouldInterruptRuntimeForBudget()).toBe(false);
  });
});
