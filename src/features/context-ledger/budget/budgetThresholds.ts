import type { CostAmount } from "../cost/costTypes";
import type { BudgetEvaluation, BudgetTier, SessionBudget } from "./budgetTypes";
import { normalizeSessionBudget } from "./budgetStore";

function resolveTier(ratio: number, budget: SessionBudget): BudgetTier {
  if (ratio >= budget.thresholds.block) {
    return "block";
  }
  if (ratio >= budget.thresholds.warn) {
    return "warn";
  }
  if (ratio >= budget.thresholds.info) {
    return "info";
  }
  return "none";
}

export function evaluateSessionBudget(
  cost: CostAmount | null,
  budget: SessionBudget | null | undefined,
): BudgetEvaluation {
  const normalizedBudget = normalizeSessionBudget(budget);
  if (!cost || !normalizedBudget || cost.currency !== normalizedBudget.limit.currency) {
    return {
      tier: "none",
      ratio: null,
      overBudget: false,
      shouldInterruptRuntime: false,
    };
  }
  const ratio = cost.amount / normalizedBudget.limit.amount;
  return {
    tier: resolveTier(ratio, normalizedBudget),
    ratio,
    overBudget: ratio >= normalizedBudget.thresholds.block,
    shouldInterruptRuntime: false,
  };
}

export function shouldInterruptRuntimeForBudget(): false {
  return false;
}
