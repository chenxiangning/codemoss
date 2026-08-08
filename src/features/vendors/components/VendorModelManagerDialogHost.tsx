import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadVendorModelManagerStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";
import { getClaudeProviders, getCodexProviders } from "../../../services/tauri";
import type { CodexCustomModel, CodexProviderConfig, ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID, STORAGE_KEYS } from "../types";
import {
  consumeVendorModelManagerRequest,
  VENDOR_MODEL_MANAGER_REQUEST_EVENT,
  type VendorModelManagerTarget,
} from "../modelManagerRequest";
import { usePluginModels } from "../hooks/usePluginModels";
import { CustomModelDialog } from "./CustomModelDialog";
import {
  buildManagedProviderOptions,
  resolveDefaultProviderOptionId,
  type CustomModelProviderOption,
} from "../customModelProviderBinding";
import {
  persistClaudeCustomModelCatalog,
  persistCodexCustomModelCatalog,
} from "../persistCustomModelCatalog";
import { mergeClaudeProviderCustomModelsIntoStore } from "../hooks/useProviderManagement";
import { mergeCodexProviderCustomModelsIntoStore } from "../hooks/useCodexProviderManagement";

function storageKeyForTarget(target: VendorModelManagerTarget): string {
  if (target === "codex") {
    return STORAGE_KEYS.CODEX_CUSTOM_MODELS;
  }
  if (target === "gemini") {
    return STORAGE_KEYS.GEMINI_CUSTOM_MODELS;
  }
  return STORAGE_KEYS.CLAUDE_CUSTOM_MODELS;
}

/**
 * 全局宿主:在当前页面直接弹出自定义模型管理弹窗,
 * 避免「添加模型」再跳进设置页造成割裂。
 * 与设置页内的 CustomModelDialog 共用 localStorage + 事件协议。
 *
 * vendor-dialog / model-manager 样式挂在 settings.css 懒加载 chunk 上；
 * 从对话页打开时必须显式 load，否则会出现无遮罩/无卡片/裸文本的样式丢失。
 */
export function VendorModelManagerDialogHost() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [target, setTarget] = useState<VendorModelManagerTarget>("claude");
  const [preferredProviderProfileId, setPreferredProviderProfileId] = useState<
    string | null
  >(null);
  const [claudeProviders, setClaudeProviders] = useState<ProviderConfig[]>([]);
  const [codexProviders, setCodexProviders] = useState<CodexProviderConfig[]>(
    [],
  );
  const [persistError, setPersistError] = useState<string | null>(null);
  // 未打开设置页时 settings.css 不会加载；弹窗打开时按需注入 dialog 样式切片，
  // 避免为弹窗整包加载 settings.css。
  const stylesReady = useFeatureStylesReady(loadVendorModelManagerStyles, open);

  const storageKey = useMemo(() => storageKeyForTarget(target), [target]);
  const { models, updateModels } = usePluginModels(storageKey);

  const loadProvidersForTarget = useCallback(async (nextTarget: VendorModelManagerTarget) => {
    if (nextTarget === "codex") {
      try {
        const list = await getCodexProviders();
        setCodexProviders(list);
        mergeCodexProviderCustomModelsIntoStore(list);
      } catch {
        setCodexProviders([]);
      }
      return;
    }
    if (nextTarget === "claude") {
      try {
        const list = await getClaudeProviders();
        setClaudeProviders(list);
        mergeClaudeProviderCustomModelsIntoStore(list);
      } catch {
        setClaudeProviders([]);
      }
    }
  }, []);

  const applyRequest = useCallback(() => {
    const request = consumeVendorModelManagerRequest();
    if (!request) {
      return;
    }
    setTarget(request.target);
    setAddMode(Boolean(request.addMode));
    setPreferredProviderProfileId(
      request.preferredProviderProfileId?.trim() || null,
    );
    setPersistError(null);
    setOpen(true);
    void loadProvidersForTarget(request.target);
  }, [loadProvidersForTarget]);

  useEffect(() => {
    applyRequest();
    const handleRequest = () => applyRequest();
    window.addEventListener(VENDOR_MODEL_MANAGER_REQUEST_EVENT, handleRequest);
    return () => {
      window.removeEventListener(
        VENDOR_MODEL_MANAGER_REQUEST_EVENT,
        handleRequest,
      );
    };
  }, [applyRequest]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setAddMode(false);
    setPreferredProviderProfileId(null);
    setPersistError(null);
  }, []);

  const localLabel = t("settings.vendor.modelManager.localProvider", {
    defaultValue: "本地配置",
  });

  const providerOptions: CustomModelProviderOption[] = useMemo(() => {
    if (target === "codex") {
      return buildManagedProviderOptions(codexProviders, localLabel);
    }
    if (target === "claude") {
      return buildManagedProviderOptions(claudeProviders, localLabel, [
        LOCAL_SETTINGS_PROVIDER_ID,
      ]);
    }
    return [];
  }, [claudeProviders, codexProviders, localLabel, target]);

  const activeProviderProfileId = useMemo(() => {
    if (target === "codex") {
      return codexProviders.find((provider) => provider.isActive)?.id ?? null;
    }
    if (target === "claude") {
      return (
        claudeProviders.find(
          (provider) =>
            provider.isActive &&
            !provider.isLocalProvider &&
            provider.id !== LOCAL_SETTINGS_PROVIDER_ID,
        )?.id ?? null
      );
    }
    return null;
  }, [claudeProviders, codexProviders, target]);

  const defaultProviderProfileId = useMemo(
    () =>
      resolveDefaultProviderOptionId(
        providerOptions,
        preferredProviderProfileId,
        activeProviderProfileId,
      ),
    [activeProviderProfileId, preferredProviderProfileId, providerOptions],
  );

  const handleModelsChange = useCallback(
    (next: CodexCustomModel[]) => {
      // Catalog first (optimistic, event-driven picker refresh). Provider dual-write
      // is serialised; failures surface but do not rewrite session selection paths.
      updateModels(next);
      setPersistError(null);
      if (target === "codex") {
        void persistCodexCustomModelCatalog(next, codexProviders)
          .then(() => loadProvidersForTarget("codex"))
          .catch((error: unknown) => {
            setPersistError(
              error instanceof Error
                ? error.message
                : t("settings.vendor.modelManager.persistFailed", {
                    defaultValue: "同步供应商自定义模型失败，请重试。",
                  }),
            );
          });
        return;
      }
      if (target === "claude") {
        void persistClaudeCustomModelCatalog(next, claudeProviders)
          .then(() => loadProvidersForTarget("claude"))
          .catch((error: unknown) => {
            setPersistError(
              error instanceof Error
                ? error.message
                : t("settings.vendor.modelManager.persistFailed", {
                    defaultValue: "同步供应商自定义模型失败，请重试。",
                  }),
            );
          });
      }
    },
    [
      claudeProviders,
      codexProviders,
      loadProvidersForTarget,
      t,
      target,
      updateModels,
    ],
  );

  return (
    <CustomModelDialog
      isOpen={open && stylesReady}
      models={models}
      onModelsChange={handleModelsChange}
      onClose={handleClose}
      initialAddMode={addMode}
      modelValidation={target === "claude" ? "shape-only" : "model-id"}
      providerOptions={providerOptions}
      defaultProviderProfileId={defaultProviderProfileId}
      persistError={persistError}
    />
  );
}
