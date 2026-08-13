import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type UIEvent,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import type { GitLineMarkers } from "../../files/utils/gitLineMarkers";
import { computeFileCompareDiff } from "../../files/utils/fileCompareDiff";
import {
  CompareEditorColumn,
  type CompareColumnDraft,
  useFileCompareEditorTheme,
} from "../../files/components/WorkspaceFileComparePanel";
import { parseDiff } from "../../../utils/diff";
import type { DiffPresentationEntry } from "../utils/diffPresentationModel";

type WorkspaceReadOnlyDiffCompareProps = Pick<
  DiffPresentationEntry,
  "filePath" | "diff"
> & {
  loadFullDiff?: ((path: string) => Promise<string>) | null;
  useFullDiff?: boolean;
  headerControlsTarget?: HTMLElement | null;
  resizableColumns?: boolean;
};

const EMPTY_MARKERS: GitLineMarkers = { added: [], modified: [] };
const COMPARE_SPLITTER_SIZE = 8;
const DEFAULT_PREVIOUS_COLUMN_RATIO = 0.5;
const MIN_PREVIOUS_COLUMN_RATIO = 0.2;
const MAX_PREVIOUS_COLUMN_RATIO = 0.8;
const KEYBOARD_RATIO_STEP = 0.02;

function clampRatio(ratio: number) {
  return Math.min(MAX_PREVIOUS_COLUMN_RATIO, Math.max(MIN_PREVIOUS_COLUMN_RATIO, ratio));
}

export type ReadOnlyCompareModel = {
  sources: [string, string];
  lineNumberLabels: [Array<number | null>, Array<number | null>];
};

export function buildReadOnlyCompareModel(diff: string): ReadOnlyCompareModel {
  const previousLines: string[] = [];
  const sourceLines: string[] = [];
  const previousLineNumbers: Array<number | null> = [];
  const sourceLineNumbers: Array<number | null> = [];
  let hasPreviousHunk = false;

  for (const line of parseDiff(diff)) {
    if (line.type === "hunk") {
      if (hasPreviousHunk) {
        previousLines.push("");
        sourceLines.push("");
        previousLineNumbers.push(null);
        sourceLineNumbers.push(null);
      }
      hasPreviousHunk = true;
      continue;
    }
    if (line.type === "context") {
      previousLines.push(line.text);
      sourceLines.push(line.text);
      previousLineNumbers.push(line.oldLine);
      sourceLineNumbers.push(line.newLine);
    } else if (line.type === "del") {
      previousLines.push(line.text);
      previousLineNumbers.push(line.oldLine);
    } else if (line.type === "add") {
      sourceLines.push(line.text);
      sourceLineNumbers.push(line.newLine);
    }
  }

  return {
    sources: [previousLines.join("\n"), sourceLines.join("\n")],
    lineNumberLabels: [previousLineNumbers, sourceLineNumbers],
  };
}

export function buildReadOnlyCompareSources(diff: string): [string, string] {
  return buildReadOnlyCompareModel(diff).sources;
}

