import type { TFunction } from "i18next";
import type { AccountRateLimitsInfo } from "../types";
import { formatRelativeTime } from "../../../../../utils/time";
import { formatRateLimitWindowLabel } from "../../../../../utils/rateLimitLabels";

export type AccountUsageSnapshot = {
  sessionPercent: number | null;
  weeklyPercent: number | null;
  sessionLimitLabel: string;
  weeklyLimitLabel: string;
  showWeekly: boolean;
  sessionResetLabel: string | null;
  weeklyResetLabel: string | null;
};

function resolveUsagePercent(
  usedPercent: number | null | undefined,
  usageShowRemaining: boolean,
): number | null {
  if (typeof usedPercent !== "number" || Number.isNaN(usedPercent)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(usedPercent)));
  return usageShowRemaining ? 100 - clamped : clamped;
}

function formatUsageReset(
  t: TFunction,
  value: number | null | undefined,
  labelKey: "usage.sessionReset" | "usage.weeklyReset",
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const resetMs = value > 1_000_000_000_000 ? value : value * 1000;
  return `${t(labelKey)} ${formatRelativeTime(resetMs)}`;
}

/**
 * Pure view-model for Composer rate-limit / usage display.
 * UI-only: no network; callers pass already-fetched AccountRateLimitsInfo.
 */
export function buildAccountUsageSnapshot(
  accountRateLimits: AccountRateLimitsInfo | null | undefined,
  usageShowRemaining: boolean,
  t: TFunction,
): AccountUsageSnapshot {
  return {
    sessionPercent: resolveUsagePercent(
      accountRateLimits?.primary?.usedPercent,
      usageShowRemaining,
    ),
    weeklyPercent: resolveUsagePercent(
      accountRateLimits?.secondary?.usedPercent,
      usageShowRemaining,
    ),
    sessionLimitLabel: formatRateLimitWindowLabel(
      accountRateLimits?.primary?.windowDurationMins,
    ),
    weeklyLimitLabel: formatRateLimitWindowLabel(
      accountRateLimits?.secondary?.windowDurationMins,
    ),
    showWeekly: Boolean(accountRateLimits?.secondary),
    sessionResetLabel: formatUsageReset(
      t,
      accountRateLimits?.primary?.resetsAt,
      "usage.sessionReset",
    ),
    weeklyResetLabel: formatUsageReset(
      t,
      accountRateLimits?.secondary?.resetsAt,
      "usage.weeklyReset",
    ),
  };
}
