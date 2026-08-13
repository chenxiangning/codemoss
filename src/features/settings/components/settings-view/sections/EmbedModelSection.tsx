/**
 * 本地语义模型管理 + 检索模式开关 + 效果示意（默认折叠）。
 */
import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useProjectMemoryEmbedModel } from "@/features/project-memory/hooks/useProjectMemoryEmbedModel";
import {
  getSemanticRetrievalPreference,
  setSemanticRetrievalPreference,
  type SemanticRetrievalPreference,
} from "@/features/project-memory/utils/semanticRetrievalPreference";
import { formatDownloadSize } from "@/utils/formatting";
import { MemoryReferencePreview } from "./MemoryReferencePreview";
import "@/styles/memory-reference-settings-preview.css";

type EmbedModelSectionProps = {
  active: boolean;
  t: TFunction;
};

export function EmbedModelSection({ active, t }: EmbedModelSectionProps) {
  const { status, modelDir, modelPath, download, remove } =
    useProjectMemoryEmbedModel();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [retrievalPref, setRetrievalPref] =
    useState<SemanticRetrievalPreference>("semantic");

  useEffect(() => {
    setRetrievalPref(getSemanticRetrievalPreference());
  }, [active]);

  if (!active) {
    return null;
  }

  const downloading = status?.state === "downloading";
  const ready = status?.state === "ready";
  const disabled = status?.state === "disabled";
  const progress = downloading ? status : null;
  const displayPath = modelPath || modelDir;
  const semanticToggleOn = retrievalPref === "semantic";
  // 无 ONNX runtime 时禁止开启语义；下载中也不切换
  const semanticToggleDisabled = disabled || (!ready && !downloading);

  const onToggleSemantic = (next: boolean) => {
    const pref: SemanticRetrievalPreference = next ? "semantic" : "lexical";
    setSemanticRetrievalPreference(pref);
    setRetrievalPref(pref);
  };

  return (
    <section className="settings-section">
      <div className="mref-rules-card">
        <div className="settings-field-label">
          {t("settings.memoryRulesTitle", { defaultValue: "项目记忆规则" })}
        </div>
        <ul className="mref-rules-list">
          <li>
            {t("settings.memoryRulesStorage", {
              defaultValue:
                "存储位置：本机 ~/.ccgui/project-memory/，按工作区隔离；不会上传到云端。",
            })}
          </li>
          <li>
            {t("settings.memoryRulesWrite", {
              defaultValue:
                "写入规则：对话回合结束后自动采集（可在工作区关闭）；支持手动新增/编辑/删除；敏感内容会脱敏与去重。",
            })}
          </li>
          <li>
            {t("settings.memoryRulesRead", {
              defaultValue:
                "使用规则：Composer 开启记忆参考后，发送前本地检索并让你确认注入；默认可关键词匹配，下载语义模型后可提升模糊召回。",
            })}
          </li>
          <li>
            {t("settings.memoryRulesInject", {
              defaultValue:
                "注入规则：记忆仅作当前用户原文的参考（prior context），用户气泡只显示原文；注入失败不阻塞发送。",
            })}
          </li>
        </ul>
      </div>

      <div className="mref-model-card">
        <div className="settings-field">
          <div className="settings-field-label">
            {t("settings.memoryEmbedModelTitle")}
          </div>
          <div className="settings-help">
            {t("settings.memoryEmbedModelDesc")}
          </div>
        </div>

        {status && (
          <div className="settings-field mref-model-card__status-block">
            <div className="mref-model-card__status-row">
              <div className="mref-model-card__status-copy">
                <div className="settings-field-label">
                  {t("settings.modelStatus")}
                </div>
                <div className="settings-help">
                  {ready && t("settings.modelReady")}
                  {disabled &&
                    t("settings.memoryEmbedRuntimeDisabled", {
                      defaultValue:
                        "当前版本未包含本地语义推理运行时，记忆参考使用关键词匹配。",
                    })}
                  {status.state === "missing" && t("settings.modelNotDownloaded")}
                  {downloading && t("settings.modelDownloading")}
                  {status.state === "error" &&
                    (status.error || t("settings.modelDownloadError"))}
                </div>
              </div>
              <div className="mref-model-card__actions">
                {(status.state === "missing" && status.downloadable) ||
                status.state === "error" ? (
                  <button
                    type="button"
                    className="primary"
                    disabled={removing}
                    onClick={() => void download()}
                  >
                    {t(
                      status.state === "error"
                        ? "settings.retryDownload"
                        : "settings.downloadModel",
                      {
                        defaultValue:
                          status.state === "error" ? "重试下载" : "下载模型",
                      },
                    )}
                  </button>
                ) : null}
                {ready ||
                (status.state === "error" && Boolean(status.modelPath)) ? (
                  <button
                    type="button"
                    className="danger"
                    disabled={removing || downloading}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    {t("settings.memoryEmbedDeleteModel", {
                      defaultValue: "删除模型",
                    })}
                  </button>
                ) : null}
              </div>
            </div>

            {displayPath ? (
              <div className="mref-model-card__path">
                <div className="settings-field-label">
                  {t("settings.memoryEmbedModelPath", {
                    defaultValue: "存储位置",
                  })}
                </div>
                <div
                  className="settings-help mref-model-card__path-value"
                  title={displayPath}
                >
                  {displayPath}
                </div>
              </div>
            ) : null}

            {progress && (
              <div className="settings-download-progress">
                <div className="settings-download-bar">
                  <div
                    className="settings-download-fill"
                    style={{
                      width: progress.totalBytes
                        ? `${Math.min(
                            100,
                            (progress.downloadedBytes / progress.totalBytes) *
                              100,
                          )}%`
                        : "0%",
                    }}
                  />
                </div>
                <div className="settings-download-meta">
                  {progress.totalBytes > 0
                    ? `${Math.round(
                        (progress.downloadedBytes / progress.totalBytes) * 100,
                      )}% · ${formatDownloadSize(progress.downloadedBytes)} / ${formatDownloadSize(progress.totalBytes)}`
                    : t(
                        progress.phase === "tokenizer"
                          ? "settings.memoryEmbedPhaseTokenizer"
                          : "settings.memoryEmbedPhaseModel",
                      )}
                </div>
              </div>
            )}

            {status.state === "missing" && !status.downloadable && (
              <div className="settings-help">
                {t("settings.memoryEmbedNotDownloadable")}
              </div>
            )}
            {disabled ? (
              <div className="settings-help">
                {t("settings.memoryEmbedRuntimeDisabledHint", {
                  defaultValue:
                    "已移除 ONNX Runtime 以恢复 Intel macOS 打包；语义向量检索将在后续可跨平台方案中恢复。",
                })}
              </div>
            ) : null}
          </div>
        )}

        <div className="settings-field mref-model-card__toggle-block">
          <div className="mref-model-card__toggle-row">
            <div className="mref-model-card__toggle-copy">
              <div className="settings-field-label">
                {t("settings.memorySemanticRetrievalToggle", {
                  defaultValue: "检索时使用语义模型",
                })}
              </div>
              <div className="settings-help">
                {t("settings.memorySemanticRetrievalToggleDesc", {
                  defaultValue:
                    "关闭后即使已下载模型，也只用默认文本检索。可随时再打开。",
                })}
              </div>
            </div>
            <label
              className={`mref-switch${semanticToggleDisabled ? " is-disabled" : ""}`}
              title={
                semanticToggleDisabled
                  ? t("settings.memorySemanticRetrievalNeedModel", {
                      defaultValue: "请先下载并就绪语义模型",
                    })
                  : undefined
              }
            >
              <input
                type="checkbox"
                role="switch"
                checked={semanticToggleOn}
                disabled={semanticToggleDisabled}
                onChange={(event) => onToggleSemantic(event.target.checked)}
                aria-label={t("settings.memorySemanticRetrievalToggle", {
                  defaultValue: "检索时使用语义模型",
                })}
              />
              <span className="mref-switch__track" aria-hidden>
                <span className="mref-switch__thumb" />
              </span>
            </label>
          </div>
          {ready && !semanticToggleOn ? (
            <div className="settings-help mref-model-card__toggle-hint">
              {t("settings.memorySemanticRetrievalLexicalHint", {
                defaultValue: "当前：默认文本检索（关键词）",
              })}
            </div>
          ) : null}
          {ready && semanticToggleOn ? (
            <div className="settings-help mref-model-card__toggle-hint">
              {t("settings.memorySemanticRetrievalSemanticHint", {
                defaultValue: "当前：语义模型检索（可用时 hybrid）",
              })}
            </div>
          ) : null}
        </div>
      </div>

      <MemoryReferencePreview t={t} defaultCollapsed />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t("settings.memoryEmbedDeleteModel", {
          defaultValue: "删除模型",
        })}
        body={t("settings.memoryEmbedDeleteConfirm", {
          defaultValue:
            "确定删除本地语义模型？删除后记忆参考将回退为关键词匹配，可随时重新下载。",
        })}
        danger
        confirmText={t("settings.memoryEmbedDeleteModel", {
          defaultValue: "删除模型",
        })}
        cancelText={t("common.cancel", { defaultValue: "取消" })}
        onCancel={() => {
          if (!removing) {
            setDeleteConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void (async () => {
            setRemoving(true);
            try {
              await remove();
            } finally {
              setRemoving(false);
              setDeleteConfirmOpen(false);
            }
          })();
        }}
      />
    </section>
  );
}
