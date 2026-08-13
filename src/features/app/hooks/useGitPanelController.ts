import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GitFileDiff,
  GitFileStatus,
  GitHubPullRequest,
  GitHubPullRequestDiff,
  WorkspaceInfo,
} from "../../../types";
import { getGitDiffs } from "../../../services/tauri";
import { buildCanonicalGitChanges } from "../../git/utils/gitChangeModel";
import { useGitStatus } from "../../git/hooks/useGitStatus";
import { useGitDiffs } from "../../git/hooks/useGitDiffs";
import { useGitLog } from "../../git/hooks/useGitLog";
import { useGitCommitDiffs } from "../../git/hooks/useGitCommitDiffs";
import { getClientStoreSync, writeClientStoreValue } from "../../../services/clientStorage";
import type { GitLineMarkers } from "../../files/utils/gitLineMarkers";
import {
  resolveGitRootWorkspacePrefix,
  resolveGitStatusPathCandidates,
  resolveWorkspaceRelativePath,
} from "../../../utils/workspacePaths";
import type { FileCompareSession } from "../../files/types/fileCompare";
import { FILE_COMPARE_MAX_WORKSPACE_FILES } from "../../files/types/fileCompare";
import { applyStrictTabPermutation } from "../../files/utils/fileTabOrder";
import {
  GIT_GRAPH_TAB_ID,
  getFileHistoryTabId,
  type FileHistoryTarget,
} from "../../git-history/types";
import { recordQuickSwitcherFileOpened } from "../../quick-switcher/recentFiles";

const GIT_DIFF_LIST_VIEW_BY_WORKSPACE_KEY = "gitDiffListViewByWorkspace";
const GIT_DIFF_PRELOAD_MAX_CHANGED_FILES = 80;
const GIT_DIFF_PRELOAD_MAX_SINGLE_FILE_CHURN = 3_000;
const GIT_DIFF_PRELOAD_MAX_TOTAL_CHURN = 8_000;
const FALLBACK_FILE_TAB_WORKSPACE_KEY = "__no_workspace__";
const EMPTY_FILE_TABS: string[] = [];
const GIT_DIFF_PRELOAD_RISKY_FILE_NAMES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "cargo.lock",
  "pipfile.lock",
  "poetry.lock",
  "composer.lock",
]);
const GIT_DIFF_PRELOAD_RISKY_PATH_SEGMENTS = [
  "node_modules",
  ".pnpm",
  ".pnpm-store",
  ".next",
  "dist",
  "build",
  "coverage",
  "release-artifacts",
];

function normalizePathForPreloadCheck(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}

function isRiskyDiffPathForPreload(path: string): boolean {
  const normalizedPath = normalizePathForPreloadCheck(path);
  const segments = normalizedPath.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1] ?? normalizedPath;
  if (GIT_DIFF_PRELOAD_RISKY_FILE_NAMES.has(fileName)) {
    return true;
  }
  if (
    fileName.endsWith(".lock") ||
    fileName.endsWith(".min.js") ||
    fileName.endsWith(".bundle.js")
  ) {
    return true;
  }
  return segments.some((segment) =>
    GIT_DIFF_PRELOAD_RISKY_PATH_SEGMENTS.includes(segment),
  );
}

function shouldAutoPreloadDiffs(files: GitFileStatus[]): boolean {
  if (files.length === 0 || files.length > GIT_DIFF_PRELOAD_MAX_CHANGED_FILES) {
    return false;
  }
  if (files.some((file) => isRiskyDiffPathForPreload(file.path))) {
    return false;
  }
  let totalChurn = 0;
  for (const file of files) {
    const fileChurn = Math.max(0, file.additions) + Math.max(0, file.deletions);
    if (fileChurn >= GIT_DIFF_PRELOAD_MAX_SINGLE_FILE_CHURN) {
      return false;
    }
    totalChurn += fileChurn;
    if (totalChurn >= GIT_DIFF_PRELOAD_MAX_TOTAL_CHURN) {
      return false;
    }
  }
  return true;
}

function readGitDiffListView(workspaceId: string | null | undefined): "flat" | "tree" {
  if (!workspaceId) {
    return "flat";
  }
  const viewByWorkspace = getClientStoreSync<Record<string, "flat" | "tree">>(
    "app",
    GIT_DIFF_LIST_VIEW_BY_WORKSPACE_KEY,
  );
  return viewByWorkspace?.[workspaceId] === "tree" ? "tree" : "flat";
}

