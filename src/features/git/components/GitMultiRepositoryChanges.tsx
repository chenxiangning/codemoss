import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import type {
  CommitMessageEngine,
  CommitMessageLanguage,
} from "../../../services/tauri";
import type { RepositoryGitStatus } from "../hooks/useMultiRepositoryGitStatus";
import { normalizeGitPath } from "../utils/commitScope";
import {
  DiffSection,
  type DiffFile,
  isDeletedDiffFile,
} from "./GitDiffPanelFileSections";
import { InclusionToggle, type InclusionState } from "./GitDiffPanelInclusion";
import type { GitCommitComposerPlacement } from "../hooks/useGitCommitComposerPlacement";
import { GitCommitComposer } from "./GitCommitComposer";

export type RepositoryCommitSelection = {
  repositoryRoot: string;
  selectedPaths: string[];
};

type GitMultiRepositoryChangesProps = {
  workspaceId: string;
  statuses: RepositoryGitStatus[];
  isLoading: boolean;
  commitMessage: string;
  commitLoading: boolean;
  commitMessageLoading?: boolean;
  commitError?: string | null;
  commitMessageError?: string | null;
  commitSummary?: string | null;
  commitMessageEngine?: CommitMessageEngine;
  commitComposerPlacement?: GitCommitComposerPlacement;
  onCommitMessageChange?: (value: string) => void;
  onCommitRepositories?: (selections: RepositoryCommitSelection[]) => void | Promise<void>;
  onGenerateCommitMessage?: (
    language: CommitMessageLanguage,
    engine: CommitMessageEngine,
    selections: RepositoryCommitSelection[],
  ) => void | Promise<void>;
  onCommitMessageEngineChange?: (engine: CommitMessageEngine) => void;
  onStageFile?: (repositoryRoot: string, path: string) => Promise<void>;
  onUnstageFile?: (repositoryRoot: string, path: string) => Promise<void>;
  onUnstageAll?: (repositoryRoot: string) => Promise<void>;
  onUnstageFiles?: (repositoryRoot: string, paths: string[]) => Promise<void>;
  onDiscardFile?: (repositoryRoot: string, path: string) => Promise<void> | void;
  onDiscardFiles?: (repositoryRoot: string, paths: string[]) => Promise<void> | void;
  onStageAll?: (repositoryRoot: string) => Promise<void>;
  onOpenFile?: (repositoryRoot: string, path: string) => void;
  onOpenFilePreview?: (
    repositoryRoot: string,
    file: DiffFile,
    section: "staged" | "unstaged",
  ) => void;
  /** Row action that opens workspace file content (not the DIFF modal). */
  onOpenFileContent?: (repositoryRoot: string, path: string) => void;
  onOpenInlinePreview?: (repositoryRoot: string, path: string) => void;
  onOpenInBrowser?: (repositoryRoot: string, path: string) => void;
  onShowFileMenu?: (
    event: ReactMouseEvent<HTMLDivElement>,
    repositoryRoot: string,
    path: string,
    section: RepositorySection,
  ) => void;
  onRefresh?: () => Promise<void> | void;
};

const EMPTY_SELECTED_FILES = new Set<string>();

type RepositorySection = "staged" | "unstaged";

function selectionKey(repositoryRoot: string, path: string) {
  return JSON.stringify([repositoryRoot, normalizeGitPath(path)]);
}

function sectionCollapseKey(
  workspaceId: string,
  repositoryRoot: string,
  section: RepositorySection,
) {
  return JSON.stringify([workspaceId, repositoryRoot, section]);
}

