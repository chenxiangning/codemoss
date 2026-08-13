import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import type { BrowserExcerptKind } from "../evidence";
import type { BrowserSelectionLocate } from "../types";

export function oneLineHeadline(value: string, limit = 72): string {
  const firstLine =
    value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ??
    value.replace(/\s+/g, " ").trim();
  if (!firstLine) {
    return "";
  }
  return firstLine.length > limit ? `${firstLine.slice(0, limit)}…` : firstLine;
}

export type BrowserExcerptFoldRow = {
  id: string;
  headline: string;
  body: string;
  kind: BrowserExcerptKind;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  selectorHint?: string | null;
  elementMeta?: string | null;
  locate?: BrowserSelectionLocate | null;
};

function displaySourceUrl(url: string): string {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
}

function formatRounded(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function sendDetailLines(
  row: BrowserExcerptFoldRow,
  t: (key: string, options?: Record<string, unknown>) => string,
): Array<{ label: string; value: string }> {
  const locate = row.locate;
  const lines: Array<{ label: string; value: string }> = [];
  if (locate) {
    lines.push({
      label: t("messages.browserContextExcerptLocateDocument", {
        defaultValue: "文档坐标",
      }),
      value: `${formatRounded(locate.documentX)}, ${formatRounded(locate.documentY)}`,
    });
    lines.push({
      label: t("messages.browserContextExcerptLocateViewport", {
        defaultValue: "视口",
      }),
      value: `${formatRounded(locate.viewportX)}, ${formatRounded(locate.viewportY)} · ${formatRounded(locate.width)}×${formatRounded(locate.height)}`,
    });
    if (locate.listIndex && locate.listLength) {
      lines.push({
        label: t("messages.browserContextExcerptLocateList", {
          defaultValue: "列表",
        }),
        value: `${locate.listIndex} / ${locate.listLength}`,
      });
    }
    if (locate.previousText) {
      lines.push({
        label: t("messages.browserContextExcerptLocatePrevious", {
          defaultValue: "上一条",
        }),
        value: locate.previousText,
      });
    }
    if (locate.nextText) {
      lines.push({
        label: t("messages.browserContextExcerptLocateNext", {
          defaultValue: "下一条",
        }),
        value: locate.nextText,
      });
    }
    if (locate.ancestorLabel) {
      lines.push({
        label: t("messages.browserContextExcerptLocateAncestor", {
          defaultValue: "所在分组",
        }),
        value: locate.ancestorLabel,
      });
    }
    if (locate.cssPath) {
      lines.push({
        label: t("messages.browserContextExcerptLocateCssPath", {
          defaultValue: "路径",
        }),
        value: locate.cssPath,
      });
    }
  }
  if (row.elementMeta) {
    lines.push({
      label: t("messages.browserContextExcerptLocateElement", {
        defaultValue: "元素",
      }),
      value: row.elementMeta,
    });
  }
  if (row.selectorHint && row.selectorHint !== locate?.cssPath) {
    lines.push({
      label: t("messages.browserContextExcerptLocateSelector", {
        defaultValue: "选择器",
      }),
      value: row.selectorHint,
    });
  }
  return lines;
}

export type BrowserExcerptFoldProps = {
  className?: string;
  headerLabel: string;
  pageTitle: string;
  rows: BrowserExcerptFoldRow[];
  stateClass?: string;
  stateLabel?: string | null;
  defaultOpen?: boolean;
  actions?: ReactNode;
  renderExpandedExtra?: (row: BrowserExcerptFoldRow) => ReactNode;
};

export function BrowserExcerptFold({
  className,
  headerLabel,
  pageTitle,
  rows,
  stateClass = "",
  stateLabel = null,
  defaultOpen = true,
  actions,
  renderExpandedExtra,
}: BrowserExcerptFoldProps) {
  const { t } = useTranslation();
  const [listOpen, setListOpen] = useState(defaultOpen);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  return (
    <div
      className={`browser-context-summary-card ${stateClass}${
        listOpen ? " is-expanded" : " is-collapsed"
      }${className ? ` ${className}` : ""}`}
    >
      <div className="browser-context-summary-head">
        <button
          type="button"
          className={`browser-context-summary-toggle-line${
            listOpen ? " is-expanded" : " is-collapsed"
          }`}
          onClick={() => setListOpen((current) => !current)}
          aria-expanded={listOpen}
          aria-label={t("messages.browserContextExcerptToggle", {
            defaultValue: headerLabel,
          })}
        >
          <ChevronRight
            className="browser-context-summary-chevron"
            size={12}
            strokeWidth={2.2}
            aria-hidden
          />
          <strong className="browser-context-summary-label">{headerLabel}</strong>
          <span className="browser-context-summary-source-kicker" title={pageTitle}>
            {pageTitle}
          </span>
          {stateLabel ? (
            <span className={`browser-context-summary-state ${stateClass}`}>
              {stateLabel}
            </span>
          ) : null}
          <span className="browser-context-summary-rule" aria-hidden />
        </button>
        {actions ? (
          <div className="browser-context-summary-actions">{actions}</div>
        ) : null}
      </div>
      {listOpen ? (
        <div className="browser-context-summary-body">
          {rows.map((row, index) => {
            const isOpen = openRowId === row.id;
            const extra = isOpen ? renderExpandedExtra?.(row) : null;
            const details = isOpen ? sendDetailLines(row, t) : [];
            const showBody = Boolean(row.body) && row.body.trim() !== row.headline.trim();
            return (
              <button
                key={row.id}
                type="button"
                className={`browser-context-summary-rec${isOpen ? " is-open" : ""}`}
                onClick={() =>
                  setOpenRowId((current) => (current === row.id ? null : row.id))
                }
                aria-expanded={isOpen}
              >
                <span className="browser-context-summary-rec-main">
                  <span className="browser-context-summary-rec-idx">
                    {index + 1}
                  </span>
                  <span className="browser-context-summary-rec-title">
                    {row.headline}
                  </span>
                  <span className="browser-context-summary-rec-kind">
                    {t(`messages.browserContextExcerptKind.${row.kind}`, {
                      defaultValue: row.kind,
                    })}
                  </span>
                </span>
                {isOpen ? (
                  <span className="browser-context-summary-rec-more">
                    {showBody ? (
                      <span className="browser-context-summary-rec-sent">
                        {row.body}
                      </span>
                    ) : null}
                    {details.length > 0 ? (
                      <span className="browser-context-summary-rec-sent-details">
                        <span className="browser-context-summary-rec-sent-heading">
                          {t("messages.browserContextExcerptSentDetails", {
                            defaultValue: "发送细节",
                          })}
                        </span>
                        {details.map((detail) => (
                          <span
                            key={`${row.id}-${detail.label}`}
                            className="browser-context-summary-rec-sent-line"
                          >
                            <span className="browser-context-summary-rec-sent-key">
                              {detail.label}
                            </span>
                            <span className="browser-context-summary-rec-sent-value">
                              {detail.value}
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {row.sourceTitle || row.sourceUrl ? (
                      <span className="browser-context-summary-rec-origin">
                        {[
                          row.sourceTitle,
                          row.sourceUrl ? displaySourceUrl(row.sourceUrl) : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {extra}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