export type EditorNavigationLocation = {
  line: number;
  endLine?: number;
  column: number;
  scrollPosition?: "nearest" | "center";
};

export type EditorNavigationTarget = EditorNavigationLocation & {
  path: string;
  requestId: number;
};

export type EditorHighlightTarget = {
  path: string;
  markers: GitLineMarkers;
};

export type EditorSplitCompanion = "chat" | "notes" | "projectMap";

export type CenterMode =
  | "chat"
  | "diff"
  | "editor"
  | "notes"
  | "memory"
  | "projectMap"
  | "intentCanvas"
  | "fileCompare";

type GitHistoryTabsState = {
  activeTabId: string;
  fileHistoryTabs: FileHistoryTarget[];
};

const EMPTY_GIT_HISTORY_TABS_STATE: GitHistoryTabsState = {
  activeTabId: GIT_GRAPH_TAB_ID,
  fileHistoryTabs: [],
};

export type OpenFileOptions = {
  highlightMarkers?: GitLineMarkers | null;
  editorSplitCompanion?: EditorSplitCompanion;
  pathDomain?: "workspace" | "git";
  repositoryRoot?: string | null;
  targetWorkspace?: WorkspaceInfo | null;
};

function resolveEditorOpenPath(
  workspace: WorkspaceInfo | null,
  path: string,
  pathDomain: OpenFileOptions["pathDomain"] = "workspace",
  repositoryRoot?: string | null,
) {
  const workspaceRelativePath = resolveWorkspaceRelativePath(workspace?.path, path);
  if (pathDomain !== "git" || !workspace?.path) {
    return workspaceRelativePath;
  }

  const gitRootWorkspacePrefix = resolveGitRootWorkspacePrefix(
    workspace.path,
    repositoryRoot === undefined ? workspace.settings.gitRoot : repositoryRoot,
  );
  if (!gitRootWorkspacePrefix) {
    return workspaceRelativePath;
  }

  return (
    resolveGitStatusPathCandidates(
      workspace.path,
      gitRootWorkspacePrefix,
      path,
    )[0] ?? workspaceRelativePath
  );
}

type WorkspaceFileTabsState = {
  openTabs: string[];
  activeFilePath: string | null;
};

function resolveFileTabWorkspaceKey(workspace: WorkspaceInfo | null): string {
  return workspace?.id ?? FALLBACK_FILE_TAB_WORKSPACE_KEY;
}

function updateWorkspaceFileTabs(
  states: Record<string, WorkspaceFileTabsState>,
  workspaceKey: string,
  updater: (current: WorkspaceFileTabsState) => WorkspaceFileTabsState,
): Record<string, WorkspaceFileTabsState> {
  const current = states[workspaceKey] ?? {
    openTabs: EMPTY_FILE_TABS,
    activeFilePath: null,
  };
  const next = updater(current);
  if (next.openTabs.length === 0 && !next.activeFilePath) {
    if (!(workspaceKey in states)) {
      return states;
    }
    const remaining = { ...states };
    delete remaining[workspaceKey];
    return remaining;
  }
  if (
    current.activeFilePath === next.activeFilePath &&
    current.openTabs.length === next.openTabs.length &&
    current.openTabs.every((path, index) => path === next.openTabs[index])
  ) {
    return states;
  }
  return {
    ...states,
    [workspaceKey]: next,
  };
}

