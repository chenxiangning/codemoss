import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  ompAuthBrokerListProviders,
  ompAuthBrokerStatus,
  ompAuthLocalAccounts,
  type OmpAuthBrokerProvider,
  type OmpAuthBrokerStatus,
  type OmpLocalAccount,
} from "../../../services/tauri/ompAuth";
import { requestTerminalCommand } from "../../terminal/utils/terminalCommandRequestEvent";
import { loadSettingsStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { resolveOmpAuthProviderIcon } from "../ompAuthProviderIcon";
import { ProviderBrandIconImg } from "./ProviderBrandIconImg";
import ompBrandIcon from "../../../assets/engine-icons/omp.svg";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

type ProviderRow = OmpAuthBrokerProvider & {
  iconSrc: string | null;
  account: OmpLocalAccount | null;
};

export function OmpAuthSection({ ompBin }: { ompBin?: string | null }) {
  useFeatureStylesReady(loadSettingsStyles);
  const { t } = useTranslation();
  const [status, setStatus] = useState<OmpAuthBrokerStatus | null>(null);
  const [providers, setProviders] = useState<OmpAuthBrokerProvider[]>([]);
  const [accounts, setAccounts] = useState<OmpLocalAccount[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    // 三路探测互不拖垮：本地登录态（agent.db 元数据）失败只降级摘要区，
    // auth-broker 未启用（默认态）也不影响供应商目录展示。
    const [statusResult, providerResult, accountResult] = await Promise.allSettled([
      ompAuthBrokerStatus(),
      ompAuthBrokerListProviders(),
      ompAuthLocalAccounts(),
    ]);
    setStatus(statusResult.status === "fulfilled" ? statusResult.value : null);
    if (providerResult.status === "fulfilled") {
      setProviders(
        Array.isArray(providerResult.value) ? providerResult.value : [],
      );
      setProviderError(null);
    } else {
      setProviders([]);
      setProviderError(
        providerResult.reason instanceof Error
          ? providerResult.reason.message
          : String(providerResult.reason),
      );
    }
    if (accountResult.status === "fulfilled") {
      setAccounts(
        Array.isArray(accountResult.value) ? accountResult.value : [],
      );
      setAccountError(null);
    } else {
      setAccounts([]);
      setAccountError(
        accountResult.reason instanceof Error
          ? accountResult.reason.message
          : String(accountResult.reason),
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const loggedInByProvider = useMemo(() => {
    const byProvider = new Map<string, OmpLocalAccount>();
    for (const account of accounts) {
      if (account.disabledCause?.trim()) {
        continue;
      }
      byProvider.set(account.provider.trim(), account);
    }
    return byProvider;
  }, [accounts]);

  const rows = useMemo<ProviderRow[]>(() => {
    const providerRows = providers.map((provider) => ({
      ...provider,
      iconSrc: resolveOmpAuthProviderIcon(provider.id),
      account: loggedInByProvider.get(provider.id.trim()) ?? null,
    }));
    const knownProviderIds = new Set(
      providerRows.map((provider) => provider.id.trim()),
    );
    const accountOnlyRows = [...loggedInByProvider.values()]
      .filter((account) => !knownProviderIds.has(account.provider.trim()))
      .map((account) => ({
        id: account.provider.trim(),
        name: account.provider.trim(),
        iconSrc: resolveOmpAuthProviderIcon(account.provider),
        account,
      }));
    return [...providerRows, ...accountOnlyRows];
  }, [loggedInByProvider, providers]);

  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return rows;
    }
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(normalizedQuery) ||
        row.id.toLowerCase().includes(normalizedQuery),
    );
  }, [rows, searchQuery]);

  const loggedInCount = loggedInByProvider.size;
  const loggedInRows = useMemo(
    () => rows.filter((row) => row.account !== null),
    [rows],
  );

  const binary = ompBin?.trim() || "omp";
  const launch = (action: "login" | "logout", providerId: string) => {
    requestTerminalCommand({
      terminalId: `omp-auth-${action}-${providerId}`,
      title: `omp auth-broker ${action} ${providerId}`,
      command: `${shellQuote(binary)} auth-broker ${action} ${shellQuote(providerId)}`,
    });
  };

  return (
    <section className="vendor-omp-auth" data-testid="omp-auth-section">
      <div className="vendor-omp-auth-intro">
        <div className="vendor-omp-auth-mark" aria-hidden="true">
          <img src={ompBrandIcon} alt="" className="vendor-omp-auth-mark-img" />
        </div>
        <div className="vendor-omp-auth-copy">
          <div className="vendor-omp-auth-title">
            {t("settings.vendor.omp.authTitle", {
              defaultValue: "OMP 供应商登录",
            })}
          </div>
          <div className="vendor-omp-auth-description">
            {t("settings.vendor.omp.authDescription", {
              defaultValue:
                "点击「登录」在终端完成对应供应商的 OAuth / 授权流程；凭据由 OMP CLI 本地保管，MOSSX 不读取或保存 token。",
            })}
          </div>
        </div>
        <button
          type="button"
          className="vendor-omp-auth-refresh"
          onClick={() => void refresh()}
          aria-label={t("common.refresh", { defaultValue: "刷新" })}
        >
          ↻
        </button>
      </div>
      <div className="vendor-omp-auth-status-row">
        <div
          className="vendor-omp-auth-status"
          role="status"
          data-testid="omp-local-account-status"
        >
          <span
            className={`vendor-omp-auth-status-dot ${
              loggedInCount > 0 ? "is-ready" : "is-idle"
            }`}
          />
          <span>
            {accountError
              ? t("settings.vendor.omp.localAccountsUnavailable", {
                  defaultValue: "无法读取本地登录信息（请确认 OMP CLI 已安装）",
                })
              : loggedInCount > 0
                ? t("settings.vendor.omp.localAccountsReady", {
                    count: loggedInCount,
                    defaultValue: `已登录 ${loggedInCount} 个供应商`,
                  })
                : t("settings.vendor.omp.localAccountsEmpty", {
                    defaultValue: "尚未登录任何供应商",
                  })}
          </span>
        </div>
        <div
          className="vendor-omp-auth-status vendor-omp-auth-status-secondary"
          role="status"
          title={t("settings.vendor.omp.brokerHint", {
            defaultValue:
              "凭据保险库（auth-broker）是 OMP 的高级远程功能，本地登录不依赖它。",
          })}
        >
          <span
            className={`vendor-omp-auth-status-dot ${
              status?.configured ? "is-ready" : "is-idle"
            }`}
          />
          <span>
            {status?.configured
              ? t("settings.vendor.omp.brokerConfigured", {
                  defaultValue: "凭据保险库已启用",
                })
              : t("settings.vendor.omp.brokerNotConfigured", {
                  defaultValue: "凭据保险库未启用（可选）",
                })}
          </span>
        </div>
      </div>
      {loggedInRows.length > 0 ? (
        <div className="vendor-omp-auth-logged-in" data-testid="omp-logged-in-accounts">
          {loggedInRows.map((row) => (
            <div className="vendor-omp-auth-account" key={`account-${row.id}`}>
              <span className="vendor-omp-auth-provider-icon" aria-hidden="true">
                {row.iconSrc ? (
                  <ProviderBrandIconImg src={row.iconSrc} />
                ) : (
                  row.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="vendor-omp-auth-provider-copy">
                <div className="vendor-omp-auth-provider-name">{row.name}</div>
                {row.account?.identity ? (
                  <div className="vendor-omp-auth-provider-id">
                    {row.account.identity}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="vendor-omp-auth-btn"
                onClick={() => launch("logout", row.id)}
              >
                {t("settings.vendor.omp.logout", { defaultValue: "退出登录" })}
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="vendor-omp-auth-list-header">
        <div>
          <div className="vendor-omp-auth-list-title">
            {t("settings.vendor.omp.authProviders", {
              defaultValue: "全部供应商",
            })}
          </div>
          <div className="vendor-omp-auth-list-count">
            {t("settings.vendor.omp.providerCount", {
              count: providers.length,
              defaultValue: `${providers.length} 个可登录供应商`,
            })}
          </div>
        </div>
        <input
          type="text"
          className="vendor-omp-auth-search"
          value={searchQuery}
          placeholder={t("settings.vendor.omp.searchProviders", {
            defaultValue: "搜索供应商…",
          })}
          aria-label={t("settings.vendor.omp.searchProviders", {
            defaultValue: "搜索供应商…",
          })}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>
      <div className="vendor-omp-auth-provider-list">
        {providers.length === 0 ? (
          <div className="vendor-omp-auth-empty">
            {providerError ??
              t("settings.vendor.omp.noProviders", {
                defaultValue: "暂无可用供应商，请先确认 OMP CLI 已安装。",
              })}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="vendor-omp-auth-empty">
            {t("settings.vendor.omp.noMatchingProviders", {
              defaultValue: "没有匹配的供应商",
            })}
          </div>
        ) : (
          visibleRows.map((row) => (
            <div
              className={`vendor-omp-auth-provider-card${
                row.account ? " is-logged-in" : ""
              }`}
              key={row.id}
            >
              <div className="vendor-omp-auth-provider-icon" aria-hidden="true">
                {row.iconSrc ? (
                  <ProviderBrandIconImg src={row.iconSrc} />
                ) : (
                  row.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="vendor-omp-auth-provider-copy">
                <div className="vendor-omp-auth-provider-name">
                  {row.name}
                  {row.account ? (
                    <span className="vendor-omp-auth-badge">
                      {t("settings.vendor.omp.loggedInBadge", {
                        defaultValue: "已登录",
                      })}
                    </span>
                  ) : null}
                </div>
                <code className="vendor-omp-auth-provider-id">{row.id}</code>
              </div>
              <div className="vendor-omp-auth-provider-actions">
                {row.account ? (
                  <button
                    type="button"
                    className="vendor-omp-auth-btn"
                    onClick={() => launch("logout", row.id)}
                  >
                    {t("settings.vendor.omp.logout", {
                      defaultValue: "退出登录",
                    })}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="vendor-omp-auth-btn vendor-omp-auth-btn-primary"
                    onClick={() => launch("login", row.id)}
                  >
                    {t("settings.vendor.omp.login", { defaultValue: "登录" })}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
