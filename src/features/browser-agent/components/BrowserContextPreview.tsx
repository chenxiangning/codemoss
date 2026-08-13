import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import type { BrowserContextAttachment } from "../types";
import { buildBrowserEvidenceViewModel } from "../evidence";
import {
  BrowserExcerptFold,
  oneLineHeadline,
  type BrowserExcerptFoldRow,
} from "./BrowserExcerptFold";

export type BrowserContextPreviewProps = {
  attachment: BrowserContextAttachment;
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
};

function browserContextStateClass(state: BrowserContextAttachment["observation"]["state"]): string {
  switch (state) {
    case "available":
      return "is-fresh";
    case "expired":
      return "is-expired";
    case "degraded":
      return "is-degraded";
    case "unsupported":
      return "is-unavailable";
    case "stale":
    default:
      return "is-stale";
  }
}

function browserContextStateLabel(
  state: BrowserContextAttachment["observation"]["state"],
  t: (key: string) => string,
): string {
  switch (state) {
    case "available":
      return t("browserAgent.composer.fresh");
    case "stale":
      return t("browserAgent.composer.stale");
    case "expired":
      return t("browserAgent.composer.expired");
    case "degraded":
      return t("browserAgent.composer.degraded");
    case "unsupported":
      return t("browserAgent.composer.unsupported");
    default:
      return state;
  }
}

export function BrowserContextPreview({
  attachment,
  busy,
  onRefresh,
  onRemove,
}: BrowserContextPreviewProps) {
  const { t } = useTranslation();
  const evidenceViewModel = useMemo(
    () => buildBrowserEvidenceViewModel(attachment),
    [attachment],
  );
  const selectedElements = evidenceViewModel.selectedElements;
  const hasSelectedElements = selectedElements.length > 0;
  const stateClass = browserContextStateClass(evidenceViewModel.observationState);
  const pageTitle = attachment.title || attachment.url;
  const snapshotExcerpt = attachment.visibleTextExcerpt || attachment.summary || pageTitle;
  const excerptRows = useMemo<BrowserExcerptFoldRow[]>(() => {
    if (hasSelectedElements) {
      return selectedElements.map((item) => ({
        id: item.annotationId,
        headline: oneLineHeadline(item.title || item.body),
        body: item.body || item.title,
        kind: item.kind,
        sourceTitle: item.sourceTitle,
        sourceUrl: item.sourceUrl,
        selectorHint: item.selectorHint,
        elementMeta: item.meta,
        locate: item.locate,
      }));
    }
    return [
      {
        id: "page-snapshot",
        headline: oneLineHeadline(pageTitle),
        body: snapshotExcerpt,
        kind: "snapshot",
        sourceTitle: pageTitle,
        sourceUrl: attachment.url,
      },
    ];
  }, [attachment.url, hasSelectedElements, pageTitle, selectedElements, snapshotExcerpt]);
  const headerLabel = hasSelectedElements
    ? t("messages.browserContextExcerptCount", { count: excerptRows.length })
    : t("messages.browserContextSummary");

  return (
    <BrowserExcerptFold
      className={`composer-browser-context-card ${stateClass}`}
      headerLabel={headerLabel}
      pageTitle={pageTitle}
      rows={excerptRows}
      stateClass={stateClass}
      stateLabel={
        evidenceViewModel.observationState === "available"
          ? null
          : browserContextStateLabel(evidenceViewModel.observationState, t)
      }
      actions={
        <>
          <button
            type="button"
            className="composer-browser-context-refresh"
            onClick={onRefresh}
            disabled={busy}
            title={t("browserAgent.composer.refresh")}
          >
            <RefreshCw size={14} aria-hidden />
          </button>
          <button
            type="button"
            className="composer-browser-context-remove"
            onClick={onRemove}
            title={t("browserAgent.composer.remove")}
          >
            <X size={14} aria-hidden />
          </button>
        </>
      }
    />
  );
}
