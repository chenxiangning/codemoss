/**
 * 设置页「记忆参考」静态效果示意（匹配中 / 挑选 / 空结果 / 已注入）。
 * 默认折叠，纯展示。
 */
import { useState } from "react";
import type { TFunction } from "i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import appLogo from "@/assets/icon.png";
import "@/styles/memory-reference-settings-preview.css";

type MemoryReferencePreviewProps = {
  t: TFunction;
  /** 默认 true：折叠示意，减少设置页高度 */
  defaultCollapsed?: boolean;
};

const DEMO_ROWS = [
  { id: "01", title: "对照 Phase-2 合同与代码，核对任务完成度…", score: "1.00" },
  { id: "02", title: "先对照当前 CSS，给出图1空白与图2去色…", score: "1.00" },
  { id: "03", title: "按图1做紧凑状态行，并压掉列表底部空白…", score: "1.00" },
  { id: "04", title: "先定位 toast 的 i18n 与调用点，再改成时间线…", score: "0.98" },
] as const;

export function MemoryReferencePreview({
  t,
  defaultCollapsed = true,
}: MemoryReferencePreviewProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  return (
    <div className={`mref-preview${expanded ? " is-expanded" : " is-collapsed"}`}>
      <button
        type="button"
        className="mref-preview__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="mref-preview__toggle-copy">
          <span className="settings-field-label mref-preview__heading">
            {t("settings.memoryReferencePreviewTitle", {
              defaultValue: "开启后效果示意",
            })}
          </span>
          <span className="settings-help mref-preview__intro">
            {t("settings.memoryReferencePreviewDesc", {
              defaultValue:
                "发送前会先匹配项目记忆，再由你确认注入。以下为静态示意，非真实会话。",
            })}
          </span>
        </span>
        <ChevronDown
          className="mref-preview__chevron"
          size={16}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {expanded ? (
      <div className="mref-preview__grid">
        {/* ① 匹配中 */}
        <div className="mref-preview__card">
          <div className="mref-preview__card-label">
            {t("settings.memoryReferencePreviewMatchLabel", {
              defaultValue: "① 匹配中",
            })}
          </div>
          <div className="mref-preview__mock mref-preview__mock--match">
            <div className="mref-preview__role">
              {t("memoryPick.role", { defaultValue: "记忆参考" })}
              <span className="mref-preview__role-sep">·</span>
              {t("settings.memoryReferencePreviewMatchRole", {
                defaultValue: "发送前 · 本地检索 · 尚未调用模型",
              })}
            </div>
            <div className="mref-preview__match-brand">
              <span className="mref-preview__logo" aria-hidden>
                <img src={appLogo} alt="" draggable={false} />
              </span>
              <span>
                {t("memoryPick.match.brand", {
                  defaultValue: "ccgui · 正在匹配项目记忆",
                })}
              </span>
            </div>
            <div className="mref-preview__dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="mref-preview__sub">
              {t("memoryPick.match.sub", {
                defaultValue:
                  "本地检索中，有结果再选择注入；无结果将自动继续发送…",
              })}
            </p>
          </div>
        </div>

        {/* ② 挑选闸门 */}
        <div className="mref-preview__card mref-preview__card--wide">
          <div className="mref-preview__card-label">
            {t("settings.memoryReferencePreviewPickLabel", {
              defaultValue: "② 挑选并确认",
            })}
          </div>
          <div className="mref-preview__mock mref-preview__mock--pick">
            <div className="mref-preview__toolbar">
              <span className="mref-preview__toolbar-actions">
                <span className="mref-preview__tb-primary">
                  {t("memoryPick.action.confirm", {
                    defaultValue: "确认并发送",
                  })}
                </span>
                <span>
                  {t("memoryPick.action.skip", {
                    defaultValue: "不选，直接发送",
                  })}
                </span>
              </span>
              <span className="mref-preview__count">
                {t("memoryPick.count.pick", {
                  defaultValue: "已选 0 · 默认全不选",
                  n: 0,
                })}
              </span>
              <span className="mref-preview__dismiss">
                {t("memoryPick.action.dismiss", {
                  defaultValue: "本 session 不再提示",
                })}
              </span>
            </div>
            <div className="mref-preview__pick-body">
              <div className="mref-preview__list">
                <div className="mref-preview__list-title">
                  {t("memoryPick.listTitle.pick", {
                    defaultValue: "本轮候选记忆",
                  })}
                </div>
                <div className="mref-preview__list-hint">
                  {t("memoryPick.listHint.pick", {
                    defaultValue: "本轮挑选 · 默认全不选 · 点「详情」看全文",
                  })}
                </div>
                <ul className="mref-preview__rows">
                  {DEMO_ROWS.map((row) => (
                    <li key={row.id} className="mref-preview__row">
                      <span className="mref-preview__check" aria-hidden />
                      <span className="mref-preview__idx">{row.id}</span>
                      <span className="mref-preview__row-title">{row.title}</span>
                      <span className="mref-preview__score">{row.score}</span>
                      <span className="mref-preview__detail">
                        {t("memoryPick.detail", { defaultValue: "详情" })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mref-preview__strategy">
                <div className="mref-preview__list-title">
                  {t("memoryPick.strategyTitle", { defaultValue: "策略" })}
                </div>
                <div className="mref-preview__mode is-on">
                  <span>
                    {t("memoryPick.mode.pick", {
                      defaultValue: "本轮挑选记忆注入",
                    })}
                  </span>
                  <span className="mref-preview__mode-sub">
                    {t("memoryPick.mode.pickSub", {
                      defaultValue: "仅本次 · 手动勾选",
                    })}
                  </span>
                </div>
                <div className="mref-preview__mode">
                  <span>
                    {t("memoryPick.mode.always", {
                      defaultValue: "整轮开启自动 top(n)",
                    })}
                  </span>
                  <span className="mref-preview__mode-sub">
                    {t("memoryPick.mode.alwaysSub", {
                      defaultValue: "本 session · 默认预勾 3 条",
                      k: 3,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ③ 空结果 */}
        <div className="mref-preview__card">
          <div className="mref-preview__card-label">
            {t("settings.memoryReferencePreviewEmptyLabel", {
              defaultValue: "③ 无相关记忆",
            })}
          </div>
          <div className="mref-preview__mock mref-preview__mock--empty">
            <div className="mref-preview__empty-line">
              <span className="mref-preview__logo" aria-hidden>
                <img src={appLogo} alt="" draggable={false} />
              </span>
              <span>
                {t("memoryPick.toast.title", { defaultValue: "记忆参考" })}
                <span className="mref-preview__role-sep">·</span>
                {t("memoryPick.toast.noMatch", {
                  defaultValue: "未找到相关记忆，已按原文发送",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* ④ 已注入 */}
        <div className="mref-preview__card">
          <div className="mref-preview__card-label">
            {t("settings.memoryReferencePreviewInjectLabel", {
              defaultValue: "④ 确认后注入",
            })}
          </div>
          <div className="mref-preview__mock mref-preview__mock--inject">
            <div className="mref-preview__inject-head">
              {t("settings.memoryReferencePreviewInjectHead", {
                defaultValue: "已注入 3 条项目记忆 · 本轮挑选记忆注入",
              })}
            </div>
            <ul className="mref-preview__inject-rows">
              <li>
                <span>01</span>
                {t("settings.memoryReferencePreviewInjectRow1", {
                  defaultValue: "我的判断：可以收了，不必再大改。",
                })}
              </li>
              <li>
                <span>02</span>
                {t("settings.memoryReferencePreviewInjectRow2", {
                  defaultValue: "全部修复：hybrid 门槛、分数语义与检索…",
                })}
              </li>
              <li>
                <span>03</span>
                {t("settings.memoryReferencePreviewInjectRow3", {
                  defaultValue: "查清「你好」满分词面为何只显示 ~0.5…",
                })}
              </li>
            </ul>
          </div>
        </div>
      </div>
      ) : null}
    </div>
  );
}
