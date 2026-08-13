import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { BrowserContextAttachment, BrowserDiagnostic, BrowserObservationState } from "../types";
import { buildBrowserEvidenceViewModel } from "../evidence";
import {
  BrowserExcerptFold,
  oneLineHeadline,
  type BrowserExcerptFoldRow,
} from "./BrowserExcerptFold";

type BrowserContextSummaryDiagnostic = Pick<
  BrowserDiagnostic,
  "diagnosticId" | "severity" | "message"
>;

type BrowserContextSummaryBudget = Partial<BrowserContextAttachment["budget"]>;

type BrowserContextSummaryPrivacy = {
  redactionApplied?: boolean;
  redactedKinds: string[];
  omittedKinds: string[];
};

type BrowserContextSummaryCardAttachment = Pick<
  BrowserContextAttachment,
  "title" | "url" | "capturedAt" | "stale" | "summary"
> & {
  visibleTextExcerpt?: BrowserContextAttachment["visibleTextExcerpt"];
  elementCounts?: BrowserContextAttachment["elementCounts"];
  observation?: BrowserContextAttachment["observation"];
  diagnostics?: BrowserContextSummaryDiagnostic[];
  privacy?: BrowserContextSummaryPrivacy;
  budget?: BrowserContextSummaryBudget;
  codeCandidates?: BrowserContextAttachment["codeCandidates"];
  pageType?: BrowserContextAttachment["pageType"];
  primaryContent?: BrowserContextAttachment["primaryContent"];
  readableBlocks?: BrowserContextAttachment["readableBlocks"];
  noiseDiagnostics?: BrowserContextAttachment["noiseDiagnostics"];
  visualEvidence?: BrowserContextAttachment["visualEvidence"];
  annotations?: BrowserContextAttachment["annotations"];
};

export type BrowserContextSummaryCardProps = {
  attachment: BrowserContextSummaryCardAttachment;
};

