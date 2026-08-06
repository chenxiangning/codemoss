import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { pushErrorToast } from "../../../services/toasts";
import {
  cloneStage,
  createBlankTemplate,
  deleteCustomTemplate,
  getDefaultTemplateId,
  getTemplateById,
  saveCustomTemplate,
  setDefaultTemplate,
  useTemplateCatalogSnapshot,
} from "../templates/templateStore";
import type {
  CollaborationTemplate,
  CollaborationTemplateStage,
} from "../templates/types";
import { templateApprovalCount, templateFlowLabel } from "../templates/types";
import { isCompleteAgentTargetForUi } from "../templates/targetCompleteness";
import { StageTargetPicker } from "./StageTargetPicker";

type TemplateManagerModalProps = {
  open: boolean;
  initialTemplateId?: string | null;
  onClose: () => void;
};

function emptyEditor(template: CollaborationTemplate): CollaborationTemplate {
  return {
    ...template,
    stages: template.stages.map((stage) => ({
      ...stage,
      target: { ...stage.target },
    })),
  };
}

export function TemplateManagerModal({
  open,
  initialTemplateId,
  onClose,
}: TemplateManagerModalProps) {
  const { t } = useTranslation();
  const catalog = useTemplateCatalogSnapshot();
  const [activeId, setActiveId] = useState(
    initialTemplateId ?? catalog.selectedId,
  );
  const [draft, setDraft] = useState<CollaborationTemplate>(() =>
    emptyEditor(getTemplateById(activeId)),
  );
  const [query, setQuery] = useState("");

  // 仅 open / 显式切模板时 hydrate draft，避免 store 重渲打断输入焦点
  useEffect(() => {
    if (!open) return;
    const id = initialTemplateId ?? catalog.selectedId;
    setActiveId(id);
    setDraft(emptyEditor(getTemplateById(id)));
    setQuery("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意不依赖 catalog 全量，防失焦
  }, [open, initialTemplateId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.templates;
    return catalog.templates.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }, [catalog.templates, query]);

  const builtins = filtered.filter((item) => item.builtin);
  const customs = filtered.filter((item) => !item.builtin);
  const isBuiltinOrigin = draft.builtin;
  const makeDefault =
    draft.id === getDefaultTemplateId() || draft.id === catalog.defaultId;

  if (!open) return null;

  const pick = (id: string) => {
    setActiveId(id);
    setDraft(emptyEditor(getTemplateById(id)));
  };

  const startNew = () => {
    const blank = createBlankTemplate();
    setActiveId(blank.id);
    setDraft(emptyEditor(blank));
  };

  const updateStage = (
    index: number,
    patch: Partial<CollaborationTemplateStage>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, i) =>
        i === index ? { ...stage, ...patch } : stage,
      ),
    }));
  };

  const removeStage = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      stages: prev.stages.filter((_, i) => i !== index),
    }));
  };

  const addStage = () => {
    setDraft((prev) => ({
      ...prev,
      stages: [
        ...prev.stages,
        cloneStage({
          title: t("multiAgent.template.stageFallback", {
            n: prev.stages.length + 1,
          }),
        }),
      ],
    }));
  };

  const moveStage = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const next = index + delta;
      if (next < 0 || next >= prev.stages.length) return prev;
      const stages = [...prev.stages];
      const [row] = stages.splice(index, 1);
      stages.splice(next, 0, row!);
      return { ...prev, stages };
    });
  };

  const save = () => {
    if (!draft.name.trim()) {
      pushErrorToast({
        title: t("multiAgent.template.savedTitle"),
        message: t("multiAgent.template.nameRequired", {
          defaultValue: "请填写模板名称",
        }),
      });
      return;
    }
    if (draft.stages.length === 0) {
      pushErrorToast({
        title: t("multiAgent.template.savedTitle"),
        message: t("multiAgent.template.stageRequired", {
          defaultValue: "至少保留一个环节",
        }),
      });
      return;
    }
    const incomplete = draft.stages.filter(
      (s) => !isCompleteAgentTargetForUi(s.target),
    );
    // 允许保存不完整 target（发送时回退会话 target），但明确提示
    const saved = saveCustomTemplate({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      builtin: false,
    });
    if (makeDefault) setDefaultTemplate(saved.id);
    setActiveId(saved.id);
    setDraft(emptyEditor(saved));
    pushErrorToast({
      variant: "success",
      title: t("multiAgent.template.savedTitle"),
      message:
        incomplete.length > 0
          ? t("multiAgent.template.savedWithIncomplete", {
              name: saved.name,
              count: incomplete.length,
              defaultValue: `已保存「${saved.name}」· ${incomplete.length} 个环节未配齐模型，发送时将使用当前会话配置`,
            })
          : t("multiAgent.template.saved", { name: saved.name }),
    });
  };

  const remove = () => {
    // 内置原始不可删；已覆盖为 custom 的可删
    if (isBuiltinOrigin && !catalog.templates.some((item) => item.id === draft.id && !item.builtin)) {
      pushErrorToast({
        title: t("multiAgent.template.delete"),
        message: t("multiAgent.template.builtinReadonly"),
      });
      return;
    }
    deleteCustomTemplate(draft.id);
    pushErrorToast({
      variant: "success",
      title: t("multiAgent.template.deletedTitle"),
      message: t("multiAgent.template.deleted", { name: draft.name }),
    });
    const fallback = getDefaultTemplateId();
    pick(fallback);
  };

  const stopFieldMouseDown = (event: MouseEvent) => {
    // 防止父层 mousedown / 选择器抢焦点
    event.stopPropagation();
  };

  const modal = (
    <div
      className="ma-tpl-overlay"
      data-composer-portal-focus-guard
      role="dialog"
      aria-modal="true"
      aria-label={t("multiAgent.template.modalTitle")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="ma-tpl-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ma-tpl-modal-head">
          <div>
            <div className="ma-tpl-modal-title">
              {t("multiAgent.template.modalTitle")}
            </div>
            <div className="ma-tpl-modal-sub">
              {t("multiAgent.template.modalSub")}
            </div>
          </div>
          <button type="button" className="ma-tpl-close" onClick={onClose}>
            {t("multiAgent.template.close")}
          </button>
        </header>

        <div className="ma-tpl-body">
          <aside className="ma-tpl-list">
            <input
              className="ma-tpl-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onMouseDown={stopFieldMouseDown}
              placeholder={t("multiAgent.template.search")}
            />
            {builtins.length > 0 ? (
              <>
                <div className="ma-tpl-grp">
                  {t("multiAgent.template.builtin")}
                </div>
                {builtins.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`ma-tpl-item${activeId === item.id ? " is-on" : ""}`}
                    onClick={() => pick(item.id)}
                  >
                    <div className="ma-tpl-item-nm">
                      {item.name}
                      {item.id === catalog.defaultId ? (
                        <span className="ma-tpl-def">
                          {t("multiAgent.template.defaultBadge")}
                        </span>
                      ) : null}
                    </div>
                    <div className="ma-tpl-item-meta">
                      {templateFlowLabel(item)} ·{" "}
                      {t("multiAgent.template.approvalCount", {
                        count: templateApprovalCount(item),
                      })}
                    </div>
                  </button>
                ))}
              </>
            ) : null}
            <div className="ma-tpl-grp">{t("multiAgent.template.mine")}</div>
            {customs.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`ma-tpl-item${activeId === item.id ? " is-on" : ""}`}
                onClick={() => pick(item.id)}
              >
                <div className="ma-tpl-item-nm">{item.name}</div>
                <div className="ma-tpl-item-meta">
                  {templateFlowLabel(item)}
                </div>
              </button>
            ))}
            <button type="button" className="ma-tpl-new" onClick={startNew}>
              {t("multiAgent.template.new")}
            </button>
          </aside>

          <div className="ma-tpl-editor">
            <div className="ma-tpl-row1">
              <input
                className="ma-tpl-name"
                value={draft.name}
                onMouseDown={stopFieldMouseDown}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
              />
              <label className="ma-tpl-mkdef">
                <span
                  className={`ma-tgl${makeDefault ? " is-on" : ""}`}
                  onClick={() => setDefaultTemplate(draft.id)}
                  role="switch"
                  aria-checked={makeDefault}
                />
                {t("multiAgent.template.setDefault")}
              </label>
            </div>
            <input
              className="ma-tpl-desc"
              value={draft.description}
              onMouseDown={stopFieldMouseDown}
              placeholder={t("multiAgent.template.descPlaceholder")}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />

            {draft.stages.map((stage, index) => (
              <div className="ma-step-ed" key={`${stage.id}-${index}`}>
                <div className="ma-step-ed-top">
                  <span className="ma-step-drag" aria-hidden title="排序">
                    <button
                      type="button"
                      className="ma-step-move"
                      disabled={index === 0}
                      onClick={() => moveStage(index, -1)}
                      aria-label="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ma-step-move"
                      disabled={index === draft.stages.length - 1}
                      onClick={() => moveStage(index, 1)}
                      aria-label="下移"
                    >
                      ↓
                    </button>
                  </span>
                  <input
                    className="ma-step-name"
                    value={stage.title}
                    onMouseDown={stopFieldMouseDown}
                    onChange={(event) =>
                      updateStage(index, { title: event.target.value })
                    }
                  />
                  <StageTargetPicker
                    value={stage.target}
                    onChange={(target) => updateStage(index, { target })}
                  />
                  {!isCompleteAgentTargetForUi(stage.target) ? (
                    <span
                      className="ma-stage-incomplete"
                      title={t("multiAgent.template.incompleteTargetHint", {
                        defaultValue:
                          "未配齐 CLI/模型时，发送将使用当前 Shared 会话配置",
                      })}
                    >
                      {t("multiAgent.template.incompleteTarget", {
                        defaultValue: "待配齐",
                      })}
                    </span>
                  ) : null}
                  <label className="ma-appr">
                    <span
                      className={`ma-tgl${stage.requiresApproval ? " is-on" : ""}`}
                      onClick={() =>
                        updateStage(index, {
                          requiresApproval: !stage.requiresApproval,
                        })
                      }
                      role="switch"
                      aria-checked={stage.requiresApproval}
                    />
                    {t("multiAgent.template.requiresApproval")}
                  </label>
                  <button
                    type="button"
                    className="ma-step-del"
                    onClick={() => removeStage(index)}
                    aria-label={t("multiAgent.template.deleteStage")}
                  >
                    🗑
                  </button>
                </div>
                <textarea
                  value={stage.rolePrompt}
                  onMouseDown={stopFieldMouseDown}
                  onChange={(event) =>
                    updateStage(index, { rolePrompt: event.target.value })
                  }
                  placeholder={t("multiAgent.template.promptPlaceholder")}
                />
              </div>
            ))}

            <button type="button" className="ma-add-step" onClick={addStage}>
              {t("multiAgent.template.addStage")}
            </button>

            <div className="ma-tpl-efoot">
              <button type="button" className="ma-danger" onClick={remove}>
                {t("multiAgent.template.delete")}
              </button>
              <button type="button" className="ma-ghost" onClick={onClose}>
                {t("multiAgent.template.cancel")}
              </button>
              <button type="button" className="ma-primary" onClick={save}>
                {t("multiAgent.template.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
