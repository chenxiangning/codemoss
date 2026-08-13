import { useTranslation } from "react-i18next";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import ListChecks from "lucide-react/dist/esm/icons/list-checks";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import Plus from "lucide-react/dist/esm/icons/plus";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Search from "lucide-react/dist/esm/icons/search";
import Square from "lucide-react/dist/esm/icons/square";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";

import { cn } from "../../../../lib/utils";
import { ThreadDeleteConfirmBubble } from "../../../threads/components/ThreadDeleteConfirmBubble";
import type { IntentCanvasIndexEntry } from "../../types";
import type { CanvasEra } from "../../utils/eraGrouping";
import { deriveCanvasStaleBadge, type CanvasAnchorHealth } from "../../utils/staleSignals";
import {
  IntentCanvasHomeCard,
  type IntentCanvasCardActionPrompt,
} from "./IntentCanvasHomeCard";

export type IntentCanvasHomeStatus = "idle" | "loading" | "ready" | "error";

export type IntentCanvasHomeProps = {
  status: IntentCanvasHomeStatus;
  filteredEntries: IntentCanvasIndexEntry[];
  eras: CanvasEra[];
  now: Date;
  warnings: string[];
  errorMessage: string | null;
  searchQuery: string;
  anchorHealthByCanvasId: Record<string, CanvasAnchorHealth>;
  selectedCanvasIds: ReadonlySet<string>;
  selectedCount: number;
  allFilteredEntriesSelected: boolean;
  isBulkDeletePromptOpen: boolean;
  isBulkDeleting: boolean;
  actionPrompt: IntentCanvasCardActionPrompt | null;
  confirmingCanvasActionId: string | null;
  onSearchQueryChange: (value: string) => void;
  onToggleSelectAll: () => void;
  onRefresh: () => void;
  onOpenProjectMap?: () => void;
  onCreateCanvas: () => void;
  onToggleCanvasSelection: (canvasId: string) => void;
  onSelectEra: (era: CanvasEra) => void;
  onClearSelection: () => void;
  onBulkDeleteRequest: () => void;
  onBulkDeleteConfirm: () => void;
  onBulkDeleteCancel: () => void;
  onCanvasActionRequest: (
    entry: IntentCanvasIndexEntry,
    action: IntentCanvasCardActionPrompt["action"],
  ) => void;
  onConfirmCanvasAction: () => void;
  onCancelCanvasAction: () => void;
};

function formatEraLabel(era: CanvasEra, now: Date, t: (key: string) => string): string {
  if (era.kind === "week") {
    return t("intentCanvas.manager.eraWeek");
  }
  if (era.kind === "stale") {
    return t("intentCanvas.manager.eraStale");
  }
  const monthDate = new Date(era.year ?? now.getFullYear(), (era.month ?? 1) - 1, 1);
  const crossYear = monthDate.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    ...(crossYear ? { year: "numeric" as const } : {}),
  }).format(monthDate);
}

