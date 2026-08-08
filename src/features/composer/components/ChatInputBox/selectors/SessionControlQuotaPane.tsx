import { useTranslation } from "react-i18next";
import type { SessionOverviewQuotaView } from "../../../../status-panel/utils/sessionOverviewViewModel";
import { formatRelativeTime } from "../../../../../utils/time";

export type SessionControlQuotaPaneProps = {
  /** 已由 buildSessionOverviewQuota 合并的额度视图（官方 rate limit + coding plan） */
  quota: SessionOverviewQuotaView;
  usageLoading?: boolean;
  onRefresh?: () => void;
};

function formatQuotaReset(
  resetsAt: number | null,
  labelKey: "usage.sessionReset" | "usage.weeklyReset",
  t: (key: string) => string,
): string | null {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) {
    return null;
  }
  const resetMs = resetsAt > 1_000_000_000_000 ? resetsAt : resetsAt * 1000;
  return `${t(labelKey)} ${formatRelativeTime(resetMs)}`;
}

/**
 * Right-rail Quota summary for Session Control HUD.
 * Presentational only — binds SessionOverviewQuotaView from overview pipeline.
 */
export function SessionControlQuotaPane({
  quota,
  usageLoading = false,
  onRefresh,
}: SessionControlQuotaPaneProps) {
  const { t } = useTranslation();
  const usedLabel = t(quota.showRemaining ? "usage.remaining" : "usage.used");
  const loading = usageLoading || quota.loading;
  const providerText =
    quota.providerLabel?.trim() ||
    t("composer.quotaProvider", { defaultValue: "Provider" });

  const title =
    quota.source === "official_cli"
      ? t("statusPanel.sessionOverview.quota.codexTitle")
      : quota.source === "coding_plan" && quota.providerLabel
        ? t("statusPanel.sessionOverview.quota.codingPlanTitle", {
            provider: quota.providerLabel,
          })
        : t("composer.quotaWindow", { defaultValue: "Quota window" });

  const primaryWindow = quota.windows[0] ?? null;
  const secondaryWindow = quota.windows[1] ?? null;
  const primaryReset = primaryWindow
    ? formatQuotaReset(primaryWindow.resetsAt, "usage.sessionReset", t)
    : null;
  const sparkBase = primaryWindow?.displayPercent ?? 0;
  const sparkHeights = [
    0.35, 0.48, 0.3, 0.62, 0.42, 0.55, 0.38, 0.7, 0.45, 0.52, 0.33, 0.64,
  ].map((scale, index) => {
    const tip = index >= 8;
    const height = Math.max(12, Math.round((sparkBase || 36) * scale * 0.9));
    return { height, tip };
  });

  const isBalanceOnly =
    !loading &&
    quota.windows.length === 0 &&
    quota.hasCredits &&
    (quota.source === "coding_plan" || quota.source === "official_cli");

  const emptyMessage = (() => {
    if (loading) {
      return t("statusPanel.sessionOverview.quota.loading");
    }
    if (quota.source === "error" || quota.error) {
      return t("statusPanel.sessionOverview.quota.error", {
        message: quota.error ?? "—",
      });
    }
    if (quota.source === "unsupported") {
      return t("statusPanel.sessionOverview.quota.unsupported", {
        engine: quota.providerLabel ?? "—",
      });
    }
    if (quota.source === "none") {
      return t("statusPanel.sessionOverview.quota.unsupported", {
        engine: quota.providerLabel ?? "—",
      });
    }
    if (quota.source === "official_cli") {
      return t("statusPanel.sessionOverview.quota.codexEmpty");
    }
    if (quota.source === "coding_plan") {
      return t("statusPanel.sessionOverview.quota.codingPlanEmpty");
    }
    return t("statusPanel.sessionOverview.quota.codingPlanEmpty");
  })();

  const showWindows =
    !loading &&
    (quota.source === "official_cli" || quota.source === "coding_plan") &&
    quota.windows.length > 0;

  return (
    <aside
      className="composer-session-hud-quota"
      data-testid="composer-session-quota-pane"
      aria-label={t("composer.quotaWindow", { defaultValue: "Quota window" })}
    >
      <div className="composer-session-hud-quota-header">
        <h4 className="composer-session-hud-quota-title">{title}</h4>
        {onRefresh ? (
          <button
            type="button"
            className="composer-session-hud-quota-refresh"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRefresh();
            }}
            title={t("home.refreshUsage")}
            aria-label={t("home.refreshUsage")}
          >
            <span
              className={`codicon ${loading ? "codicon-loading codicon-modifier-spin" : "codicon-refresh"}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {isBalanceOnly ? (
        <div className="composer-session-hud-quota-metrics">
          <div className="composer-session-hud-quota-row">
            <span className="composer-session-hud-quota-key">
              {t("usage.credits")}
            </span>
            <span className="composer-session-hud-quota-val">
              {quota.creditsUnlimited
                ? t("usage.unlimited")
                : (quota.creditsBalance ?? "—")}
            </span>
          </div>
          <div className="composer-session-hud-quota-row">
            <span className="composer-session-hud-quota-key">
              {t("composer.quotaProvider", { defaultValue: "Provider" })}
            </span>
            <span className="composer-session-hud-quota-val">{providerText}</span>
          </div>
        </div>
      ) : showWindows ? (
        <>
          <div className="composer-session-hud-quota-metrics">
            <div className="composer-session-hud-quota-row">
              <span className="composer-session-hud-quota-key">
                {t("composer.quotaUsed", { defaultValue: "Used" })}
              </span>
              <span className="composer-session-hud-quota-val">
                {primaryWindow
                  ? `${primaryWindow.displayPercent}% ${usedLabel}`
                  : "--"}
              </span>
            </div>
            <div className="composer-session-hud-quota-row">
              <span className="composer-session-hud-quota-key">
                {t("composer.quotaReset", { defaultValue: "Reset" })}
              </span>
              <span className="composer-session-hud-quota-val">
                {primaryReset ?? "--"}
              </span>
            </div>
            <div className="composer-session-hud-quota-row">
              <span className="composer-session-hud-quota-key">
                {t("composer.quotaProvider", { defaultValue: "Provider" })}
              </span>
              <span className="composer-session-hud-quota-val">
                {providerText}
              </span>
            </div>
          </div>

          <div className="composer-session-hud-quota-progress" aria-hidden="true">
            <span
              className="composer-session-hud-quota-progress-fill"
              style={{ width: `${primaryWindow?.displayPercent ?? 0}%` }}
            />
          </div>

          {primaryWindow?.label ? (
            <div className="composer-session-hud-quota-window-label">
              {primaryWindow.label}
            </div>
          ) : null}

          {secondaryWindow ? (
            <div className="composer-session-hud-quota-secondary">
              <div className="composer-session-hud-quota-row">
                <span className="composer-session-hud-quota-key">
                  {secondaryWindow.label}
                </span>
                <span className="composer-session-hud-quota-val">
                  {`${secondaryWindow.displayPercent}% ${usedLabel}`}
                </span>
              </div>
              {formatQuotaReset(
                secondaryWindow.resetsAt,
                "usage.weeklyReset",
                t,
              ) ? (
                <div className="composer-session-hud-quota-reset-secondary">
                  {formatQuotaReset(
                    secondaryWindow.resetsAt,
                    "usage.weeklyReset",
                    t,
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {quota.hasCredits ? (
            <div className="composer-session-hud-quota-secondary">
              <div className="composer-session-hud-quota-row">
                <span className="composer-session-hud-quota-key">
                  {t("usage.credits")}
                </span>
                <span className="composer-session-hud-quota-val">
                  {quota.creditsUnlimited
                    ? t("usage.unlimited")
                    : (quota.creditsBalance ?? "—")}
                </span>
              </div>
            </div>
          ) : null}

          <div className="composer-session-hud-spark" aria-hidden="true">
            {sparkHeights.map((bar, index) => (
              <i
                key={`spark-${index}`}
                className={bar.tip ? "is-tip" : undefined}
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="composer-session-hud-quota-metrics">
          <p className="composer-session-hud-quota-empty">{emptyMessage}</p>
          <div className="composer-session-hud-quota-row">
            <span className="composer-session-hud-quota-key">
              {t("composer.quotaProvider", { defaultValue: "Provider" })}
            </span>
            <span className="composer-session-hud-quota-val">{providerText}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