export function WorkspaceReadOnlyDiffCompare({
  filePath,
  diff,
  loadFullDiff = null,
  useFullDiff = false,
  headerControlsTarget = null,
  resizableColumns = false,
}: WorkspaceReadOnlyDiffCompareProps) {
  const { t } = useTranslation();
  const editorTheme = useFileCompareEditorTheme();
  const scrollSyncingRef = useRef(false);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const splitterRef = useRef<HTMLDivElement | null>(null);
  const previousColumnRatioRef = useRef(DEFAULT_PREVIOUS_COLUMN_RATIO);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const [activeDifferenceIndex, setActiveDifferenceIndex] = useState(0);
  const [navigationEpoch, setNavigationEpoch] = useState(0);
  const [resolvedDiff, setResolvedDiff] = useState(diff);

  useEffect(() => {
    let cancelled = false;
    setResolvedDiff(diff);
    setActiveDifferenceIndex(0);
    if (!useFullDiff || !loadFullDiff) {
      return () => {
        cancelled = true;
      };
    }

    void loadFullDiff(filePath)
      .then((fullDiff) => {
        if (!cancelled && fullDiff.trim()) {
          setResolvedDiff(fullDiff);
        }
      })
      .catch(() => {
        // Keep the initial patch visible when full-context loading is unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [diff, filePath, loadFullDiff, useFullDiff]);

  const compareModel = useMemo(() => buildReadOnlyCompareModel(resolvedDiff), [resolvedDiff]);
  const { sources } = compareModel;
  const diffResult = useMemo(() => computeFileCompareDiff(sources), [sources]);
  const activeDifference = diffResult.changedBlocks[activeDifferenceIndex] ?? null;
  const canNavigateDifferences = diffResult.changedBlocks.length > 0;
  const markersByColumn = useMemo<GitLineMarkers[]>(
    () =>
      diffResult.changedLineNumbersByColumn.map((modified) => ({
        added: [],
        modified,
      })),
    [diffResult.changedLineNumbersByColumn],
  );
  const drafts = useMemo<CompareColumnDraft[]>(
    () => [
      {
        id: `previous:${filePath}`,
        label: filePath,
        title: t("files.editableDiff.previousVersion"),
        content: sources[0],
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        saveError: null,
        truncated: false,
        readOnlyReason: null,
        editable: false,
        onChange: () => {},
        onSave: () => false,
      },
      {
        id: `source:${filePath}`,
        label: filePath,
        title: t("files.editableDiff.sourceCode"),
        content: sources[1],
        isDirty: false,
        isSaving: false,
        isLoading: false,
        error: null,
        saveError: null,
        truncated: false,
        readOnlyReason: null,
        editable: false,
        onChange: () => {},
        onSave: () => false,
      },
    ],
    [filePath, sources, t],
  );

  const handlePanelScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const sourceScroller = event.target;
    if (
      scrollSyncingRef.current
      || !(sourceScroller instanceof HTMLElement)
      || !sourceScroller.classList.contains("cm-scroller")
    ) {
      return;
    }
    const scrollers = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(".file-compare-cm .cm-scroller"),
    );
    scrollSyncingRef.current = true;
    for (const scroller of scrollers) {
      if (scroller !== sourceScroller) {
        scroller.scrollTop = sourceScroller.scrollTop;
      }
    }
    window.requestAnimationFrame(() => {
      scrollSyncingRef.current = false;
    });
  }, []);

  const applyColumnRatio = useCallback((ratio: number) => {
    const normalizedRatio = Math.round(clampRatio(ratio) * 10_000) / 10_000;
    const sourceRatio = Math.round((1 - normalizedRatio) * 10_000) / 10_000;
    previousColumnRatioRef.current = normalizedRatio;
    columnsRef.current?.style.setProperty(
      "--read-only-previous-column-ratio",
      `${normalizedRatio}fr`,
    );
    columnsRef.current?.style.setProperty(
      "--read-only-source-column-ratio",
      `${sourceRatio}fr`,
    );
    splitterRef.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(normalizedRatio * 100)),
    );
  }, []);

  const resetColumnRatio = useCallback(() => {
    applyColumnRatio(DEFAULT_PREVIOUS_COLUMN_RATIO);
  }, [applyColumnRatio]);

  useEffect(() => {
    resizeCleanupRef.current?.();
    resetColumnRatio();
  }, [filePath, resetColumnRatio]);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const columns = columnsRef.current;
      if (!columns) return;
      const hostWidth = columns.getBoundingClientRect().width;
      if (hostWidth <= COMPARE_SPLITTER_SIZE) return;

      event.preventDefault();
      resizeCleanupRef.current?.();

      const startX = event.clientX;
      const startRatio = previousColumnRatioRef.current;
      const availableWidth = hostWidth - COMPARE_SPLITTER_SIZE;
      const previousBodyStyles = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
        webkitUserSelect: document.body.style.webkitUserSelect,
      };
      let pendingRatio = startRatio;
      let animationFrame: number | null = null;

      const flushRatio = () => {
        animationFrame = null;
        applyColumnRatio(pendingRatio);
      };
      const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
        pendingRatio = clampRatio(
          startRatio + (moveEvent.clientX - startX) / availableWidth,
        );
        if (animationFrame === null) {
          animationFrame = window.requestAnimationFrame(flushRatio);
        }
      };
      const cleanup = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", cleanup);
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
          flushRatio();
        }
        document.body.style.cursor = previousBodyStyles.cursor;
        document.body.style.userSelect = previousBodyStyles.userSelect;
        document.body.style.webkitUserSelect = previousBodyStyles.webkitUserSelect;
        delete document.body.dataset.readOnlyCompareResizing;
        resizeCleanupRef.current = null;
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      document.body.dataset.readOnlyCompareResizing = "true";
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", cleanup);
      resizeCleanupRef.current = cleanup;
    },
    [applyColumnRatio],
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const direction =
        event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (direction === 0 && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      if (event.key === "Home") {
        applyColumnRatio(MIN_PREVIOUS_COLUMN_RATIO);
      } else if (event.key === "End") {
        applyColumnRatio(MAX_PREVIOUS_COLUMN_RATIO);
      } else {
        applyColumnRatio(
          previousColumnRatioRef.current + direction * KEYBOARD_RATIO_STEP,
        );
      }
    },
    [applyColumnRatio],
  );

  const differenceNavigator = (
    <div
      className={`editable-diff-compare-nav${headerControlsTarget ? " is-external" : ""}`}
      aria-live="polite"
    >
      <span>
        {canNavigateDifferences
          ? t("files.fileCompare.differenceCount", {
              current: activeDifferenceIndex + 1,
              total: diffResult.changedBlocks.length,
            })
          : t("files.fileCompare.noDifferences")}
      </span>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setActiveDifferenceIndex(
            (current) =>
              (current - 1 + diffResult.changedBlocks.length) % diffResult.changedBlocks.length,
          );
          setNavigationEpoch((epoch) => epoch + 1);
        }}
        disabled={!canNavigateDifferences}
        aria-label={t("files.fileCompare.previousDifference")}
        title={t("files.fileCompare.previousDifference")}
      >
        <ChevronUp size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="ghost"
        onClick={() => {
          setActiveDifferenceIndex(
            (current) => (current + 1) % diffResult.changedBlocks.length,
          );
          setNavigationEpoch((epoch) => epoch + 1);
        }}
        disabled={!canNavigateDifferences}
        aria-label={t("files.fileCompare.nextDifference")}
        title={t("files.fileCompare.nextDifference")}
      >
        <ChevronDown size={14} aria-hidden />
      </button>
    </div>
  );

  return (
    <div
      className={`editable-diff-compare${headerControlsTarget ? " has-external-nav" : ""}`}
      onScrollCapture={handlePanelScroll}
    >
      {headerControlsTarget
        ? createPortal(differenceNavigator, headerControlsTarget)
        : differenceNavigator}
      <div
        ref={columnsRef}
        className={`file-compare-columns editable-diff-compare-columns${
          resizableColumns ? " is-resizable" : ""
        }`}
        style={{
          "--file-compare-column-count": "2",
          "--read-only-previous-column-ratio": `${DEFAULT_PREVIOUS_COLUMN_RATIO}fr`,
          "--read-only-source-column-ratio": `${1 - DEFAULT_PREVIOUS_COLUMN_RATIO}fr`,
        } as CSSProperties}
      >
        {drafts.map((draft, columnIndex) => (
          <Fragment key={draft.id}>
            <CompareEditorColumn
              draft={draft}
              editorTheme={editorTheme}
              markers={markersByColumn[columnIndex] ?? EMPTY_MARKERS}
              lineGaps={diffResult.gapLineCountsByColumn[columnIndex] ?? []}
              lineNumberLabels={compareModel.lineNumberLabels[columnIndex] ?? null}
              saveFileShortcut="cmd+s"
              activeLineNumber={activeDifference?.lineNumbersByColumn[columnIndex] ?? null}
              navigationEpoch={navigationEpoch}
              diffTone={columnIndex === 0 ? "deletion" : "addition"}
            />
            {resizableColumns && columnIndex === 0 ? (
              <div
                ref={splitterRef}
                className="read-only-compare-resizer"
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-valuemin={MIN_PREVIOUS_COLUMN_RATIO * 100}
                aria-valuemax={MAX_PREVIOUS_COLUMN_RATIO * 100}
                aria-valuenow={DEFAULT_PREVIOUS_COLUMN_RATIO * 100}
                aria-label={t("git.historyResizeCompareColumns")}
                onMouseDown={handleResizeStart}
                onKeyDown={handleResizeKeyDown}
                onDoubleClick={resetColumnRatio}
                data-testid="file-history-compare-resizer"
              />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