export function GitMultiRepositoryChanges({
  workspaceId,
  statuses,
  isLoading,
  commitMessage,
  commitLoading,
  commitMessageLoading = false,
  commitError,
  commitMessageError,
  commitSummary,
  commitMessageEngine = "codex",
  commitComposerPlacement = "bottom",
  onCommitMessageChange,
  onCommitRepositories,
  onGenerateCommitMessage,
  onCommitMessageEngineChange,
  onStageFile,
  onUnstageFile,
  onUnstageAll,
  onUnstageFiles,
  onDiscardFile,
  onDiscardFiles,
  onStageAll,
  onOpenFile,
  onOpenFilePreview,
  onOpenFileContent,
  onOpenInlinePreview,
  onOpenInBrowser,
  onShowFileMenu,
  onRefresh,
}: GitMultiRepositoryChangesProps) {
  const { t } = useTranslation();
  const [selectionOverrides, setSelectionOverrides] = useState<Record<string, boolean>>({});
  const [collapsedSectionKeys, setCollapsedSectionKeys] = useState<Set<string>>(new Set());

  const topology = useMemo(() => statuses.flatMap((status) => [
    ...status.stagedFiles.map((file) => selectionKey(status.repositoryRoot, file.path)),
    ...status.unstagedFiles.map((file) => selectionKey(status.repositoryRoot, file.path)),
  ]), [statuses]);

  useEffect(() => {
    const validKeys = new Set(topology);
    setSelectionOverrides((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([key]) => validKeys.has(key)),
      );
      return Object.keys(next).length === Object.keys(previous).length ? previous : next;
    });
  }, [topology]);

  const groups = useMemo(() => statuses.map((status) => {
    const stagedPaths = new Set(status.stagedFiles.map((file) => normalizeGitPath(file.path)));
    const unstagedPaths = new Set(status.unstagedFiles.map((file) => normalizeGitPath(file.path)));
    const orderedPaths = Array.from(new Set([
      ...status.stagedFiles.map((file) => normalizeGitPath(file.path)),
      ...status.unstagedFiles.map((file) => normalizeGitPath(file.path)),
    ]));
    const lockedPaths = new Set(Array.from(stagedPaths).filter((path) => unstagedPaths.has(path)));
    const isSelected = (path: string) => {
      if (lockedPaths.has(path)) return true;
      const override = selectionOverrides[selectionKey(status.repositoryRoot, path)];
      return typeof override === "boolean" ? override : stagedPaths.has(path);
    };
    const selectedPaths: string[] = [];
    const excludedPaths: string[] = [];
    orderedPaths.forEach((path) => {
      if (isSelected(path)) selectedPaths.push(path);
      else excludedPaths.push(path);
    });
    const includedPaths = selectedPaths;
    const selectionState: InclusionState = selectedPaths.length === 0
      ? "none"
      : selectedPaths.length === orderedPaths.length
        ? "all"
        : "partial";
    return {
      status,
      orderedPaths,
      stagedPaths,
      lockedPaths,
      lockedPathsList: Array.from(lockedPaths),
      isCommitPathLocked: (path: string) => lockedPaths.has(normalizeGitPath(path)),
      selectedPaths,
      includedPaths,
      excludedPaths,
      selectionState,
    };
  }), [selectionOverrides, statuses]);

  const selections = useMemo<RepositoryCommitSelection[]>(() => groups
    .filter((group) => group.selectedPaths.length > 0 && !group.status.error)
    .map((group) => ({
      repositoryRoot: group.status.repositoryRoot,
      selectedPaths: group.selectedPaths,
    })), [groups]);
  const selectedCount = selections.reduce((count, selection) => count + selection.selectedPaths.length, 0);
  const canGenerateCommitMessage =
    selectedCount > 0 && !commitMessageLoading && !commitLoading;
  const commitComposer = (
    <GitCommitComposer
      commitMessage={commitMessage}
      onCommitMessageChange={onCommitMessageChange}
      selectedCount={selectedCount}
      hasAnyChanges={statuses.some(
        (status) =>
          status.stagedFiles.length > 0 || status.unstagedFiles.length > 0,
      )}
      canGenerate={Boolean(onGenerateCommitMessage) && canGenerateCommitMessage}
      commitLoading={commitLoading}
      commitMessageLoading={commitMessageLoading}
      commitError={commitError}
      commitMessageError={commitMessageError}
      hint={
        selectedCount > 0
          ? t("git.selectedFilesForCommit", { count: selectedCount })
          : t("git.selectFilesToCommit")
      }
      placement={commitComposerPlacement}
      engine={commitMessageEngine}
      onEngineChange={onCommitMessageEngineChange}
      onGenerate={(language, engine) => {
        void onGenerateCommitMessage?.(language, engine, selections);
      }}
      onCommit={() => {
        void onCommitRepositories?.(selections);
      }}
      footerExtra={
        commitSummary ? (
          <div className="git-repository-commit-summary" aria-live="polite">
            {commitSummary}
          </div>
        ) : null
      }
    />
  );
  const activateRepositoryFile = useCallback((
    status: RepositoryGitStatus,
    path: string,
    section: RepositorySection,
  ) => {
    const file = (section === "staged" ? status.stagedFiles : status.unstagedFiles)
      .find((candidate) => candidate.path === path);
    // Default activation opens editable DIFF modal (same as single-repo).
    if (file) {
      onOpenFilePreview?.(status.repositoryRoot, file, section);
      return;
    }
    onOpenFile?.(status.repositoryRoot, path);
  }, [onOpenFile, onOpenFilePreview]);

  const openRepositoryFileContent = useCallback((
    status: RepositoryGitStatus,
    file: DiffFile,
    section: RepositorySection,
  ) => {
    if (isDeletedDiffFile(file) || !onOpenFileContent) {
      onOpenFilePreview?.(status.repositoryRoot, file, section);
      return;
    }
    onOpenFileContent(status.repositoryRoot, file.path);
  }, [onOpenFileContent, onOpenFilePreview]);

  const setGroupSelection = (repositoryRoot: string, paths: string[], selected: boolean, stagedPaths: Set<string>) => {
    setSelectionOverrides((previous) => {
      const next = { ...previous };
      for (const path of paths) {
        const key = selectionKey(repositoryRoot, path);
        if (selected === stagedPaths.has(normalizeGitPath(path))) {
          delete next[key];
        } else {
          next[key] = selected;
        }
      }
      return next;
    });
  };

  const toggleSectionCollapsed = (
    repositoryRoot: string,
    section: RepositorySection,
  ) => {
    const key = sectionCollapseKey(workspaceId, repositoryRoot, section);
    setCollapsedSectionKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="git-multi-repository-changes" data-workspace-id={workspaceId}>
      {commitComposerPlacement === "top" ? commitComposer : null}
      <div className="git-multi-repository-changes__content">
        {isLoading && statuses.length === 0 ? <div className="diff-empty">{t("common.loading")}</div> : null}
        {!isLoading && statuses.length === 0 ? <div className="diff-empty">{t("git.noChangesDetected")}</div> : null}
        {groups.map(({ status, orderedPaths, stagedPaths, lockedPaths, lockedPathsList, isCommitPathLocked, includedPaths, excludedPaths, selectionState }) => (
          <section className="git-repository-change-group" key={status.repositoryRoot}>
          <header className="git-repository-change-group__header">
            <InclusionToggle
              state={selectionState}
              label={t("git.commitSelectionToggleScope", { path: status.displayName })}
              disabled={orderedPaths.length === 0 || Boolean(status.error)}
              onToggle={() => setGroupSelection(
                status.repositoryRoot,
                orderedPaths.filter((path) => !lockedPaths.has(path)),
                selectionState !== "all",
                stagedPaths,
              )}
            />
            <span className="git-repository-change-group__name">{status.displayName}</span>
            {onRefresh ? (
              <span className="git-repository-change-group__refresh">
                <button
                  type="button"
                  className={`git-status-refresh-button${isLoading ? " is-spinning" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onRefresh();
                  }}
                  disabled={isLoading}
                  aria-label={t("git.refreshStatus")}
                  title={t("git.refreshStatus")}
                >
                  <RefreshCw className="git-status-refresh-icon" size={13} aria-hidden />
                </button>
              </span>
            ) : null}
            <span className="git-repository-change-group__count">
              {status.totalAdditions > 0 || status.totalDeletions > 0 ? (
                <span
                  className="diff-counts-inline git-filetree-badge"
                  aria-label={`+${status.totalAdditions} -${status.totalDeletions}`}
                >
                  <span className="is-add">+{status.totalAdditions}</span>
                  <span className="is-sep" aria-hidden>/</span>
                  <span className="is-del">-{status.totalDeletions}</span>
                </span>
              ) : null}
              {t("git.filesChanged", { count: orderedPaths.length })}
            </span>
            <span className="git-repository-change-group__branch">{status.branchName}</span>
          </header>
          {status.error ? <div className="diff-error">{status.error}</div> : null}
          {status.stagedFiles.length > 0 ? (
            <DiffSection
              title={t("git.staged")}
              files={status.stagedFiles}
              section="staged"
              includedPaths={includedPaths}
              excludedPaths={excludedPaths}
              partialPaths={lockedPathsList}
              isCollapsed={collapsedSectionKeys.has(
                sectionCollapseKey(workspaceId, status.repositoryRoot, "staged"),
              )}
              onToggleCollapsed={() => toggleSectionCollapsed(status.repositoryRoot, "staged")}
              selectedFiles={EMPTY_SELECTED_FILES}
              selectedPath={null}
              onActivateFile={(path, section) =>
                activateRepositoryFile(status, path, section)
              }
              onUnstageAllChanges={onUnstageAll ? async () => {
                await onUnstageAll(status.repositoryRoot);
                await onRefresh?.();
              } : undefined}
              onUnstageFile={onUnstageFile ? async (path) => {
                await onUnstageFile(status.repositoryRoot, path);
                await onRefresh?.();
              } : undefined}
              onUnstageFiles={onUnstageFiles ? async (paths) => {
                await onUnstageFiles(status.repositoryRoot, paths);
                await onRefresh?.();
              } : undefined}
              isCommitPathLocked={isCommitPathLocked}
              onSetCommitSelection={(paths, selected) => setGroupSelection(status.repositoryRoot, paths, selected, stagedPaths)}
              onFileClick={(_event, path) => activateRepositoryFile(status, path, "staged")}
              onOpenFilePreview={
                onOpenFileContent
                  ? (file, section) => openRepositoryFileContent(status, file, section)
                  : undefined
              }
              onOpenInlinePreview={onOpenInlinePreview ? (path) => onOpenInlinePreview(status.repositoryRoot, path) : undefined}
              onOpenInBrowser={
                onOpenInBrowser
                  ? (path) => onOpenInBrowser(status.repositoryRoot, path)
                  : undefined
              }
              onShowFileMenu={(event, path, section) => {
                event.preventDefault();
                event.stopPropagation();
                onShowFileMenu?.(
                  event,
                  status.repositoryRoot,
                  path,
                  section,
                );
              }}
            />
          ) : null}
          {status.unstagedFiles.length > 0 ? (
            <DiffSection
              title={t("git.unstaged")}
              files={status.unstagedFiles}
              section="unstaged"
              includedPaths={includedPaths}
              excludedPaths={excludedPaths}
              partialPaths={lockedPathsList}
              isCollapsed={collapsedSectionKeys.has(
                sectionCollapseKey(workspaceId, status.repositoryRoot, "unstaged"),
              )}
              onToggleCollapsed={() => toggleSectionCollapsed(status.repositoryRoot, "unstaged")}
              selectedFiles={EMPTY_SELECTED_FILES}
              selectedPath={null}
              onActivateFile={(path, section) =>
                activateRepositoryFile(status, path, section)
              }
              onStageAllChanges={onStageAll ? async () => {
                await onStageAll(status.repositoryRoot);
                await onRefresh?.();
              } : undefined}
              onStageFile={onStageFile ? async (path) => {
                await onStageFile(status.repositoryRoot, path);
                await onRefresh?.();
              } : undefined}
              onDiscardFile={onDiscardFile ? (path) => onDiscardFile(status.repositoryRoot, path) : undefined}
              onDiscardFiles={onDiscardFiles ? (paths) => onDiscardFiles(status.repositoryRoot, paths) : undefined}
              isCommitPathLocked={isCommitPathLocked}
              onSetCommitSelection={(paths, selected) => setGroupSelection(status.repositoryRoot, paths, selected, stagedPaths)}
              onFileClick={(_event, path) => activateRepositoryFile(status, path, "unstaged")}
              onOpenFilePreview={
                onOpenFileContent
                  ? (file, section) => openRepositoryFileContent(status, file, section)
                  : undefined
              }
              onOpenInlinePreview={onOpenInlinePreview ? (path) => onOpenInlinePreview(status.repositoryRoot, path) : undefined}
              onOpenInBrowser={
                onOpenInBrowser
                  ? (path) => onOpenInBrowser(status.repositoryRoot, path)
                  : undefined
              }
              onShowFileMenu={(event, path, section) => {
                event.preventDefault();
                event.stopPropagation();
                onShowFileMenu?.(
                  event,
                  status.repositoryRoot,
                  path,
                  section,
                );
              }}
            />
          ) : null}
          </section>
        ))}
      </div>

      {commitComposerPlacement === "bottom" ? commitComposer : null}
    </div>
  );
}
