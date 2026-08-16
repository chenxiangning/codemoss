import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  resolveRuntimeThreadCanInterrupt,
  useOptionalRuntimeThreadContext,
} from "../domains/runtimeThreadProvider";
import { useGlobalSearchShortcut } from "../../features/app/hooks/useGlobalSearchShortcut";
import { useInterruptShortcut } from "../../features/app/hooks/useInterruptShortcut";
import { usePullRequestComposer } from "../../features/git/hooks/usePullRequestComposer";
import type { CenterMode } from "../../features/app/hooks/useGitPanelController";
import { recordSearchResultOpen } from "../../features/search/ranking/recencyStore";
import {
  loadRecentSearchActions,
  recordRecentSearchAction,
} from "../../features/search/ranking/recentActions";
import {
  searchActions,
  type SearchActionDescriptor,
} from "../../features/search/providers/actionsProvider";
import { projectRecentDiscoveryResults } from "../../features/search/providers/recentDiscoveryProvider";
import type { KanbanTask } from "@mossx/plugin-kanban";
import type {
  SearchContentFilter,
  SearchResult,
  SearchScope,
} from "../../features/search/types";
import { resolveSearchScopeOnOpen } from "../../features/search/utils/scope";
import { toggleSearchContentFilters } from "../../features/search/utils/contentFilters";
import { useEventCallback } from "../../utils/useEventCallback";
import type {
  AppSettings,
  GitHubPullRequest,
  GitHubPullRequestDiff,
  MessageSendOptions,
  WorkspaceInfo,
} from "../../types";
import type {
  QuickSwitcherNavigationId,
  QuickSwitcherRecentFileGroup,
  QuickSwitcherRunningSession,
  QuickSwitcherSessionGroup,
} from "@mossx/plugin-quick-switcher/runtime";
import {
  getThreadSelectDiffCleanupAction,
  shouldPreserveEditorOnThreadSelect,
} from "./threadEditorPreservation";

type AppShellTab = "projects" | "codex" | "spec" | "git" | "log";
type DiffSource = "local" | "pr" | "commit";
type FilePanelMode =
  | "git"
  | "files"
  | "search"
  | "notes"
  | "prompts"
  | "memory"
  | "activity"
  | "radar";
type GitPanelMode = "diff" | "log" | "issues" | "prs";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export const COMPOSER_SEARCH_BOUNDARY_FIELD_GROUPS = {
  searchPalette: [
    "activeEditorFilePath",
    "activeWorkspaceId",
    "appSettings",
    "canInterrupt",
    "centerMode",
    "exitDiffView",
    "getActiveDraft",
    "handleDraftChange",
    "handleOpenFile",
    "interruptTurn",
    "isCompact",
    "isSearchPaletteOpen",
    "searchPaletteQuery",
    "searchContentFilters",
    "searchResults",
    "searchScope",
    "selectWorkspace",
    "setActiveTab",
    "setActiveThreadId",
    "setDiffSource",
    "setIsSearchPaletteOpen",
    "setSearchContentFilters",
    "setSearchPaletteQuery",
    "setSearchPaletteSelectedIndex",
    "setSearchScope",
    "setSelectedCommitSha",
    "setSelectedDiffPath",
    "setSelectedPullRequest",
  ],
  composerSend: [
    "activeWorkspace",
    "clearActiveImages",
    "connectWorkspace",
    "gitPullRequestDiffs",
    "handleSend",
    "queueMessage",
    "selectedPullRequest",
    "sendUserMessageToThread",
    "startThreadForWorkspace",
  ],
  gitSearchOpen: [
    "filePanelMode",
    "gitPanelMode",
    "setCenterMode",
    "setGitPanelMode",
    "setPrefillDraft",
  ],
  kanbanBridge: [
    "kanbanTasks",
    "setAppMode",
    "setKanbanViewState",
    "setSelectedKanbanTaskId",
    "workspacesByPath",
  ],
} as const;