function browserContextSummaryStateClass(state: BrowserObservationState): string {
  switch (state) {
    case "available":
      return "is-available";
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

function browserContextSummaryStateLabel(
  state: BrowserObservationState,
  t: (key: string) => string,
): string {
  switch (state) {
    case "available":
      return t("messages.browserContextState.available");
    case "stale":
      return t("messages.browserContextState.stale");
    case "expired":
      return t("messages.browserContextState.expired");
    case "degraded":
      return t("messages.browserContextState.degraded");
    case "unsupported":
      return t("messages.browserContextState.unsupported");
    default:
      return state;
  }
}

function compactDetailText(value: string, limit = 700): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function hasDiagnostics(
  diagnostics: BrowserContextSummaryDiagnostic[] | undefined,
): diagnostics is BrowserContextSummaryDiagnostic[] {
  return Array.isArray(diagnostics) && diagnostics.length > 0;
}

export function BrowserContextSummaryCard({
  attachment,
}: BrowserContextSummaryCardProps) {
  const { t } = useTranslation();
  const counts = attachment.elementCounts;
  const evidenceViewModel = useMemo(
    () => buildBrowserEvidenceViewModel(attachment),
    [attachment],
  );
  const selectedElements = evidenceViewModel.selectedElements;
  const hasSelectedElements = selectedElements.length > 0;
  const stateClass = browserContextSummaryStateClass(evidenceViewModel.observationState);
  const diagnostics = attachment.diagnostics?.slice(0, 2) ?? [];
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
  const hasStructuredDetails = Boolean(
    counts ||
    attachment.privacy ||
    attachment.budget ||
    evidenceViewModel.observationState !== "available" ||
    hasDiagnostics(attachment.diagnostics) ||
    attachment.readableBlocks?.length ||
    attachment.visualEvidence?.length ||
    attachment.codeCandidates?.length ||
    evidenceViewModel.primaryContent.items.length > 0,
  );
  const headerLabel = hasSelectedElements
    ? t("messages.browserContextExcerptCount", { count: excerptRows.length })
    : t("messages.browserContextSummary");

  return (
    <BrowserExcerptFold
      headerLabel={headerLabel}
      pageTitle={pageTitle}
      rows={excerptRows}
      stateClass={stateClass}
      stateLabel={
        evidenceViewModel.observationState === "available"
          ? null
          : browserContextSummaryStateLabel(evidenceViewModel.observationState, t)
      }
      renderExpandedExtra={
        !hasSelectedElements && hasStructuredDetails
          ? () => (
            <BrowserContextCaptureDetails
              attachment={attachment}
              counts={counts}
              diagnostics={diagnostics}
              evidenceViewModel={evidenceViewModel}
            />
          )
          : undefined
      }
    />
  );
}

function BrowserContextCaptureDetails({
  attachment,
  counts,
  diagnostics,
  evidenceViewModel,
}: {
  attachment: BrowserContextSummaryCardAttachment;
  counts: BrowserContextAttachment["elementCounts"] | undefined;
  diagnostics: BrowserContextSummaryDiagnostic[];
  evidenceViewModel: ReturnType<typeof buildBrowserEvidenceViewModel>;
}) {
  const { t } = useTranslation();
  return (
    <div className="browser-context-summary-detail">
      {counts ? (
        <div>
          {t("messages.browserContextDetailCounts", {
            headings: counts.headings,
            links: counts.links,
            buttons: counts.buttons,
            forms: counts.forms,
            landmarks: counts.landmarks,
            candidates: counts.codeCandidates,
          })}
        </div>
      ) : null}
      {evidenceViewModel.overview.copySafeText ? (
        <section className="browser-context-summary-section">
          <div className="browser-context-summary-section-title">
            {evidenceViewModel.overview.title}
          </div>
          <p>{compactDetailText(evidenceViewModel.overview.copySafeText, 1_000)}</p>
        </section>
      ) : null}
      {evidenceViewModel.primaryContent.items.length > 0 ? (
        <section className="browser-context-summary-section">
          <div className="browser-context-summary-section-title">
            {t("messages.browserContextPrimaryContent")}
          </div>
          <p>{compactDetailText(evidenceViewModel.primaryContent.items[0] ?? "", 1_200)}</p>
        </section>
      ) : null}
      {evidenceViewModel.readableBlocks.items.length > 0 ? (
        <section className="browser-context-summary-section">
          <div className="browser-context-summary-section-title">
            {t("messages.browserContextReadableBlocks", {
              count: evidenceViewModel.readableBlocks.items.length,
            })}
          </div>
          <ol className="browser-context-summary-evidence-list">
            {evidenceViewModel.readableBlocks.items.slice(0, 8).map((item, index) => (
              <li key={`readable-${index}`}>
                <p>{compactDetailText(item)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {evidenceViewModel.visualEvidence.items.length > 0 ? (
        <section className="browser-context-summary-section">
          <div className="browser-context-summary-section-title">
            {t("messages.browserContextVisualEvidence", {
              count: evidenceViewModel.visualEvidence.items.length,
            })}
          </div>
          <ul className="browser-context-summary-evidence-list">
            {evidenceViewModel.visualEvidence.items.slice(0, 12).map((item, index) => (
              <li key={`visual-${index}`}>
                <p>{compactDetailText(item, 520)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {evidenceViewModel.codeCandidates.items.length > 0 ? (
        <section className="browser-context-summary-section">
          <div className="browser-context-summary-section-title">
            {t("messages.browserContextCodeCandidateCount", {
              count: evidenceViewModel.codeCandidates.items.length,
            })}
          </div>
          <ul className="browser-context-summary-evidence-list">
            {evidenceViewModel.codeCandidates.items.map((item, index) => (
              <li key={`candidate-${index}`}>
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {attachment.privacy ? (
        <div>
          {t("messages.browserContextDetailPrivacy", {
            redacted: attachment.privacy.redactedKinds.length,
            omitted: attachment.privacy.omittedKinds.length,
          })}
        </div>
      ) : null}
      {attachment.budget ? (
        <div>
          {t("messages.browserContextDetailBudget", {
            truncated: attachment.budget.truncated
              ? t("common.yes", "yes")
              : t("common.no", "no"),
            omitted: attachment.budget.omittedElementCount ?? 0,
          })}
        </div>
      ) : null}
      {attachment.noiseDiagnostics && attachment.noiseDiagnostics.length > 0 ? (
        <div>
          {t("messages.browserContextNoiseDiagnostics", {
            count: attachment.noiseDiagnostics.length,
          })}
        </div>
      ) : null}
      {diagnostics.length > 0 ? (
        <ul>
          {diagnostics.map((diagnostic) => (
            <li key={diagnostic.diagnosticId}>
              {diagnostic.severity}: {diagnostic.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
