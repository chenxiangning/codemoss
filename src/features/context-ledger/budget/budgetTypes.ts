import type { CostAmount } from "../cost/costTypes";

export type BudgetTier = "none" | "info" | "warn" | "block";

export type SessionBudgetThresholds = {
  info: number;
  warn: number;
  block: number;
};

export type SessionBudget = {
  limit: CostAmount;
  thresholds: SessionBudgetThresholds;
};

export type BudgetEvaluation = {
  tier: BudgetTier;
  ratio: number | null;
  overBudget: boolean;
  shouldInterruptRuntime: false;
};