export type SearchPaletteBoundary = {
  activeEditorFilePath: string | null | undefined;
  activeWorkspaceId: string | null;
  appSettings: Pick<
    AppSettings,
    "interruptShortcut" | "toggleGlobalSearchShortcut"
  >;
  canInterrupt: boolean;
  centerMode: CenterMode;
  exitDiffView: () => void;
  getActiveDraft: () => string;
  handleDraftChange: (draft: string) => void;
  handleOpenFile: (
    filePath: string,
    location?: {
      line: number;
      endLine?: number;
      column: number;
      scrollPosition?: "nearest" | "center";
    },
    options?: { targetWorkspace?: WorkspaceInfo | null },
  ) => void;
  interruptTurn: () => Promise<unknown> | unknown;
  isCompact: boolean;
  isSearchPaletteOpen: boolean;
  searchPaletteQuery: string;
  searchContentFilters: SearchContentFilter[];
  searchResults: SearchResult[];
  searchScope: SearchScope;
  selectWorkspace: (workspaceId: string) => void;
  setActiveTab: (tab: AppShellTab) => void;
  setActiveThreadId: (threadId: string, workspaceId: string) => void;
  setDiffSource: (source: DiffSource) => void;
  setIsSearchPaletteOpen: (open: boolean) => void;
  setSearchContentFilters: (
    updater: (previous: SearchContentFilter[]) => SearchContentFilter[],
  ) => void;
  setSearchPaletteQuery: (query: string) => void;
  setSearchPaletteSelectedIndex: (
    updater: number | ((previous: number) => number),
  ) => void;
  setSearchScope: (scope: SearchScope) => void;
  setSelectedCommitSha: (sha: string | null) => void;
  setSelectedDiffPath: (path: string | null) => void;
  setSelectedPullRequest: (pullRequest: GitHubPullRequest | null) => void;
  workspacesById: Map<string, WorkspaceInfo>;
};

export type ComposerSendBoundary = {
  activeWorkspace: WorkspaceInfo | null;
  clearActiveImages: () => void;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  gitPullRequestDiffs: GitHubPullRequestDiff[];
  handleSend: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => Promise<void>;
  queueMessage: (
    text: string,
    images: string[],
    options?: MessageSendOptions,
  ) => Promise<void>;
  selectedPullRequest: GitHubPullRequest | null;
  sendUserMessageToThread: (
    workspace: WorkspaceInfo,
    threadId: string,
    text: string,
    images?: string[],
    options?: MessageSendOptions,
  ) => Promise<unknown>;
  startThreadForWorkspace: (
    workspaceId: string,
    options?: { activate?: boolean },
  ) => Promise<string | null>;
};

export type GitSearchOpenBoundary = {
  filePanelMode: FilePanelMode;
  gitPanelMode: GitPanelMode;
  setCenterMode: (mode: CenterMode) => void;
  setGitPanelMode: (mode: GitPanelMode) => void;
  setPrefillDraft: (draft: {
    id: string;
    text: string;
    createdAt: number;
  }) => void;
};

export type KanbanComposerBridgeBoundary = {
  kanbanTasks: KanbanTask[];
  setAppMode: (mode: "chat" | "kanban") => void;
  setKanbanViewState: (state: {
    view: "board";
    workspaceId: string;
    panelId: string;
  }) => void;
  setSelectedKanbanTaskId: (taskId: string | null) => void;
  workspacesByPath: Map<string, WorkspaceInfo>;
};

export type ComposerSearchShellBoundary = SearchPaletteBoundary &
  ComposerSendBoundary &
  GitSearchOpenBoundary &
  KanbanComposerBridgeBoundary & {
    closeQuickSwitcher: () => void;
    handleOpenQuickSwitcher: () => void;
    handleAddAgent: (workspace: WorkspaceInfo) => Promise<unknown>;
    handleQuickSwitcherNavigate: (target: QuickSwitcherNavigationId) => void;
    handleQuickSwitcherSelectFile: (workspaceId: string, path: string) => void;
    handleQuickSwitcherSelectSession: (
      workspaceId: string,
      threadId: string,
    ) => void;
    isQuickSwitcherOpen: boolean;
    quickSwitcherRecentFileGroups: QuickSwitcherRecentFileGroup[];
    quickSwitcherRunningSessions: QuickSwitcherRunningSession[];
    quickSwitcherSessionGroups: QuickSwitcherSessionGroup[];
    increaseUiScale: () => void;
    decreaseUiScale: () => void;
    resetUiScale: () => void;
  };

