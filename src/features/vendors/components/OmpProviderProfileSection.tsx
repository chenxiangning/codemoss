import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppSettings, getEngineModels, updateAppSettings } from "@/services/tauri";
import { loadSettingsStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import type { EngineModelInfo } from "@/types";
import { OMP_LOCAL_PROVIDER_PROFILE_ID } from "../../threads/constants/codexProviderProfiles";
import {
  normalizeOmpProviderProfile,
  persistOmpProviderProfile,
  readOmpProviderProfile,
  type OmpProviderProfile,
} from "../../engine/omp/ompProviderProfile";

export type OmpProviderProfileSectionProps = {
  initialBinaryPath?: string | null;
  onSaved?: (profile: OmpProviderProfile) => void;
};

type CatalogState =
  | { status: "unknown" }
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; models: EngineModelInfo[] }
  | { status: "error"; message: string };

/**
 * OMP 连接设置：主路径只暴露「可执行文件路径 + 模型目录检测」两个用户能
 * 理解的操作；Profile id / name 是会话绑定元数据（多配置隔离用），降级为
 * 默认折叠的高级选项，避免「不知道这里干什么」。
 */
export function OmpProviderProfileSection({
  initialBinaryPath,
  onSaved,
}: OmpProviderProfileSectionProps) {
  useFeatureStylesReady(loadSettingsStyles);
  const { t } = useTranslation();
  const [profile, setProfile] = useState<OmpProviderProfile | null>(() =>
    readOmpProviderProfile(),
  );
  const [binaryPath, setBinaryPath] = useState(
    initialBinaryPath ?? profile?.binaryPath ?? "",
  );
  const [profileId, setProfileId] = useState(profile?.profileId ?? "");
  const [profileName, setProfileName] = useState(profile?.profileName ?? "");
  const [saveFeedback, setSaveFeedback] = useState<{ kind: "error" | "ok"; message: string } | null>(
    null,
  );
  const [catalog, setCatalog] = useState<CatalogState>({ status: "unknown" });

  useEffect(() => {
    setBinaryPath(initialBinaryPath ?? profile?.binaryPath ?? "");
    setProfileId(profile?.profileId ?? "");
    setProfileName(profile?.profileName ?? "");
  }, [initialBinaryPath, profile]);

  const draft = normalizeOmpProviderProfile({
    binaryPath,
    profileId,
    profileName,
  });

  const handleSave = async () => {
    if (!draft) {
      setSaveFeedback({
        kind: "error",
        message: t("settings.vendor.omp.profileValidation", {
          defaultValue:
            "配置方案标识必填（字母/数字/点/连字符），显示名不能为空。",
        }),
      });
      return;
    }
    setSaveFeedback(null);
    try {
      const settings = await getAppSettings();
      await updateAppSettings({
        ...settings,
        ompBin: draft.binaryPath,
      });
      persistOmpProviderProfile(draft);
      setProfile(draft);
      onSaved?.(draft);
      setSaveFeedback({
        kind: "ok",
        message: t("settings.vendor.omp.saveOk", {
          defaultValue: "已保存。",
        }),
      });
    } catch (error) {
      setSaveFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // 检测不走「先保存」门槛，也绝不把自定义 profileId 传给后端——它会被
  // `omp models` 当位置参数查询并静默返回空目录。恒测本地全量目录。
  const handleDetectCatalog = async () => {
    setCatalog({ status: "loading" });
    try {
      const models = await getEngineModels("omp", {
        forceRefresh: true,
        providerProfileId: OMP_LOCAL_PROVIDER_PROFILE_ID,
      });
      setCatalog(
        models.length === 0 ? { status: "empty" } : { status: "ready", models },
      );
    } catch (error) {
      setCatalog({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const catalogStatusText = (() => {
    switch (catalog.status) {
      case "unknown":
        return t("settings.vendor.omp.catalogUnknown", {
          defaultValue: "尚未检测。检测会运行 omp models，列出当前已登录供应商的全部可用模型。",
        });
      case "loading":
        return t("settings.vendor.omp.catalogLoading", {
          defaultValue: "正在运行 omp models，读取模型目录…",
        });
      case "empty":
        return t("settings.vendor.omp.catalogEmpty", {
          defaultValue: "检测完成，但没有返回任何模型。请先在上方登录至少一个供应商，再重新检测。",
        });
      case "error":
        return catalog.message;
      case "ready":
        return t("settings.vendor.omp.catalogReady", {
          count: catalog.models.length,
          defaultValue: `检测成功：共 ${catalog.models.length} 个模型可用，发消息时可直接在模型选择器中切换。`,
        });
    }
  })();

  return (
    <div className="vendor-omp-provider-profile" data-testid="omp-provider-profile-section">
      <div className="settings-help">
        {t("settings.vendor.omp.profileDescription", {
          defaultValue:
            "MOSSX 通过本机安装的 OMP CLI（oh-my-pi）收发消息。这里负责两件事：指定 OMP 的安装位置、确认模型目录可读。登录供应商请在下方「OMP 供应商登录」完成。",
        })}
      </div>
      <div className="cli-path-field">
        <label className="settings-field-label" htmlFor="omp-binary-path">
          {t("settings.vendor.omp.binaryPath", {
            defaultValue: "OMP 可执行文件路径",
          })}
        </label>
        <input
          id="omp-binary-path"
          className="settings-input"
          value={binaryPath}
          placeholder="omp"
          onChange={(event) => setBinaryPath(event.target.value)}
        />
        <div className="settings-help">
          {t("settings.vendor.omp.binaryPathHint", {
            defaultValue:
              "留空表示使用 PATH 中的 omp 命令；仅当 OMP 安装在非标准位置时才需要填写完整路径。修改后记得点击「保存」。",
          })}
        </div>
      </div>
      <div className="vendor-dialog-footer">
        <button
          type="button"
          className="vendor-btn-save"
          onClick={() => void handleSave()}
          disabled={!draft}
        >
          {t("common.save", { defaultValue: "保存" })}
        </button>
        <button
          type="button"
          className="vendor-btn-cancel"
          onClick={() => void handleDetectCatalog()}
          disabled={catalog.status === "loading"}
        >
          {catalog.status === "loading"
            ? t("settings.loading", { defaultValue: "检测中…" })
            : t("settings.vendor.omp.detectCatalog", {
                defaultValue: "检测模型目录",
              })}
        </button>
        {saveFeedback ? (
          <span
            role={saveFeedback.kind === "error" ? "alert" : "status"}
            className={
              saveFeedback.kind === "error"
                ? "vendor-omp-save-feedback-error"
                : "vendor-omp-save-feedback-ok"
            }
          >
            {saveFeedback.message}
          </span>
        ) : null}
      </div>
      <div
        className="settings-help"
        role="status"
        data-testid="omp-catalog-status"
      >
        {catalogStatusText}
      </div>
      <details className="vendor-omp-advanced">
        <summary className="vendor-omp-advanced-summary">
          {t("settings.vendor.omp.advancedSummary", {
            defaultValue: "高级：配置方案（Profile）",
          })}
        </summary>
        <div className="settings-help">
          {t("settings.vendor.omp.advancedDescription", {
            defaultValue:
              "配置方案用于 OMP 多账号/多供应商隔离与 mossx 会话绑定。只使用一套配置时保持默认即可，无需修改。",
          })}
        </div>
        <div className="cli-path-field">
          <label className="settings-field-label" htmlFor="omp-profile-id">
            {t("settings.vendor.omp.profileId", {
              defaultValue: "配置方案标识（Profile id）",
            })}
          </label>
          <input
            id="omp-profile-id"
            className="settings-input"
            value={profileId}
            placeholder="local-profile"
            onChange={(event) => setProfileId(event.target.value)}
          />
        </div>
        <div className="cli-path-field">
          <label className="settings-field-label" htmlFor="omp-profile-name">
            {t("settings.vendor.omp.profileName", {
              defaultValue: "配置方案显示名",
            })}
          </label>
          <input
            id="omp-profile-name"
            className="settings-input"
            value={profileName}
            placeholder="OMP 本地配置"
            onChange={(event) => setProfileName(event.target.value)}
          />
        </div>
      </details>
    </div>
  );
}