export function useGitPanelController({
  activeWorkspace,
  gitDiffPreloadEnabled,
  isCompact,
  isTablet,
  rightPanelCollapsed,
  activeTab,
  tabletTab,
  setActiveTab,
  prDiffs,
  prDiffsLoading,
  prDiffsError,
  onOpenEditorLayoutRequest,
  onOpenGitHistoryRequest,
  /** 非对话/Git 相关模式时降级轮询与 preload，减少无关根成本。 */
  appMode = "chat",
}: {
  activeWorkspace: WorkspaceInfo | null;
  gitDiffPreloadEnabled: boolean;
  isCompact: boolean;
  isTablet: boolean;
  rightPanelCollapsed: boolean;
  activeTab: "projects" | "codex" | "spec" | "git" | "log";
  tabletTab: "codex" | "spec" | "git" | "log";
  setActiveTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
  prDiffs: GitHubPullRequestDiff[];
  prDiffsLoading: boolean;
  prDiffsError: string | null;
  onOpenEditorLayoutRequest?: () => void;
  onOpenGitHistoryRequest?: () => void;
  appMode?: "chat" | "kanban" | "gitHistory" | "extensions";
}) {
  const [centerMode, setCenterMode] = useState<CenterMode>("chat");
  const [fileCompareSession, setFileCompareSession] =
    useState<FileCompareSession | null>(null);
  const [gitHistoryTabsState, setGitHistoryTabsState] =
    useState<GitHistoryTabsState>(EMPTY_GIT_HISTORY_TABS_STATE);
  const scratchFileCompareRequestIdRef = useRef(0);
  const [fileTabsByWorkspace, setFileTabsByWorkspace] = useState<
    Record<string, WorkspaceFileTabsState>
  >({});
  const [editorSplitCompanion, setEditorSplitCompanion] =
    useState<EditorSplitCompanion>("chat");
  const [editorNavigationTarget, setEditorNavigationTarget] =
    useState<EditorNavigationTarget | null>(null);
  const [editorHighlightTarget, setEditorHighlightTarget] =
    useState<EditorHighlightTarget | null>(null);
  const navigationRequestIdRef = useRef(0);
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null);
  const [selectedDiffRepositoryRoot, setSelectedDiffRepositoryRoot] = useState<
    string | null
  >(null);
  const [diffScrollRequestId, setDiffScrollRequestId] = useState(0);
  const pendingDiffScrollRef = useRef(false);
  const [gitPanelMode, setGitPanelMode] = useState<
    "diff" | "log" | "issues" | "prs"
  >("diff");
  const [gitDiffViewStyle, setGitDiffViewStyle] = useState<
    "split" | "unified"
  >("split");
  const [gitDiffListView, setGitDiffListViewState] = useState<"flat" | "tree">(
    () => readGitDiffListView(activeWorkspace?.id),
  );
  const [filePanelMode, setFilePanelModeRaw] = useState<
    "git" | "files" | "search" | "notes" | "prompts" | "memory" | "activity" | "radar"
  >("files");
  // DISABLED: disable-session-activity-and-solo-mode — never accept activity mode
  const setFilePanelMode = useCallback(
    (
      mode:
        | "git"
        | "files"
        | "search"
        | "notes"
        | "prompts"
        | "memory"
        | "activity"
        | "radar",
    ) => {
      setFilePanelModeRaw(mode === "activity" ? "files" : mode);
    },
    [],
  );
  const [selectedPullRequest, setSelectedPullRequest] =
    useState<GitHubPullRequest | null>(null);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(
    null,
  );
  const [diffSource, setDiffSource] = useState<"local" | "pr" | "commit">(
    "local",
  );
  const compactTab = isTablet ? tabletTab : activeTab;
  const fileTabWorkspaceKey = resolveFileTabWorkspaceKey(activeWorkspace);
  const currentFileTabsState = fileTabsByWorkspace[fileTabWorkspaceKey];
  const openFileTabs = currentFileTabsState?.openTabs ?? EMPTY_FILE_TABS;
  const activeEditorFilePath = currentFileTabsState?.activeFilePath ?? null;
  // kanban / extensions 全屏模式不展示 chat 右栏 Git 面板：只保留 background 兜底。
  // gitHistory / chat 仍按可见性决定 active 轮询。
  const isGitSurfaceMode = appMode === "chat" || appMode === "gitHistory";
  const isGitStatusPollingActive =
    isGitSurfaceMode &&
    (isCompact
      ? compactTab === "git"
      : centerMode === "diff" ||
        (!rightPanelCollapsed &&
          (filePanelMode === "git" ||
            filePanelMode === "files" ||
            filePanelMode === "search")));

  const { status: gitStatus, refresh: refreshGitStatus } = useGitStatus(
    activeWorkspace,
    { pollingMode: isGitStatusPollingActive ? "active" : "background" },
  );
  const gitStatusRefreshTimeoutRef = useRef<number | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const activeWorkspaceRef = useRef(activeWorkspace);
  const previousFileTabWorkspaceKeyRef = useRef(fileTabWorkspaceKey);

  useEffect(() => {
    activeWorkspaceIdRef.current = activeWorkspace?.id ?? null;
  }, [activeWorkspace?.id]);

  useEffect(() => {
    setGitDiffListViewState(readGitDiffListView(activeWorkspace?.id));
  }, [activeWorkspace?.id]);

  useEffect(() => {
    setSelectedDiffRepositoryRoot(null);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!selectedDiffPath) {
      setSelectedDiffRepositoryRoot(null);
    }
  }, [selectedDiffPath]);

  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
  }, [activeWorkspace]);

  useEffect(() => {
    if (previousFileTabWorkspaceKeyRef.current === fileTabWorkspaceKey) {
      return;
    }
    previousFileTabWorkspaceKeyRef.current = fileTabWorkspaceKey;
    setEditorNavigationTarget(null);
    setEditorHighlightTarget(null);
    setFileCompareSession(null);
    const settledEditorSplitCompanion =
      editorSplitCompanion === "notes" ? "chat" : editorSplitCompanion;
    const nextActiveFilePath = fileTabsByWorkspace[fileTabWorkspaceKey]?.activeFilePath ?? null;
    if (nextActiveFilePath) {
      if (settledEditorSplitCompanion !== editorSplitCompanion) {
        setEditorSplitCompanion(settledEditorSplitCompanion);
      }
      setCenterMode("editor");
      return;
    }
    if (centerMode === "fileCompare") {
      setFileCompareSession(null);
      setCenterMode("chat");
      return;
    }
    if (centerMode === "editor") {
      setCenterMode(settledEditorSplitCompanion);
      setEditorSplitCompanion("chat");
    }
  }, [
    centerMode,
    editorSplitCompanion,
    fileTabsByWorkspace,
    fileTabWorkspaceKey,
  ]);

  useEffect(() => {
    return () => {
      if (gitStatusRefreshTimeoutRef.current !== null) {
        window.clearTimeout(gitStatusRefreshTimeoutRef.current);
      }
    };
  }, []);

  const queueGitStatusRefresh = useCallback(() => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) {
      return;
    }
    if (gitStatusRefreshTimeoutRef.current !== null) {
      window.clearTimeout(gitStatusRefreshTimeoutRef.current);
    }
    gitStatusRefreshTimeoutRef.current = window.setTimeout(() => {
      gitStatusRefreshTimeoutRef.current = null;
      if (activeWorkspaceIdRef.current !== workspaceId) {
        return;
      }
      refreshGitStatus();
    }, 500);
  }, [refreshGitStatus]);

  const preloadedWorkspaceIdsRef = useRef<Set<string>>(new Set());
  const diffUiVisible =
    isGitSurfaceMode &&
    (centerMode === "diff" ||
      (isCompact ? compactTab === "git" : gitPanelMode === "diff"));
  const shouldPreloadDiffs = Boolean(
    isGitSurfaceMode &&
      gitDiffPreloadEnabled &&
      activeWorkspace &&
      !preloadedWorkspaceIdsRef.current.has(activeWorkspace.id) &&
      shouldAutoPreloadDiffs(gitStatus.files),
  );
  const shouldLoadLocalDiffs =
    Boolean(activeWorkspace) &&
    (shouldPreloadDiffs ||
      diffUiVisible ||
      Boolean(selectedDiffPath));
  const shouldLoadDiffs =
    Boolean(activeWorkspace) &&
    (diffSource === "local" ? shouldLoadLocalDiffs : diffUiVisible);
  const shouldLoadGitLog = gitPanelMode === "log" && Boolean(activeWorkspace);

  const {
    diffs: gitDiffs,
    isLoading: isDiffLoading,
    error: diffError,
    refresh: refreshGitDiffs,
  } = useGitDiffs(
    activeWorkspace,
    gitStatus.files,
    shouldLoadLocalDiffs,
    gitStatus.isGitRepository !== false,
  );

  useEffect(() => {
    if (!activeWorkspace || !shouldPreloadDiffs) {
      return;
    }
    if (!isDiffLoading && !diffError && gitDiffs.length === 0) {
      return;
    }
    preloadedWorkspaceIdsRef.current.add(activeWorkspace.id);
  }, [
    activeWorkspace,
    diffError,
    gitDiffs.length,
    isDiffLoading,
    shouldPreloadDiffs,
  ]);

  const {
    entries: gitLogEntries,
    total: gitLogTotal,
    ahead: gitLogAhead,
    behind: gitLogBehind,
    aheadEntries: gitLogAheadEntries,
    behindEntries: gitLogBehindEntries,
    upstream: gitLogUpstream,
    isLoading: gitLogLoading,
    error: gitLogError,
    refresh: refreshGitLog,
  } = useGitLog(activeWorkspace, shouldLoadGitLog);

  const {
    diffs: gitCommitDiffs,
    isLoading: gitCommitDiffsLoading,
    error: gitCommitDiffsError,
  } = useGitCommitDiffs(
    activeWorkspace,
    selectedCommitSha,
    shouldLoadDiffs && diffSource === "commit",
  );

  const useRepositoryScopedDiffs =
    diffSource === "local" && Boolean(selectedDiffRepositoryRoot);
  const [repositoryScopedDiffsState, setRepositoryScopedDiffsState] = useState<{
    diffs: GitFileDiff[];
    isLoading: boolean;
    error: string | null;
  }>({ diffs: [], isLoading: false, error: null });

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId || !useRepositoryScopedDiffs || !selectedDiffRepositoryRoot) {
      setRepositoryScopedDiffsState((previous) =>
        previous.diffs.length === 0 && !previous.isLoading && !previous.error
          ? previous
          : { diffs: [], isLoading: false, error: null },
      );
      return;
    }
    let cancelled = false;
    setRepositoryScopedDiffsState({ diffs: [], isLoading: true, error: null });
    getGitDiffs(workspaceId, selectedDiffRepositoryRoot)
      .then((diffs) => {
        if (!cancelled) {
          setRepositoryScopedDiffsState({ diffs, isLoading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRepositoryScopedDiffsState({
            diffs: [],
            isLoading: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id, selectedDiffRepositoryRoot, useRepositoryScopedDiffs]);

  const repositoryScopedViewerDiffs = useMemo(
    () =>
      buildCanonicalGitChanges({
        files: [],
        diffs: repositoryScopedDiffsState.diffs,
      }).viewerDiffs,
    [repositoryScopedDiffsState.diffs],
  );

  const activeDiffs =
    diffSource === "commit"
      ? gitCommitDiffs
      : diffSource === "pr"
        ? prDiffs
        : useRepositoryScopedDiffs
          ? repositoryScopedViewerDiffs
          : gitDiffs;
  const activeDiffLoading =
    diffSource === "commit"
      ? gitCommitDiffsLoading
      : diffSource === "pr"
        ? prDiffsLoading
        : useRepositoryScopedDiffs
          ? repositoryScopedDiffsState.isLoading
          : isDiffLoading;
  const activeDiffError =
    diffSource === "commit"
      ? gitCommitDiffsError
      : diffSource === "pr"
        ? prDiffsError
        : useRepositoryScopedDiffs
          ? repositoryScopedDiffsState.error
          : diffError;

  const handleSelectDiff = useCallback(
    (path: string, repositoryRoot?: string | null) => {
      setSelectedDiffPath(path);
      setSelectedDiffRepositoryRoot(repositoryRoot ?? null);
      pendingDiffScrollRef.current = true;
      setCenterMode("diff");
      setGitPanelMode("diff");
      setDiffSource("local");
      setSelectedCommitSha(null);
      setSelectedPullRequest(null);
      if (isCompact) {
        setActiveTab("git");
      }
    },
    [isCompact, setActiveTab],
  );

  const handleSelectCommit = useCallback(
    (sha: string) => {
      setSelectedCommitSha(sha);
      setSelectedDiffPath(null);
      pendingDiffScrollRef.current = true;
      setCenterMode("diff");
      setGitPanelMode("log");
      setDiffSource("commit");
      setSelectedPullRequest(null);
      if (isCompact) {
        setActiveTab("git");
      }
    },
    [isCompact, setActiveTab],
  );

  const handleActiveDiffPath = useCallback((path: string) => {
    setSelectedDiffPath(path);
  }, []);

  const setGitDiffListView = useCallback((nextView: "flat" | "tree") => {
    setGitDiffListViewState(nextView);
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) {
      return;
    }
    const viewByWorkspace = getClientStoreSync<Record<string, "flat" | "tree">>(
      "app",
      GIT_DIFF_LIST_VIEW_BY_WORKSPACE_KEY,
    ) ?? {};
    writeClientStoreValue("app", GIT_DIFF_LIST_VIEW_BY_WORKSPACE_KEY, {
      ...viewByWorkspace,
      [workspaceId]: nextView,
    });
  }, []);

  const handleGitPanelModeChange = useCallback(
    (mode: "diff" | "log" | "issues" | "prs") => {
      setGitPanelMode(mode);
      if (mode !== "prs") {
        if (diffSource === "pr") {
          setSelectedDiffPath(null);
        }
        setDiffSource("local");
        setSelectedPullRequest(null);
      }
      if (mode !== "log") {
        if (diffSource === "commit") {
          setSelectedDiffPath(null);
          setDiffSource("local");
        }
        setSelectedCommitSha(null);
      }
    },
    [diffSource],
  );

  const handleOpenFile = useCallback(
    (
      path: string,
      location?: EditorNavigationLocation,
      options?: OpenFileOptions,
    ) => {
      const targetWorkspace =
        options?.targetWorkspace ?? activeWorkspaceRef.current;
      const targetFileTabWorkspaceKey =
        resolveFileTabWorkspaceKey(targetWorkspace);
      const normalizedPath = resolveEditorOpenPath(
        targetWorkspace,
        path,
        options?.pathDomain,
        options?.repositoryRoot,
      );
      recordQuickSwitcherFileOpened({
        workspaceId: targetWorkspace?.id,
        path: normalizedPath,
      });
      setFileTabsByWorkspace((states) =>
        updateWorkspaceFileTabs(states, targetFileTabWorkspaceKey, (current) => ({
          openTabs: current.openTabs.includes(normalizedPath)
            ? current.openTabs
            : [...current.openTabs, normalizedPath],
          activeFilePath: normalizedPath,
        })),
      );
      setEditorHighlightTarget((current) => {
        if (options?.highlightMarkers) {
          return {
            path: normalizedPath,
            markers: options.highlightMarkers,
          };
        }
        if (!current || current.path !== normalizedPath) {
          return current;
        }
        return null;
      });
      if (location) {
        navigationRequestIdRef.current += 1;
        setEditorNavigationTarget({
          path: normalizedPath,
          line: location.line,
          endLine: location.endLine,
          column: location.column,
          scrollPosition: location.scrollPosition,
          requestId: navigationRequestIdRef.current,
        });
      }
      if (!isCompact) {
        onOpenEditorLayoutRequest?.();
      }
      setEditorSplitCompanion(options?.editorSplitCompanion ?? "chat");
      setCenterMode("editor");
      if (isCompact) {
        setActiveTab("codex");
      }
    },
    [
      isCompact,
      onOpenEditorLayoutRequest,
      setActiveTab,
    ],
  );

  const handleOpenWorkspaceFileCompare = useCallback(
    (paths: string[]) => {
      const workspace = activeWorkspaceRef.current;
      if (!workspace?.id) {
        return false;
      }
      const normalizedPaths = Array.from(
        new Set(
          paths
            .map((path) => resolveWorkspaceRelativePath(workspace.path, path))
            .map((path) => path.trim())
            .filter(Boolean),
        ),
      );
      if (
        normalizedPaths.length < 2 ||
        normalizedPaths.length > FILE_COMPARE_MAX_WORKSPACE_FILES
      ) {
        return false;
      }
      setFileCompareSession({
        kind: "workspace",
        workspaceId: workspace.id,
        paths: normalizedPaths,
      });
      setCenterMode("fileCompare");
      if (isCompact) {
        setActiveTab("codex");
      }
      return true;
    },
    [isCompact, setActiveTab],
  );

  const handleOpenScratchFileCompare = useCallback(() => {
    scratchFileCompareRequestIdRef.current += 1;
    setFileCompareSession({
      kind: "scratch",
      requestId: scratchFileCompareRequestIdRef.current,
    });
    setCenterMode("fileCompare");
    if (isCompact) {
      setActiveTab("codex");
    }
  }, [isCompact, setActiveTab]);

  const handleCloseFileCompare = useCallback(() => {
    setFileCompareSession(null);
    setCenterMode("chat");
  }, []);

  const handleOpenFileHistory = useCallback((target: FileHistoryTarget) => {
    const tabId = getFileHistoryTabId(target);
    setGitHistoryTabsState((current) => {
      const existingIndex = current.fileHistoryTabs.findIndex(
        (entry) => getFileHistoryTabId(entry) === tabId,
      );
      const fileHistoryTabs = existingIndex < 0
        ? [...current.fileHistoryTabs, target]
        : current.fileHistoryTabs.map((entry, index) =>
            index === existingIndex ? target : entry,
          );
      return { activeTabId: tabId, fileHistoryTabs };
    });
    onOpenGitHistoryRequest?.();
  }, [onOpenGitHistoryRequest]);

  const handleActivateGitHistoryTab = useCallback((tabId: string) => {
    setGitHistoryTabsState((current) => {
      const tabExists = tabId === GIT_GRAPH_TAB_ID || current.fileHistoryTabs.some(
        (target) => getFileHistoryTabId(target) === tabId,
      );
      return tabExists && current.activeTabId !== tabId
        ? { ...current, activeTabId: tabId }
        : current;
    });
  }, []);

  const handleCloseFileHistory = useCallback((tabId?: string) => {
    setGitHistoryTabsState((current) => {
      const closingTabId = tabId ?? current.activeTabId;
      const closingIndex = current.fileHistoryTabs.findIndex(
        (target) => getFileHistoryTabId(target) === closingTabId,
      );
      if (closingIndex < 0) {
        return current;
      }
      const fileHistoryTabs = current.fileHistoryTabs.filter(
        (target) => getFileHistoryTabId(target) !== closingTabId,
      );
      if (current.activeTabId !== closingTabId) {
        return { ...current, fileHistoryTabs };
      }
      const fallbackTarget =
        current.fileHistoryTabs[closingIndex + 1] ??
        current.fileHistoryTabs[closingIndex - 1] ??
        null;
      return {
        activeTabId: fallbackTarget
          ? getFileHistoryTabId(fallbackTarget)
          : GIT_GRAPH_TAB_ID,
        fileHistoryTabs,
      };
    });
  }, []);

  const handleCloseOtherFileHistories = useCallback((tabId: string) => {
    setGitHistoryTabsState((current) => {
      const target = current.fileHistoryTabs.find(
        (entry) => getFileHistoryTabId(entry) === tabId,
      );
      return target
        ? { activeTabId: tabId, fileHistoryTabs: [target] }
        : current;
    });
  }, []);

  const handleCloseAllFileHistories = useCallback(() => {
    setGitHistoryTabsState((current) =>
      current.fileHistoryTabs.length > 0 || current.activeTabId !== GIT_GRAPH_TAB_ID
        ? EMPTY_GIT_HISTORY_TABS_STATE
        : current,
    );
  }, []);

  const handleActivateFileTab = useCallback((path: string) => {
    recordQuickSwitcherFileOpened({
      workspaceId: activeWorkspaceRef.current?.id,
      path,
    });
    setFileTabsByWorkspace((states) =>
      updateWorkspaceFileTabs(states, fileTabWorkspaceKey, (current) => ({
        openTabs: current.openTabs.includes(path)
          ? current.openTabs
          : [...current.openTabs, path],
        activeFilePath: path,
      })),
    );
    setEditorNavigationTarget(null);
    setCenterMode("editor");
  }, [fileTabWorkspaceKey]);

  const handleCloseFileTab = useCallback(
    (path: string) => {
      setFileTabsByWorkspace((states) =>
        updateWorkspaceFileTabs(states, fileTabWorkspaceKey, (current) => {
          const closingIndex = current.openTabs.indexOf(path);
          if (closingIndex < 0) {
            return current;
          }
          const nextTabs = current.openTabs.filter((entry) => entry !== path);
          const fallback =
            current.activeFilePath && current.activeFilePath !== path
              ? nextTabs.includes(current.activeFilePath)
                ? current.activeFilePath
                : nextTabs[0] ?? null
              : nextTabs[closingIndex] ?? nextTabs[closingIndex - 1] ?? null;
          if (!fallback && centerMode === "editor") {
            setCenterMode(editorSplitCompanion);
            setEditorSplitCompanion("chat");
          }
          setEditorNavigationTarget((current) =>
            current && current.path === path ? null : current,
          );
          setEditorHighlightTarget((current) =>
            current && current.path === path ? null : current,
          );
          return { openTabs: nextTabs, activeFilePath: fallback };
        }),
      );
    },
    [centerMode, editorSplitCompanion, fileTabWorkspaceKey],
  );

  const handleCloseAllFileTabs = useCallback(() => {
    setFileTabsByWorkspace((states) =>
      updateWorkspaceFileTabs(states, fileTabWorkspaceKey, () => ({
        openTabs: EMPTY_FILE_TABS,
        activeFilePath: null,
      })),
    );
    setEditorNavigationTarget(null);
    setEditorHighlightTarget(null);
    setEditorSplitCompanion("chat");
    setCenterMode(editorSplitCompanion);
  }, [editorSplitCompanion, fileTabWorkspaceKey]);
  const handleCloseOtherFileTabs = useCallback(
    (path: string) => {
      setFileTabsByWorkspace((states) =>
        updateWorkspaceFileTabs(states, fileTabWorkspaceKey, (current) => {
          if (!current.openTabs.includes(path) || current.openTabs.length <= 1) {
            return current;
          }
          setEditorNavigationTarget((currentTarget) =>
            currentTarget?.path === path ? currentTarget : null,
          );
          setEditorHighlightTarget((currentTarget) =>
            currentTarget?.path === path ? currentTarget : null,
          );
          setCenterMode("editor");
          return { openTabs: [path], activeFilePath: path };
        }),
      );
    },
    [fileTabWorkspaceKey],
  );
  const handleReorderFileTabs = useCallback(
    (nextOrder: string[]) => {
      setFileTabsByWorkspace((states) =>
        updateWorkspaceFileTabs(states, fileTabWorkspaceKey, (current) =>
          applyStrictTabPermutation(current, nextOrder),
        ),
      );
    },
    [fileTabWorkspaceKey],
  );

  const handleExitEditor = useCallback(() => {
    setCenterMode(editorSplitCompanion);
    setFileTabsByWorkspace((states) =>
      updateWorkspaceFileTabs(states, fileTabWorkspaceKey, () => ({
        openTabs: EMPTY_FILE_TABS,
        activeFilePath: null,
      })),
    );
    setEditorNavigationTarget(null);
    setEditorHighlightTarget(null);
    setEditorSplitCompanion("chat");
  }, [editorSplitCompanion, fileTabWorkspaceKey]);

  useEffect(() => {
    if (!selectedDiffPath) {
      pendingDiffScrollRef.current = false;
    }
  }, [selectedDiffPath]);

  useEffect(() => {
    if (!pendingDiffScrollRef.current) {
      return;
    }
    if (!selectedDiffPath) {
      return;
    }
    if (centerMode !== "diff") {
      return;
    }
    if (!activeDiffs.some((entry) => entry.path === selectedDiffPath)) {
      return;
    }
    setDiffScrollRequestId((current) => current + 1);
    pendingDiffScrollRef.current = false;
  }, [activeDiffs, centerMode, selectedDiffPath]);

  return {
    centerMode,
    setCenterMode,
    fileCompareSession,
    fileHistoryTabs: gitHistoryTabsState.fileHistoryTabs,
    activeGitHistoryTabId: gitHistoryTabsState.activeTabId,
    openFileTabs,
    activeEditorFilePath,
    editorSplitCompanion,
    setEditorSplitCompanion,
    editorNavigationTarget,
    editorHighlightTarget,
    selectedDiffPath,
    setSelectedDiffPath,
    diffScrollRequestId,
    gitPanelMode,
    setGitPanelMode,
    gitDiffViewStyle,
    setGitDiffViewStyle,
    gitDiffListView,
    setGitDiffListView,
    filePanelMode,
    setFilePanelMode,
    selectedPullRequest,
    setSelectedPullRequest,
    selectedCommitSha,
    setSelectedCommitSha,
    diffSource,
    setDiffSource,
    gitStatus,
    refreshGitStatus,
    queueGitStatusRefresh,
    gitDiffs,
    isDiffLoading,
    diffError,
    refreshGitDiffs,
    gitLogEntries,
    gitLogTotal,
    gitLogAhead,
    gitLogBehind,
    gitLogAheadEntries,
    gitLogBehindEntries,
    gitLogUpstream,
    gitLogLoading,
    gitLogError,
    refreshGitLog,
    gitCommitDiffs,
    gitCommitDiffsLoading,
    gitCommitDiffsError,
    shouldLoadDiffs,
    activeDiffs,
    activeDiffLoading,
    activeDiffError,
    handleSelectDiff,
    handleSelectCommit,
    handleActiveDiffPath,
    handleGitPanelModeChange,
    handleOpenFile,
    handleOpenWorkspaceFileCompare,
    handleOpenScratchFileCompare,
    handleCloseFileCompare,
    handleOpenFileHistory,
    handleActivateGitHistoryTab,
    handleCloseFileHistory,
    handleCloseOtherFileHistories,
    handleCloseAllFileHistories,
    handleActivateFileTab,
    handleCloseFileTab,
    handleCloseOtherFileTabs,
    handleCloseAllFileTabs,
    handleReorderFileTabs,
    handleExitEditor,
    compactTab,
    activeWorkspaceIdRef,
    activeWorkspaceRef,
  };
}