/** T2.4：分组 API（identity / send / navigation / search / chrome） */
export type AppShellSearchAndComposerSectionInput = {
  identity: {
    activeWorkspace: WorkspaceInfo | null;
    activeWorkspaceId: string | null;
    workspacesById: Map<string, WorkspaceInfo>;
    workspacesByPath: Map<string, WorkspaceInfo>;
    appSettings: SearchPaletteBoundary["appSettings"];
    isCompact: boolean;
  };
  send: ComposerSendBoundary & {
    canInterrupt: boolean;
    interruptTurn: SearchPaletteBoundary["interruptTurn"];
    getActiveDraft: SearchPaletteBoundary["getActiveDraft"];
    handleDraftChange: SearchPaletteBoundary["handleDraftChange"];
    handleAddAgent: (workspace: WorkspaceInfo) => Promise<unknown>;
  };
  navigation: GitSearchOpenBoundary & {
    centerMode: CenterMode;
    selectWorkspace: SearchPaletteBoundary["selectWorkspace"];
    setActiveTab: SearchPaletteBoundary["setActiveTab"];
    setActiveThreadId: SearchPaletteBoundary["setActiveThreadId"];
    setAppMode: KanbanComposerBridgeBoundary["setAppMode"];
    setDiffSource: SearchPaletteBoundary["setDiffSource"];
    exitDiffView: SearchPaletteBoundary["exitDiffView"];
    handleOpenFile: SearchPaletteBoundary["handleOpenFile"];
    setKanbanViewState: KanbanComposerBridgeBoundary["setKanbanViewState"];
    setSelectedKanbanTaskId: KanbanComposerBridgeBoundary["setSelectedKanbanTaskId"];
  };
  search: {
    isSearchPaletteOpen: boolean;
    searchPaletteQuery: string;
    searchContentFilters: SearchContentFilter[];
    searchResults: SearchResult[];
    searchScope: SearchScope;
    setIsSearchPaletteOpen: SearchPaletteBoundary["setIsSearchPaletteOpen"];
    setSearchContentFilters: SearchPaletteBoundary["setSearchContentFilters"];
    setSearchPaletteQuery: SearchPaletteBoundary["setSearchPaletteQuery"];
    setSearchPaletteSelectedIndex: SearchPaletteBoundary["setSearchPaletteSelectedIndex"];
    setSearchScope: SearchPaletteBoundary["setSearchScope"];
    setSelectedCommitSha: SearchPaletteBoundary["setSelectedCommitSha"];
    setSelectedDiffPath: SearchPaletteBoundary["setSelectedDiffPath"];
    setSelectedPullRequest: SearchPaletteBoundary["setSelectedPullRequest"];
    activeEditorFilePath: string | null | undefined;
  };
  chrome: {
    closeQuickSwitcher: () => void;
    handleOpenQuickSwitcher: () => void;
    handleQuickSwitcherNavigate: (target: QuickSwitcherNavigationId) => void;
    handleQuickSwitcherSelectFile: (workspaceId: string, path: string) => void;
    handleQuickSwitcherSelectSession: (
      workspaceId: string,
      threadId: string,
    ) => void;
    isQuickSwitcherOpen: boolean;
    quickSwitcherRecentFileGroups: QuickSwitcherRecentFileGroup[];
    quickSwitcherRunningSessions: QuickSwitcherRunningSession[];
    quickSwitcherSessionGroups: QuickSwitcherSessionGroup[];
    increaseUiScale: () => void;
    decreaseUiScale: () => void;
    resetUiScale: () => void;
    kanbanTasks: KanbanTask[];
  };
};

export function flattenSearchAndComposerSectionInput(
  input: AppShellSearchAndComposerSectionInput,
): ComposerSearchShellBoundary {
  return {
    ...input.identity,
    ...input.send,
    ...input.navigation,
    ...input.search,
    ...input.chrome,
  };
}