export function IntentCanvasHome(props: IntentCanvasHomeProps) {
  const { t } = useTranslation();
  const {
    status,
    filteredEntries,
    eras,
    now,
    warnings,
    errorMessage,
    searchQuery,
    anchorHealthByCanvasId,
    selectedCanvasIds,
    selectedCount,
    allFilteredEntriesSelected,
    isBulkDeletePromptOpen,
    isBulkDeleting,
    actionPrompt,
    confirmingCanvasActionId,
  } = props;

  return (
    <>
      <header className="intent-canvas-manager-hero">
        <div className="intent-canvas-manager-identity">
          <h2>{t("intentCanvas.manager.title")}</h2>
          <p>{t("intentCanvas.manager.countSubtitle", { count: filteredEntries.length })}</p>
        </div>
        <label className="intent-canvas-search">
          <Search aria-hidden />
          <input
            value={searchQuery}
            placeholder={t("intentCanvas.manager.searchPlaceholder")}
            onChange={(event) => props.onSearchQueryChange(event.currentTarget.value)}
          />
        </label>
        <div className="intent-canvas-manager-actions">
          <button
            type="button"
            className="is-icon"
            onClick={props.onToggleSelectAll}
            disabled={filteredEntries.length === 0 || status === "loading"}
            aria-label={
              allFilteredEntriesSelected
                ? t("intentCanvas.manager.clearSelection")
                : t("intentCanvas.manager.selectAll")
            }
            title={
              allFilteredEntriesSelected
                ? t("intentCanvas.manager.clearSelection")
                : t("intentCanvas.manager.selectAll")
            }
          >
            {allFilteredEntriesSelected ? <Square aria-hidden /> : <ListChecks aria-hidden />}
          </button>
          <button
            type="button"
            className="is-icon"
            onClick={props.onRefresh}
            disabled={status === "loading"}
            aria-label={t("intentCanvas.manager.refresh")}
            title={t("intentCanvas.manager.refresh")}
          >
            <RefreshCw aria-hidden className={status === "loading" ? "is-spinning" : undefined} />
          </button>
          {props.onOpenProjectMap ? (
            <button
              type="button"
              className="is-icon"
              onClick={props.onOpenProjectMap}
              aria-label={t("intentCanvas.manager.projectMap")}
              title={t("intentCanvas.manager.projectMap")}
            >
              <GitBranch aria-hidden />
            </button>
          ) : null}
          <button type="button" className="is-primary" onClick={props.onCreateCanvas}>
            <Plus aria-hidden />
            {t("intentCanvas.manager.newCanvas")}
          </button>
        </div>
      </header>

      {warnings.map((warning) => (
        <p key={warning} className="intent-canvas-warning" role="status">{warning}</p>
      ))}
      {errorMessage ? <p className="intent-canvas-error" role="alert">{errorMessage}</p> : null}
      {selectedCount > 0 ? (
        <div className="intent-canvas-bulk-toolbar" role="status">
          <span>{t("intentCanvas.manager.selectedCount", { count: selectedCount })}</span>
          <div className="intent-canvas-bulk-actions">
            <button type="button" onClick={props.onClearSelection} disabled={isBulkDeleting}>
              {t("intentCanvas.manager.clearSelection")}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={props.onBulkDeleteRequest}
              disabled={isBulkDeleting}
            >
              <Trash2 aria-hidden />
              {t("intentCanvas.manager.deleteSelected", { count: selectedCount })}
            </button>
          </div>
          {isBulkDeletePromptOpen ? (
            <div className="intent-canvas-action-popover-shell is-bulk">
              <ThreadDeleteConfirmBubble
                threadName={t("intentCanvas.manager.selectedCount", { count: selectedCount })}
                title={t("intentCanvas.manager.bulkDelete")}
                message={t("intentCanvas.manager.bulkDeleteConfirm", { count: selectedCount })}
                hint={t("intentCanvas.manager.bulkDeleteHint")}
                confirmLabel={t("intentCanvas.manager.deleteSelected", { count: selectedCount })}
                isDeleting={isBulkDeleting}
                onCancel={props.onBulkDeleteCancel}
                onConfirm={props.onBulkDeleteConfirm}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "loading" && filteredEntries.length === 0 ? (
        <div className="intent-canvas-loading">
          <LoaderCircle aria-hidden className="is-spinning" /> {t("intentCanvas.loading")}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="intent-canvas-empty-state">
          <FileText aria-hidden />
          <h3>{t("intentCanvas.manager.emptyTitle")}</h3>
          <p>{t("intentCanvas.manager.emptyBody")}</p>
          <button type="button" className="is-primary" onClick={props.onCreateCanvas}>
            <Plus aria-hidden />
            {t("intentCanvas.manager.newCanvas")}
          </button>
        </div>
      ) : (
        <div className="intent-canvas-eras">
          {eras.map((era, eraIndex) => {
            const isStaleEra = era.kind === "stale";
            return (
              <section
                key={era.id}
                className={cn("intent-canvas-era", isStaleEra && "is-stale", eraIndex === 0 && "is-latest")}
              >
                <div className="intent-canvas-era-rail">
                  <h3>{formatEraLabel(era, now, t)}</h3>
                  <span className="intent-canvas-era-agg">
                    {isStaleEra
                      ? t("intentCanvas.manager.eraStaleAggregate", {
                          count: era.canvasCount,
                          days: era.maxStaleDays,
                        })
                      : t("intentCanvas.manager.eraAggregate", {
                          count: era.canvasCount,
                          elements: era.elementSum,
                        })}
                  </span>
                  {isStaleEra ? (
                    <>
                      <span className="intent-canvas-era-cleanup">
                        ⚠ {t("intentCanvas.manager.eraCleanupHint")}
                      </span>
                      <button
                        type="button"
                        className="intent-canvas-era-select"
                        onClick={() => props.onSelectEra(era)}
                      >
                        {t("intentCanvas.manager.selectEra")}
                      </button>
                    </>
                  ) : null}
                </div>
                <div className="intent-canvas-era-deck" role="list">
                  {era.entries.map((entry) => (
                    <IntentCanvasHomeCard
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedCanvasIds.has(entry.id)}
                      isStaleEra={isStaleEra}
                      staleBadge={
                        isStaleEra
                          ? deriveCanvasStaleBadge({
                              entry,
                              anchorHealth: anchorHealthByCanvasId[entry.id] ?? "unknown",
                              now,
                            })
                          : null
                      }
                      now={now}
                      actionPrompt={actionPrompt}
                      isConfirming={confirmingCanvasActionId === entry.id}
                      onToggleSelection={props.onToggleCanvasSelection}
                      onActionRequest={props.onCanvasActionRequest}
                      onConfirmAction={props.onConfirmCanvasAction}
                      onCancelAction={props.onCancelCanvasAction}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
