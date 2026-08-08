import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { CodexCustomModel } from "../types";
import { isValidModelId } from "../types";
import {
  LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
  normalizeProviderProfileId,
  providerDisplayName,
  resolveDefaultProviderOptionId,
  type CustomModelProviderOption,
} from "../customModelProviderBinding";

const EMPTY_PROVIDER_OPTIONS: CustomModelProviderOption[] = [];

interface CustomModelDialogProps {
  isOpen: boolean;
  models: CodexCustomModel[];
  onModelsChange: (models: CodexCustomModel[]) => void;
  onClose: () => void;
  initialAddMode?: boolean;
  modelValidation?: "model-id" | "shape-only";
  /** When empty, provider binding UI is hidden (legacy / gemini). */
  providerOptions?: CustomModelProviderOption[];
  /** Preferred default when opening add mode. */
  defaultProviderProfileId?: string | null;
  /** Persist/provider dual-write failure surface (optional). */
  persistError?: string | null;
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
}

export function CustomModelDialog({
  isOpen,
  models,
  onModelsChange,
  onClose,
  initialAddMode = false,
  modelValidation = "model-id",
  providerOptions = EMPTY_PROVIDER_OPTIONS,
  defaultProviderProfileId = null,
  persistError = null,
}: CustomModelDialogProps) {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [editingModel, setEditingModel] = useState<CodexCustomModel | null>(
    null,
  );
  const [modelId, setModelId] = useState("");
  const [modelLabel, setModelLabel] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [providerOptionId, setProviderOptionId] = useState(
    LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  /** True after open edge; used so async providerOptions never wipe typed fields. */
  const wasOpenRef = useRef(false);
  /** User manually changed provider select in this add/edit session. */
  const userTouchedProviderRef = useRef(false);

  const providerBindingEnabled = providerOptions.length > 0;
  const localProviderLabel = t("settings.vendor.modelManager.localProvider", {
    defaultValue: "本地配置",
  });

  const providerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of providerOptions) {
      if (option.id) {
        map.set(option.id, option.name);
      }
    }
    return map;
  }, [providerOptions]);

  const resolveProviderDefault = useCallback(
    () =>
      resolveDefaultProviderOptionId(
        providerOptions,
        defaultProviderProfileId,
        null,
      ),
    [defaultProviderProfileId, providerOptions],
  );

  const resetEditorFields = useCallback(() => {
    setModelId("");
    setModelLabel("");
    setModelDescription("");
    setValidationError(null);
    userTouchedProviderRef.current = false;
    setProviderOptionId(resolveProviderDefault());
  }, [resolveProviderDefault]);

  // Open edge only: enter add mode once. Do NOT depend on providerOptions identity
  // (async load would otherwise clear mid-typing fields).
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      userTouchedProviderRef.current = false;
      if (initialAddMode) {
        setIsAdding(true);
        setEditingModel(null);
        resetEditorFields();
      }
      return;
    }
    if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
      setIsAdding(false);
      setEditingModel(null);
      setModelId("");
      setModelLabel("");
      setModelDescription("");
      setProviderOptionId(LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID);
      setValidationError(null);
      userTouchedProviderRef.current = false;
    }
  }, [initialAddMode, isOpen, resetEditorFields]);

  // Soft-update provider default when options / preferred arrive asynchronously.
  // Never clears model id/label/description. Respects user manual selection.
  useEffect(() => {
    if (!isOpen || !isAdding || editingModel) {
      return;
    }
    if (userTouchedProviderRef.current) {
      return;
    }
    const nextDefault = resolveProviderDefault();
    setProviderOptionId((prev) => {
      const prevStillValid =
        prev === LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID ||
        providerOptions.some((option) => option.id === prev);
      // Keep a still-valid non-local selection; only promote from local/missing.
      if (
        prevStillValid &&
        prev !== LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID &&
        prev.trim().length > 0
      ) {
        return prev;
      }
      return nextDefault;
    });
  }, [
    defaultProviderProfileId,
    editingModel,
    isAdding,
    isOpen,
    providerOptions,
    resolveProviderDefault,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const modelIds = useMemo(() => new Set(models.map((item) => item.id)), [models]);

  const validateModelId = useCallback(
    (value: string): string | null => {
      const normalized = value.trim();
      if (!normalized) {
        return t("settings.vendor.modelManager.modelIdRequired");
      }
      if (modelValidation === "model-id" && !isValidModelId(normalized)) {
        return t("settings.vendor.modelManager.modelIdInvalid");
      }

      if (editingModel && editingModel.id === normalized) {
        return null;
      }
      if (modelIds.has(normalized)) {
        return t("settings.vendor.modelManager.modelIdDuplicate");
      }
      return null;
    },
    [editingModel, modelIds, modelValidation, t],
  );

  const resetEditor = useCallback(() => {
    setIsAdding(false);
    setEditingModel(null);
    resetEditorFields();
  }, [resetEditorFields]);

  const handleStartAdd = useCallback(() => {
    setIsAdding(true);
    setEditingModel(null);
    resetEditorFields();
  }, [resetEditorFields]);

  const handleStartEdit = useCallback(
    (model: CodexCustomModel) => {
      setIsAdding(true);
      setEditingModel(model);
      setModelId(model.id);
      setModelLabel(model.label);
      setModelDescription(model.description ?? "");
      setValidationError(null);
      userTouchedProviderRef.current = false;
      const owned = normalizeProviderProfileId(model.providerProfileId);
      if (owned && providerOptions.some((option) => option.id === owned)) {
        setProviderOptionId(owned);
      } else {
        setProviderOptionId(LOCAL_CUSTOM_MODEL_PROVIDER_OPTION_ID);
      }
    },
    [providerOptions],
  );

  const handleDelete = useCallback(
    (id: string) => {
      onModelsChange(models.filter((model) => model.id !== id));
    },
    [models, onModelsChange],
  );

  const handleSave = useCallback(() => {
    const error = validateModelId(modelId);
    if (error) {
      setValidationError(error);
      return;
    }

    const normalizedId = stripControlCharacters(modelId).trim();
    const normalizedLabel =
      stripControlCharacters(modelLabel).trim() || normalizedId;
    const normalizedDescription = stripControlCharacters(modelDescription).trim();
    const boundProviderId = providerBindingEnabled
      ? normalizeProviderProfileId(providerOptionId)
      : normalizeProviderProfileId(editingModel?.providerProfileId);

    const nextModel: CodexCustomModel = {
      id: normalizedId,
      label: normalizedLabel,
      description: normalizedDescription || undefined,
      providerProfileId: boundProviderId ?? undefined,
    };

    if (editingModel) {
      onModelsChange(
        models.map((model) => (model.id === editingModel.id ? nextModel : model)),
      );
    } else {
      onModelsChange([...models, nextModel]);
    }
    resetEditor();
  }, [
    editingModel,
    modelDescription,
    modelId,
    modelLabel,
    models,
    onModelsChange,
    providerBindingEnabled,
    providerOptionId,
    resetEditor,
    validateModelId,
  ]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="vendor-dialog-overlay" onClick={onClose}>
      <div
        className="vendor-dialog vendor-dialog-wide vendor-model-manager-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vendor-dialog-header">
          <h3>{t("settings.vendor.modelManager.title")}</h3>
          <button
            type="button"
            className="vendor-dialog-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        <div className="vendor-dialog-body">
          <div className="vendor-model-manager-toolbar">
            <div className="vendor-hint">{t("settings.vendor.modelManager.description")}</div>
            {!isAdding && (
              <button
                type="button"
                className="vendor-btn-save vendor-model-manager-add-btn"
                onClick={handleStartAdd}
              >
                + {t("settings.vendor.modelManager.addModel")}
              </button>
            )}
          </div>

          <div className="vendor-model-manager-list" role="list">
            {models.length === 0 && !isAdding ? (
              <div className="vendor-empty">{t("settings.vendor.modelManager.empty")}</div>
            ) : (
              models.map((model) => (
                <div key={model.id} className="vendor-model-manager-item" role="listitem">
                  <div className="vendor-model-manager-main">
                    <div className="vendor-model-manager-id">{model.id}</div>
                    {model.label !== model.id && (
                      <div className="vendor-model-manager-label">{model.label}</div>
                    )}
                    {model.description && (
                      <div className="vendor-model-manager-desc">{model.description}</div>
                    )}
                    {providerBindingEnabled ? (
                      <div className="vendor-model-manager-provider">
                        {providerDisplayName(
                          model.providerProfileId,
                          providerNameById,
                          localProviderLabel,
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="vendor-model-manager-actions">
                    <button
                      type="button"
                      className="vendor-btn-icon"
                      onClick={() => handleStartEdit(model)}
                      title={t("settings.vendor.edit")}
                    >
                      <Pencil aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="vendor-btn-icon vendor-btn-danger"
                      onClick={() => handleDelete(model.id)}
                      title={t("settings.vendor.delete")}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {isAdding ? (
            <div className="vendor-model-manager-form">
              {providerBindingEnabled ? (
                <div className="vendor-form-group">
                  <label htmlFor="vendor-custom-model-provider">
                    {t("settings.vendor.modelManager.provider", {
                      defaultValue: "供应商",
                    })}
                  </label>
                  <select
                    id="vendor-custom-model-provider"
                    className="vendor-input vendor-input-sm"
                    value={providerOptionId}
                    onChange={(event) => {
                      userTouchedProviderRef.current = true;
                      setProviderOptionId(event.target.value);
                    }}
                    data-testid="custom-model-provider-select"
                  >
                    {providerOptions.map((option) => (
                      <option key={option.id || "__local__"} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="vendor-model-add">
                <input
                  type="text"
                  className="vendor-input vendor-input-sm"
                  value={modelId}
                  onChange={(event) => {
                    setModelId(event.target.value);
                    if (validationError) {
                      setValidationError(null);
                    }
                  }}
                  placeholder={t("settings.vendor.modelManager.modelIdPlaceholder")}
                  autoFocus={!providerBindingEnabled}
                />
                <input
                  type="text"
                  className="vendor-input vendor-input-sm"
                  value={modelLabel}
                  onChange={(event) => setModelLabel(event.target.value)}
                  placeholder={t("settings.vendor.modelManager.modelLabelPlaceholder")}
                />
              </div>
              <input
                type="text"
                className="vendor-input vendor-input-sm"
                value={modelDescription}
                onChange={(event) => setModelDescription(event.target.value)}
                placeholder={t(
                  "settings.vendor.modelManager.modelDescriptionPlaceholder",
                )}
              />
              {validationError && (
                <div className="vendor-json-error">{validationError}</div>
              )}
              <div className="vendor-model-manager-form-actions">
                <button
                  type="button"
                  className="vendor-btn-cancel"
                  onClick={resetEditor}
                >
                  {t("settings.vendor.cancel")}
                </button>
                <button
                  type="button"
                  className="vendor-btn-save"
                  onClick={handleSave}
                  disabled={!modelId.trim()}
                >
                  {editingModel
                    ? t("settings.vendor.dialog.saveChanges")
                    : t("settings.vendor.modelManager.addModel")}
                </button>
              </div>
            </div>
          ) : null}

          {persistError ? (
            <div className="vendor-json-error" role="alert">
              {persistError}
            </div>
          ) : null}
        </div>

        <div className="vendor-dialog-footer">
          <button type="button" className="vendor-btn-save" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