export function useAppShellSearchAndComposerSection(
  input: AppShellSearchAndComposerSectionInput | ComposerSearchShellBoundary,
) {
  const { t } = useTranslation();
  // T2.1/T2.2：优先 RuntimeThread / Composer Provider
  const runtimeThreadContext = useOptionalRuntimeThreadContext();
  // T2.4：分组入参展平为 boundary（contract 脚本识别 `boundary` 解构）
  const boundary: ComposerSearchShellBoundary =
    "identity" in input &&
    (input as AppShellSearchAndComposerSectionInput).identity
      ? flattenSearchAndComposerSectionInput(
          input as AppShellSearchAndComposerSectionInput,
        )
      : (input as ComposerSearchShellBoundary);
  const {
    activeEditorFilePath,
    activeWorkspace,
    activeWorkspaceId,
    appSettings,
    canInterrupt: propCanInterrupt,
    centerMode,
    clearActiveImages,
    closeQuickSwitcher,
    connectWorkspace,
    decreaseUiScale: _decreaseUiScale,
    exitDiffView,
    filePanelMode,
    getActiveDraft,
    gitPanelMode,
    gitPullRequestDiffs,
    handleDraftChange,
    handleAddAgent,
    handleOpenFile,
    handleOpenQuickSwitcher,
    handleQuickSwitcherNavigate,
    handleQuickSwitcherSelectFile,
    handleQuickSwitcherSelectSession,
    handleSend,
    interruptTurn,
    increaseUiScale: _increaseUiScale,
    isCompact,
    isSearchPaletteOpen,
    isQuickSwitcherOpen,
    kanbanTasks,
    queueMessage,
    quickSwitcherRecentFileGroups,
    quickSwitcherRunningSessions,
    quickSwitcherSessionGroups,
    resetUiScale: _resetUiScale,
    searchContentFilters,
    searchPaletteQuery,
    searchResults,
    searchScope,
    selectWorkspace,
    selectedPullRequest,
    sendUserMessageToThread,
    setActiveTab,
    setActiveThreadId,
    setAppMode,
    setCenterMode,
    setDiffSource,
    setGitPanelMode,
    setIsSearchPaletteOpen,
    setKanbanViewState,
    setPrefillDraft,
    setSearchContentFilters,
    setSearchPaletteQuery,
    setSearchPaletteSelectedIndex,
    setSearchScope,
    setSelectedCommitSha,
    setSelectedDiffPath,
    setSelectedKanbanTaskId,
    setSelectedPullRequest,
    startThreadForWorkspace,
    workspacesById,
    workspacesByPath,
  } = boundary;
  const canInterrupt = resolveRuntimeThreadCanInterrupt({
    propCanInterrupt,
    contextValue: runtimeThreadContext,
  });

  const searchActionsRegistry = useMemo<SearchActionDescriptor[]>(
    () => [
      {
        id: "open-settings",
        title: t("settings.openSettings"),
        keywords: ["设置", "偏好设置", "settings", "preferences"],
        execute: () => handleQuickSwitcherNavigate("settings"),
      },
      {
        id: "open-terminal",
        title: t("menu.toggleTerminal"),
        keywords: ["终端", "命令行", "terminal", "shell"],
        execute: () => handleQuickSwitcherNavigate("terminal"),
      },
      {
        id: "open-git",
        title: t("panels.git"),
        keywords: ["版本控制", "代码变更", "git", "changes"],
        execute: () => handleQuickSwitcherNavigate("git"),
      },
      {
        id: "new-session",
        title: t("settings.newAgent"),
        keywords: ["新建会话", "新会话", "new session", "new agent"],
        execute: async () => {
          if (!activeWorkspace) {
            return;
          }
          setAppMode("chat");
          setActiveTab("codex");
          await handleAddAgent(activeWorkspace);
        },
      },
      {
        id: "open-recent-activity",
        title: t("quickSwitcher.open"),
        keywords: ["最近文件", "最近会话", "最近活动", "recent files", "recent sessions"],
        execute: handleOpenQuickSwitcher,
      },
      // UI scale actions removed — scale permanently locked to 100%.
    ],
    [
      activeWorkspace,
      handleAddAgent,
      handleOpenQuickSwitcher,
      handleQuickSwitcherNavigate,
      setActiveTab,
      setAppMode,
      t,
    ],
  );
  const actionById = useMemo(
    () => new Map(searchActionsRegistry.map((action) => [action.id, action])),
    [searchActionsRegistry],
  );
  const normalizedSearchQuery = searchPaletteQuery.trim();
  const includesActions = searchContentFilters.includes("all")
    || searchContentFilters.includes("actions");
  const actionSearchResults = useMemo(
    () => includesActions ? searchActions(normalizedSearchQuery, searchActionsRegistry) : [],
    [includesActions, normalizedSearchQuery, searchActionsRegistry],
  );
  const recentSearchResults = useMemo(
    () => {
      if (!isSearchPaletteOpen || normalizedSearchQuery) {
        return [];
      }
      return projectRecentDiscoveryResults({
        actions: includesActions ? searchActionsRegistry : [],
        recentActions: loadRecentSearchActions(),
        recentFileGroups: searchContentFilters.includes("all")
          || searchContentFilters.includes("files")
          ? quickSwitcherRecentFileGroups
          : [],
        sessionGroups: searchContentFilters.includes("all")
          || searchContentFilters.includes("threads")
          ? quickSwitcherSessionGroups
          : [],
        scope: searchScope,
        activeWorkspaceId,
      });
    },
    [
      activeWorkspaceId,
      includesActions,
      isSearchPaletteOpen,
      normalizedSearchQuery,
      quickSwitcherRecentFileGroups,
      quickSwitcherSessionGroups,
      searchActionsRegistry,
      searchContentFilters,
      searchScope,
    ],
  );
  const visibleSearchResults = useMemo(
    () => normalizedSearchQuery
      ? [...actionSearchResults, ...searchResults]
      : recentSearchResults,
    [actionSearchResults, normalizedSearchQuery, recentSearchResults, searchResults],
  );

  const closeSearchPalette = useCallback(() => {
    setIsSearchPaletteOpen(false);
    setSearchPaletteQuery("");
    setSearchPaletteSelectedIndex(0);
  }, [
    setIsSearchPaletteOpen,
    setSearchPaletteQuery,
    setSearchPaletteSelectedIndex,
  ]);

  const handleOpenSearchPalette = useCallback(() => {
    const nextScope = resolveSearchScopeOnOpen(searchScope, activeWorkspaceId);
    if (nextScope !== searchScope) {
      setSearchScope(nextScope);
    }
    setIsSearchPaletteOpen(true);
    setSearchPaletteSelectedIndex(0);
  }, [
    activeWorkspaceId,
    searchScope,
    setIsSearchPaletteOpen,
    setSearchPaletteSelectedIndex,
    setSearchScope,
  ]);

  const handleToggleSearchPalette = useCallback(() => {
    if (isSearchPaletteOpen) {
      closeSearchPalette();
      return;
    }
    handleOpenSearchPalette();
  }, [closeSearchPalette, handleOpenSearchPalette, isSearchPaletteOpen]);

  useGlobalSearchShortcut({
    isEnabled: true,
    shortcut: appSettings.toggleGlobalSearchShortcut,
    onTrigger: handleToggleSearchPalette,
  });

  useEffect(() => {
    if (!isSearchPaletteOpen) {
      return;
    }
    setSearchPaletteSelectedIndex(0);
  }, [isSearchPaletteOpen, searchPaletteQuery, setSearchPaletteSelectedIndex]);

  const handleSearchPaletteMoveSelection = useCallback(
    (direction: "up" | "down") => {
      if (!visibleSearchResults.length) {
        return;
      }
      setSearchPaletteSelectedIndex((prev) => {
        if (direction === "down") {
          return (prev + 1) % visibleSearchResults.length;
        }
        return (prev - 1 + visibleSearchResults.length) % visibleSearchResults.length;
      });
    },
    [visibleSearchResults.length, setSearchPaletteSelectedIndex],
  );

  const handleToggleSearchContentFilter = useCallback(
    (nextFilter: SearchContentFilter) => {
      setSearchContentFilters((prev) =>
        toggleSearchContentFilters(prev, nextFilter),
      );
      setSearchPaletteSelectedIndex(0);
    },
    [setSearchContentFilters, setSearchPaletteSelectedIndex],
  );

  const handleSelectSearchResult = useEventCallback(
    (result: SearchResult) => {
      switch (result.kind) {
        case "action": {
          const action = result.actionId ? actionById.get(result.actionId) : undefined;
          if (action) {
            void action.execute();
            recordRecentSearchAction(action.id);
          }
          break;
        }
        case "api":
          if (result.workspaceId) {
            if (result.workspaceId !== activeWorkspaceId) {
              selectWorkspace(result.workspaceId);
            }
          }
          if (result.filePath) {
            handleOpenFile(result.filePath, result.fileLine
              ? {
                  line: result.fileLine,
                  column: result.fileColumn ?? 1,
                  scrollPosition: "center",
                }
              : undefined, {
              targetWorkspace: result.workspaceId
                ? workspacesById.get(result.workspaceId) ?? null
                : null,
            });
          }
          break;
        case "file":
          if (result.filePath) {
            handleOpenFile(result.filePath, undefined, {
              targetWorkspace: result.workspaceId
                ? workspacesById.get(result.workspaceId) ?? null
                : null,
            });
          }
          break;
        case "thread":
          if (
            isNonEmptyString(result.workspaceId) &&
            isNonEmptyString(result.threadId)
          ) {
            const preserveEditor = shouldPreserveEditorOnThreadSelect({
              isCompact,
              centerMode,
              activeWorkspaceId,
              targetWorkspaceId: result.workspaceId,
              activeEditorFilePath,
            });
            const diffCleanupAction =
              getThreadSelectDiffCleanupAction(preserveEditor);
            if (diffCleanupAction === "clear-selected-diff") {
              setSelectedDiffPath(null);
            } else {
              exitDiffView();
            }
            setSelectedPullRequest(null);
            setSelectedCommitSha(null);
            setDiffSource("local");
            selectWorkspace(result.workspaceId);
            setActiveThreadId(result.threadId, result.workspaceId);
          }
          break;
        case "kanban":
          if (result.taskId) {
            const task = kanbanTasks.find(
              (entry) => entry.id === result.taskId,
            );
            if (task) {
              const taskWs = workspacesByPath.get(task.workspaceId);
              setAppMode("kanban");
              setSelectedKanbanTaskId(task.id);
              if (taskWs) selectWorkspace(taskWs.id);
              setKanbanViewState({
                view: "board",
                workspaceId: task.workspaceId,
                panelId: task.panelId,
              });
            }
          }
          break;
        case "history":
          if (result.historyText) {
            handleDraftChange(result.historyText);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "message":
          if (
            isNonEmptyString(result.workspaceId) &&
            isNonEmptyString(result.threadId)
          ) {
            const preserveEditor = shouldPreserveEditorOnThreadSelect({
              isCompact,
              centerMode,
              activeWorkspaceId,
              targetWorkspaceId: result.workspaceId,
              activeEditorFilePath,
            });
            const diffCleanupAction =
              getThreadSelectDiffCleanupAction(preserveEditor);
            if (diffCleanupAction === "clear-selected-diff") {
              setSelectedDiffPath(null);
            } else {
              exitDiffView();
            }
            setSelectedPullRequest(null);
            setSelectedCommitSha(null);
            setDiffSource("local");
            selectWorkspace(result.workspaceId);
            setActiveThreadId(result.threadId, result.workspaceId);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "skill":
          if (result.skillName) {
            const slashToken = `/${result.skillName}`;
            const currentDraft = getActiveDraft().trim();
            const nextDraft = currentDraft
              ? `${currentDraft} ${slashToken} `
              : `${slashToken} `;
            handleDraftChange(nextDraft);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        case "command":
          if (result.commandName) {
            const slashToken = `/${result.commandName}`;
            const currentDraft = getActiveDraft().trim();
            const nextDraft = currentDraft
              ? `${currentDraft} ${slashToken} `
              : `${slashToken} `;
            handleDraftChange(nextDraft);
            if (isCompact) {
              setActiveTab("codex");
            }
          }
          break;
        default:
          break;
      }
      recordSearchResultOpen(result.id);
      closeSearchPalette();
    },
  );

  useInterruptShortcut({
    isEnabled: canInterrupt,
    shortcut: appSettings.interruptShortcut,
    onTrigger: () => {
      void interruptTurn();
    },
  });

  const {
    handleSelectPullRequest,
    resetPullRequestSelection,
    isPullRequestComposer,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  } = usePullRequestComposer({
    activeWorkspace,
    selectedPullRequest,
    gitPullRequestDiffs,
    filePanelMode,
    gitPanelMode,
    centerMode,
    isCompact,
    setSelectedPullRequest,
    setDiffSource,
    setSelectedDiffPath,
    setCenterMode,
    setGitPanelMode,
    setPrefillDraft,
    setActiveTab,
    connectWorkspace,
    startThreadForWorkspace,
    sendUserMessageToThread,
    clearActiveImages,
    handleSend,
    queueMessage,
  });

  return {
    closeQuickSwitcher,
    closeSearchPalette,
    handleOpenSearchPalette,
    handleOpenQuickSwitcher,
    handleQuickSwitcherNavigate,
    handleQuickSwitcherSelectFile,
    handleQuickSwitcherSelectSession,
    handleToggleSearchPalette,
    handleSearchPaletteMoveSelection,
    handleToggleSearchContentFilter,
    handleSelectSearchResult,
    handleSelectPullRequest,
    resetPullRequestSelection,
    isPullRequestComposer,
    isQuickSwitcherOpen,
    quickSwitcherRunningSessions,
    quickSwitcherSessionGroups,
    searchResults: visibleSearchResults,
    composerSendLabel,
    handleComposerSend,
    handleComposerQueue,
  };
}
