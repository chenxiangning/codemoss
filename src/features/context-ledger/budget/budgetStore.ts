import type { SessionBudget } from "./budgetTypes";

export const DEFAULT_SESSION_BUDGET_THRESHOLDS = {
  info: 0.5,
  warn: 0.8,
  block: 1,
} as const;

export function createSessionBudget(limitUsd: number): SessionBudget | null {
  if (!Number.isFinite(limitUsd) || limitUsd <= 0) {
    return null;
  }
  return {
    limit: {
      amount: limitUsd,
      currency: "USD",
    },
    thresholds: DEFAULT_SESSION_BUDGET_THRESHOLDS,
  };
}

export function normalizeSessionBudget(
  budget: SessionBudget | null | undefined,
): SessionBudget | null {
  if (!budget || budget.limit.currency !== "USD" || budget.limit.amount <= 0) {
    return null;
  }
  const { info, warn, block } = budget.thresholds;
  if (!(info >= 0 && info <= warn && warn <= block && block > 0)) {
    return null;
  }
  return budget;
}
