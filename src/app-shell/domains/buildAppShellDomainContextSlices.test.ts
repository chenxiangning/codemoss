import { describe, expect, it } from "vitest";
import {
  buildCollaborationModeDomainContextSlice,
  buildModelSelectionDomainContextSlice,
  buildRuntimeDomainContextSlice,
  buildRuntimeThreadDomainContextSlice,
  buildSessionIdentityDomainContextSlice,
  buildWorkspaceCatalogDomainContextSlice,
  buildGitSurfaceDomainContextSlice,
  buildModeRoutingDomainContextSlice,
  buildAccountSurfaceDomainContextSlice,
  buildDictationSurfaceDomainContextSlice,
  buildWorkspaceNavigationDomainContextSlice,
} from "./buildAppShellDomainContextSlices";

describe("buildAppShellDomainContextSlices", () => {
  it("builds runtimeThread slice with boundary, actions, and session hot fields", () => {
    const slice = buildRuntimeThreadDomainContextSlice({
      legacyDefaults: { legacy: true },
      runtimeActions: { handleToggleTerminalPanel: () => {} },
      runtimeThreadBoundary: { activeThreadId: "t1" },
      sessionHot: {
        activeItems: [],
        activePlan: null,
        activeRateLimits: null,
        activeTokenUsage: null,
        activeTurnId: "turn-1",
        canInterrupt: true,
        isProcessing: true,
        isReviewing: false,
        timelinePlan: null,
      },
    });
    expect(slice.legacy).toBe(true);
    expect(slice.runtimeThreadBoundary).toEqual({ activeThreadId: "t1" });
    expect(typeof slice.handleToggleTerminalPanel).toBe("function");
    expect(slice.isProcessing).toBe(true);
    expect(slice.canInterrupt).toBe(true);
    expect(slice.activeTurnId).toBe("turn-1");
  });

  it("builds model selection slice with only model keys", () => {
    const slice = buildModelSelectionDomainContextSlice({
      effectiveModels: [],
      effectiveReasoningSupported: true,
      effectiveSelectedModel: null,
      effectiveSelectedModelId: "m1",
      providerModelCatalogs: {},
      reasoningOptions: [],
      reasoningSupported: true,
      refreshEngineModels: () => {},
      resolvedEffort: null,
      resolvedModel: null,
      selectedEffort: null,
      selectedModelId: "m1",
      setSelectedEffort: () => {},
      setSelectedModelId: () => {},
    });
    expect(Object.keys(slice).sort()).toEqual(
      [
        "effectiveModels",
        "effectiveReasoningSupported",
        "effectiveSelectedModel",
        "effectiveSelectedModelId",
        "providerModelCatalogs",
        "reasoningOptions",
        "reasoningSupported",
        "refreshEngineModels",
        "resolvedEffort",
        "resolvedModel",
        "selectedEffort",
        "selectedModelId",
        "setSelectedEffort",
        "setSelectedModelId",
      ].sort(),
    );
  });

  it("builds collaboration and runtime slices", () => {
    const collab = buildCollaborationModeDomainContextSlice({
      applySelectedCollaborationMode: () => {},
      collaborationModePayload: null,
      collaborationModes: [],
      collaborationModesEnabled: true,
      collaborationRuntimeModeByThread: {},
      collaborationUiModeByThread: {},
      handleCollaborationModeResolved: () => {},
      resolveCollaborationRuntimeMode: () => null,
      resolveCollaborationUiMode: () => null,
      selectedCollaborationMode: null,
      selectedCollaborationModeId: null,
      setCodexCollaborationMode: () => {},
      setCollaborationRuntimeModeByThread: () => {},
      setCollaborationUiModeByThread: () => {},
      setSelectedCollaborationModeId: () => {},
    });
    expect(collab.collaborationModesEnabled).toBe(true);

    const runtime = buildRuntimeDomainContextSlice({
      runtimeRunState: { phase: "idle" },
    });
    expect(runtime).toEqual({ runtimeRunState: { phase: "idle" } });
  });

  it("builds sessionIdentity slice with only identity keys (T1.2)", () => {
    const slice = buildSessionIdentityDomainContextSlice({
      RECENT_THREAD_LIMIT: 20,
      activeParentWorkspace: null,
      activePath: "/repo",
      activeThreadId: "thread-1",
      activeThreadIdForModeRef: { current: "thread-1" },
      activeThreadIdRef: { current: "thread-1" },
      activeWorkspace: { id: "ws-1" },
      activeWorkspaceId: "ws-1",
      activeWorkspaceIdRef: { current: "ws-1" },
      activeWorkspaceRef: { current: { id: "ws-1" } },
      activeWorkspaceThreads: [],
      baseWorkspaceRef: { current: null },
    });
    expect(Object.keys(slice).sort()).toEqual(
      [
        "RECENT_THREAD_LIMIT",
        "activeParentWorkspace",
        "activePath",
        "activeThreadId",
        "activeThreadIdForModeRef",
        "activeThreadIdRef",
        "activeWorkspace",
        "activeWorkspaceId",
        "activeWorkspaceIdRef",
        "activeWorkspaceRef",
        "activeWorkspaceThreads",
        "baseWorkspaceRef",
      ].sort(),
    );
    expect(slice.activeWorkspaceId).toBe("ws-1");
    expect(slice.activeThreadId).toBe("thread-1");
  });

  it("builds workspaceCatalog slice with catalog keys only (T1.3)", () => {
    const slice = buildWorkspaceCatalogDomainContextSlice({
      addCloneAgent: () => {},
      addWorkspace: () => {},
      addWorkspaceFromPath: async () => {},
      addWorktreeAgent: () => {},
      assignWorkspaceGroup: () => {},
      cancelClonePrompt: () => {},
      cancelWorktreePrompt: () => {},
      chooseCloneCopiesFolder: async () => {},
      clearCloneCopiesFolder: () => {},
      clonePrompt: null,
      closeWorktreeCreateResult: () => {},
      confirmClonePrompt: async () => {},
      confirmRenameWorktreeUpstream: async () => {},
      confirmWorktreePrompt: async () => {},
      connectWorkspace: async () => {},
      createWorkspaceGroup: () => {},
      deleteWorkspaceGroup: () => {},
      deletingWorktreeIds: new Set(),
      directories: [],
      directoryMetadata: {},
      ensureWorkspaceThreadListLoaded: async () => {},
      forkThreadForWorkspace: async () => {},
      forkSessionFromMessageForWorkspace: async () => {},
      forkClaudeSessionFromMessageForWorkspace: async () => {},
      getWorkspaceGroupName: () => "",
      getWorkspacePromptsDir: () => "",
      repositories: [],
      repositoriesLoading: false,
      isMultiRepository: false,
    });
    expect(slice).toHaveProperty("addWorkspace");
    expect(slice).toHaveProperty("connectWorkspace");
    expect(slice).toHaveProperty("repositories");
    expect(slice).not.toHaveProperty("activeWorkspaceId");
    expect(slice).not.toHaveProperty("activeDiffs");
  });

  it("builds gitSurface slice with git keys only (T1.4)", () => {
    const slice = buildGitSurfaceDomainContextSlice({
      GitHubPanelData: null,
      activeDiffError: null,
      activeDiffLoading: false,
      activeDiffs: [],
      activeGitRoot: null,
      activeGitHistoryTabId: null,
      branchError: null,
      branches: [],
      checkoutBranch: async () => {},
      clearGitOperationErrors: () => {},
      clearGitRootCandidates: () => {},
      commitError: null,
      commitLoading: false,
      commitMessage: "",
      commitMessageError: null,
      commitMessageLoading: false,
      confirmBranch: async () => {},
      confirmCommit: async () => {},
      createBranch: async () => {},
      currentBranch: null,
      diffScrollRequestId: 0,
      diffSource: null,
      exitDiffView: () => {},
      fileStatus: null,
      gitCommitDiffs: [],
      gitDiffListView: "list",
      gitDiffViewStyle: "unified",
      gitHistoryPanelHeight: 200,
      gitHistoryPanelHeightRef: { current: 200 },
      gitIssues: [],
      gitIssuesError: null,
      gitIssuesLoading: false,
      gitIssuesTotal: 0,
      gitLogAhead: 0,
      gitLogAheadEntries: [],
      gitLogBehind: 0,
      gitLogBehindEntries: [],
      gitLogEntries: [],
      gitLogError: null,
      gitLogLoading: false,
      gitLogTotal: 0,
      gitLogUpstream: null,
      gitPanelMode: "status",
      gitPullRequestComments: [],
      gitPullRequestCommentsError: null,
      gitPullRequestCommentsLoading: false,
      gitPullRequestDiffs: [],
      gitPullRequestDiffsError: null,
      gitPullRequestDiffsLoading: false,
      gitPullRequests: [],
      gitPullRequestsError: null,
      gitPullRequestsLoading: false,
      gitPullRequestsTotal: 0,
      gitRemoteUrl: null,
      gitRootCandidates: [],
      gitRootScanDepth: 2,
      gitRootScanError: null,
      gitRootScanHasScanned: false,
      gitRootScanLoading: false,
      gitStatus: null,
      gitignoredDirectories: [],
      gitignoredFiles: [],
      localBranches: [],
      remoteBranches: [],
      repositoryError: null,
      repositoryStatuses: {},
      repositoryStatusesLoading: false,
      refreshRepositoryStatuses: async () => {},
      handleStageRepositoryFile: async () => {},
      handleUnstageRepositoryFile: async () => {},
      handleUnstageRepositoryAll: async () => {},
      handleUnstageRepositoryFiles: async () => {},
      handleRevertRepositoryFile: async () => {},
      handleRevertRepositoryFiles: async () => {},
      handleStageRepositoryAll: async () => {},
      handleCommitRepositories: async () => {},
      repositoryCommitSummary: null,
      selectRepository: () => {},
      selectedRepositoryRoot: null,
    } as any);
    expect(slice).toHaveProperty("gitStatus");
    expect(slice).toHaveProperty("activeDiffs");
    expect(slice).not.toHaveProperty("activeWorkspaceId");
    expect(slice).not.toHaveProperty("addWorkspace");
  });

  it("builds modeRouting slice with mode keys only (T1.5)", () => {
    const slice = buildModeRoutingDomainContextSlice({
      accessMode: "default",
      activeTab: "chat",
      appMode: "chat",
      centerMode: "chat",
      claudeAccessModeRef: { current: "default" },
      filePanelMode: "files",
      showMarket: false,
    });
    expect(Object.keys(slice).sort()).toEqual(
      [
        "accessMode",
        "activeTab",
        "appMode",
        "centerMode",
        "claudeAccessModeRef",
        "filePanelMode",
        "showMarket",
      ].sort(),
    );
    expect(slice.appMode).toBe("chat");
    expect(slice).not.toHaveProperty("activeWorkspaceId");
  });

  it("builds accountSurface slice with account keys only (T1.6)", () => {
    const slice = buildAccountSurfaceDomainContextSlice({
      accountByWorkspace: {},
      accountSwitching: false,
      activeAccount: null,
      approvals: [],
    });
    expect(Object.keys(slice).sort()).toEqual(
      ["accountByWorkspace", "accountSwitching", "activeAccount", "approvals"].sort(),
    );
    expect(slice.accountSwitching).toBe(false);
    expect(slice).not.toHaveProperty("appMode");
  });

  it("builds dictationSurface slice with dictation keys only (T1.7)", () => {
    const slice = buildDictationSurfaceDomainContextSlice({
      clearDictationError: () => {},
      clearDictationHint: () => {},
      clearDictationTranscript: () => {},
      dictationError: null,
      dictationHint: null,
      dictationLevel: 0,
      dictationModel: null,
      dictationReady: true,
      dictationState: "idle",
      dictationTranscript: "",
    });
    expect(slice.dictationState).toBe("idle");
    expect(slice).toHaveProperty("dictationTranscript");
    expect(slice).not.toHaveProperty("appMode");
    expect(Object.keys(slice)).toHaveLength(10);
  });

  it("builds workspaceNavigation residual slice (T1.9)", () => {
    const slice = buildWorkspaceNavigationDomainContextSlice({
      SettingsView: null,
      activeEditorFilePath: null,
      activeEditorLineRange: null,
      activeEngine: null,
      activeImages: [],
      activeFusingMessageId: null,
      fileCompareSession: null,
      fileHistoryTabs: [],
      activeQueue: [],
      activeQueuedHandoffBubble: null,
      activeRenamePrompt: null,
      agentTaskScrollRequest: null,
      activeTerminalId: null,
      activeWorkspaceKanbanTasks: [],
      addDebugEntry: () => {},
      agent: null,
      alertError: () => {},
      appRootRef: { current: null },
      appSettings: {},
      appSettingsLoading: false,
      attachImages: () => {},
      canFuseActiveQueue: false,
      fuseDisabledReasonKey: null,
      choosePreset: () => {},
      claudeThinkingVisible: false,
      clearActiveImages: () => {},
      clearDebugEntries: () => {},
      clearDraftForThread: () => {},
      closePlanPanel: () => {},
      checkForUpdates: () => {},
      closeReleaseNotes: () => {},
      closeReviewPrompt: () => {},
      closeSettings: () => {},
      closeTerminalPanel: () => {},
      codexComposerModeRef: { current: null },
      collapseRightPanel: () => {},
      collapseSidebar: () => {},
      commands: [],
      completionEmailIntentByThread: {},
      completionTrackerBySessionRef: { current: {} },
      completionTrackerReadyRef: { current: false },
      composerEditorSettings: {},
      composerInputRef: { current: null },
      composerInsert: null,
      confirmCustom: () => {},
      createPrompt: () => {},
      debugEntries: [],
      debugOpen: false,
      debugPanelHeight: 0,
      deletePrompt: () => {},
      deleteThreadPrompt: null,
      dismissErrorToast: () => {},
      dismissUpdate: () => {},
      doctor: null,
      claudeDoctor: null,
      kimiDoctor: null,
      grokDoctor: null,
      opencodeDoctor: null,
      piDoctor: null,
      editorHighlightTarget: null,
      editorNavigationTarget: null,
      editorSplitCompanion: null,
      editorSplitLayout: null,
      engineModelsAsOptions: [],
      engineSelectedModelIdByType: {},
      engineStatuses: {},
      ensureLaunchTerminal: () => {},
      ensureTerminalWithTitle: () => {},
      errorToasts: [],
      expandRightPanel: () => {},
      expandSidebar: () => {},
      fileReferenceMode: null,
      fileTreeLoadError: null,
      fileTreeSourceVersion: 0,
      files: [],
      getGlobalPromptsDir: () => "",
      getPinTimestamp: () => 0,
      getThreadRows: () => [],
      globalSearchFilesByWorkspace: {},
    } as any);
    expect(Object.keys(slice).length).toBe(79);
    expect(slice).toHaveProperty("appSettings");
    expect(slice).toHaveProperty("piDoctor");
    expect(slice).not.toHaveProperty("activeWorkspaceId");
    expect(slice).not.toHaveProperty("gitStatus");
  });
});
