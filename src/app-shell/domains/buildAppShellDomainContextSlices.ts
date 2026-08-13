import type { AppShellDomainContextValue } from "./appShellDomainContexts";

/**
 * S4 PR-F：按域构造 context slice，避免在 AppShell 里继续「字母序切 bag」。
 * flatten 仍兼容 legacy 全量读侧；但 model / collab / runtimeThread 等干净域
 * 必须经这些 builder 进入 defineAppShellDomainContexts。
 */

/**
 * 会话热路径字段：回合生命周期 / token / plan / activeItems。
 * 从 workspaceNavigation / settings 大 bag 拆出，避免一次 isProcessing 抖动
 * 打坏 200+ key 的 shallow equal。
 */
export type RuntimeThreadSessionHotFields = {
  activeItems: unknown;
  activePlan: unknown;
  activeRateLimits: unknown;
  activeTokenUsage: unknown;
  activeTurnId: unknown;
  canInterrupt: unknown;
  isProcessing: unknown;
  isReviewing: unknown;
  timelinePlan: unknown;
};

export function buildRuntimeThreadDomainContextSlice(input: {
  legacyDefaults: AppShellDomainContextValue;
  runtimeActions: AppShellDomainContextValue;
  runtimeThreadBoundary: unknown;
  /** S4 bag-split PR-1：高 churn 会话投影 */
  sessionHot?: RuntimeThreadSessionHotFields;
}): AppShellDomainContextValue {
  return {
    ...input.legacyDefaults,
    ...input.runtimeActions,
    runtimeThreadBoundary: input.runtimeThreadBoundary,
    ...(input.sessionHot ?? {}),
  };
}

export function buildModelSelectionDomainContextSlice(input: {
  effectiveModels: unknown;
  effectiveReasoningSupported: unknown;
  effectiveSelectedModel: unknown;
  effectiveSelectedModelId: unknown;
  providerModelCatalogs: unknown;
  reasoningOptions: unknown;
  reasoningSupported: unknown;
  refreshEngineModels: unknown;
  resolvedEffort: unknown;
  resolvedModel: unknown;
  selectedEffort: unknown;
  selectedModelId: unknown;
  setSelectedEffort: unknown;
  setSelectedModelId: unknown;
}): AppShellDomainContextValue {
  return {
    effectiveModels: input.effectiveModels,
    effectiveReasoningSupported: input.effectiveReasoningSupported,
    effectiveSelectedModel: input.effectiveSelectedModel,
    effectiveSelectedModelId: input.effectiveSelectedModelId,
    providerModelCatalogs: input.providerModelCatalogs,
    reasoningOptions: input.reasoningOptions,
    reasoningSupported: input.reasoningSupported,
    refreshEngineModels: input.refreshEngineModels,
    resolvedEffort: input.resolvedEffort,
    resolvedModel: input.resolvedModel,
    selectedEffort: input.selectedEffort,
    selectedModelId: input.selectedModelId,
    setSelectedEffort: input.setSelectedEffort,
    setSelectedModelId: input.setSelectedModelId,
  };
}

export function buildCollaborationModeDomainContextSlice(input: {
  applySelectedCollaborationMode: unknown;
  collaborationModePayload: unknown;
  collaborationModes: unknown;
  collaborationModesEnabled: unknown;
  collaborationRuntimeModeByThread: unknown;
  collaborationUiModeByThread: unknown;
  handleCollaborationModeResolved: unknown;
  resolveCollaborationRuntimeMode: unknown;
  resolveCollaborationUiMode: unknown;
  selectedCollaborationMode: unknown;
  selectedCollaborationModeId: unknown;
  setCodexCollaborationMode: unknown;
  setCollaborationRuntimeModeByThread: unknown;
  setCollaborationUiModeByThread: unknown;
  setSelectedCollaborationModeId: unknown;
}): AppShellDomainContextValue {
  return {
    applySelectedCollaborationMode: input.applySelectedCollaborationMode,
    collaborationModePayload: input.collaborationModePayload,
    collaborationModes: input.collaborationModes,
    collaborationModesEnabled: input.collaborationModesEnabled,
    collaborationRuntimeModeByThread: input.collaborationRuntimeModeByThread,
    collaborationUiModeByThread: input.collaborationUiModeByThread,
    handleCollaborationModeResolved: input.handleCollaborationModeResolved,
    resolveCollaborationRuntimeMode: input.resolveCollaborationRuntimeMode,
    resolveCollaborationUiMode: input.resolveCollaborationUiMode,
    selectedCollaborationMode: input.selectedCollaborationMode,
    selectedCollaborationModeId: input.selectedCollaborationModeId,
    setCodexCollaborationMode: input.setCodexCollaborationMode,
    setCollaborationRuntimeModeByThread:
      input.setCollaborationRuntimeModeByThread,
    setCollaborationUiModeByThread: input.setCollaborationUiModeByThread,
    setSelectedCollaborationModeId: input.setSelectedCollaborationModeId,
  };
}

export function buildRuntimeDomainContextSlice(input: {
  runtimeRunState: unknown;
}): AppShellDomainContextValue {
  return {
    runtimeRunState: input.runtimeRunState,
  };
}

/**
 * T1.2：会话 / workspace 身份标识（从 workspaceNavigation 垃圾桶拆出）。
 * 只含 id / ref / 当前实体投影；不含 git / catalog / mode 路由。
 */
export type SessionIdentityDomainFields = {
  RECENT_THREAD_LIMIT: unknown;
  activeParentWorkspace: unknown;
  activePath: unknown;
  activeThreadId: unknown;
  activeThreadIdForModeRef: unknown;
  activeThreadIdRef: unknown;
  activeWorkspace: unknown;
  activeWorkspaceId: unknown;
  activeWorkspaceIdRef: unknown;
  activeWorkspaceRef: unknown;
  activeWorkspaceThreads: unknown;
  baseWorkspaceRef: unknown;
};

export function buildSessionIdentityDomainContextSlice(
  input: SessionIdentityDomainFields,
): AppShellDomainContextValue {
  return {
    RECENT_THREAD_LIMIT: input.RECENT_THREAD_LIMIT,
    activeParentWorkspace: input.activeParentWorkspace,
    activePath: input.activePath,
    activeThreadId: input.activeThreadId,
    activeThreadIdForModeRef: input.activeThreadIdForModeRef,
    activeThreadIdRef: input.activeThreadIdRef,
    activeWorkspace: input.activeWorkspace,
    activeWorkspaceId: input.activeWorkspaceId,
    activeWorkspaceIdRef: input.activeWorkspaceIdRef,
    activeWorkspaceRef: input.activeWorkspaceRef,
    activeWorkspaceThreads: input.activeWorkspaceThreads,
    baseWorkspaceRef: input.baseWorkspaceRef,
  };
}


/**
 * T1.3：workspace 目录 / 分组 / clone·worktree 入口（从 workspaceNavigation 拆出）。
 * 不含 session identity、git surface、mode routing。
 */
export type WorkspaceCatalogDomainFields = {
  addCloneAgent: unknown;
  addWorkspace: unknown;
  addWorkspaceFromPath: unknown;
  addWorktreeAgent: unknown;
  assignWorkspaceGroup: unknown;
  cancelClonePrompt: unknown;
  cancelWorktreePrompt: unknown;
  chooseCloneCopiesFolder: unknown;
  clearCloneCopiesFolder: unknown;
  clonePrompt: unknown;
  closeWorktreeCreateResult: unknown;
  confirmClonePrompt: unknown;
  confirmRenameWorktreeUpstream: unknown;
  confirmWorktreePrompt: unknown;
  connectWorkspace: unknown;
  createWorkspaceGroup: unknown;
  deleteWorkspaceGroup: unknown;
  deletingWorktreeIds: unknown;
  directories: unknown;
  directoryMetadata: unknown;
  ensureWorkspaceThreadListLoaded: unknown;
  forkThreadForWorkspace: unknown;
  forkSessionFromMessageForWorkspace: unknown;
  forkClaudeSessionFromMessageForWorkspace: unknown;
  getWorkspaceGroupName: unknown;
  getWorkspacePromptsDir: unknown;
  repositories: unknown;
  repositoriesLoading: unknown;
  isMultiRepository: unknown;
};

export function buildWorkspaceCatalogDomainContextSlice(
  input: WorkspaceCatalogDomainFields,
): AppShellDomainContextValue {
  return {
    addCloneAgent: input.addCloneAgent,
    addWorkspace: input.addWorkspace,
    addWorkspaceFromPath: input.addWorkspaceFromPath,
    addWorktreeAgent: input.addWorktreeAgent,
    assignWorkspaceGroup: input.assignWorkspaceGroup,
    cancelClonePrompt: input.cancelClonePrompt,
    cancelWorktreePrompt: input.cancelWorktreePrompt,
    chooseCloneCopiesFolder: input.chooseCloneCopiesFolder,
    clearCloneCopiesFolder: input.clearCloneCopiesFolder,
    clonePrompt: input.clonePrompt,
    closeWorktreeCreateResult: input.closeWorktreeCreateResult,
    confirmClonePrompt: input.confirmClonePrompt,
    confirmRenameWorktreeUpstream: input.confirmRenameWorktreeUpstream,
    confirmWorktreePrompt: input.confirmWorktreePrompt,
    connectWorkspace: input.connectWorkspace,
    createWorkspaceGroup: input.createWorkspaceGroup,
    deleteWorkspaceGroup: input.deleteWorkspaceGroup,
    deletingWorktreeIds: input.deletingWorktreeIds,
    directories: input.directories,
    directoryMetadata: input.directoryMetadata,
    ensureWorkspaceThreadListLoaded: input.ensureWorkspaceThreadListLoaded,
    forkThreadForWorkspace: input.forkThreadForWorkspace,
    forkSessionFromMessageForWorkspace: input.forkSessionFromMessageForWorkspace,
    forkClaudeSessionFromMessageForWorkspace: input.forkClaudeSessionFromMessageForWorkspace,
    getWorkspaceGroupName: input.getWorkspaceGroupName,
    getWorkspacePromptsDir: input.getWorkspacePromptsDir,
    repositories: input.repositories,
    repositoriesLoading: input.repositoriesLoading,
    isMultiRepository: input.isMultiRepository,
  };
}


/**
 * T1.4：Git surface（diff/status/PR/branch/multi-repo ops）从 workspaceNavigation 拆出。
 * 禁止依赖 runtimeThread hot items。
 */
export type GitSurfaceDomainFields = {
  GitHubPanelData: unknown;
  activeDiffError: unknown;
  activeDiffLoading: unknown;
  activeDiffs: unknown;
  activeGitRoot: unknown;
  activeGitHistoryTabId: unknown;
  branchError: unknown;
  branches: unknown;
  checkoutBranch: unknown;
  clearGitOperationErrors: unknown;
  clearGitRootCandidates: unknown;
  commitError: unknown;
  commitLoading: unknown;
  commitMessage: unknown;
  commitMessageError: unknown;
  commitMessageLoading: unknown;
  confirmBranch: unknown;
  confirmCommit: unknown;
  createBranch: unknown;
  currentBranch: unknown;
  diffScrollRequestId: unknown;
  diffSource: unknown;
  exitDiffView: unknown;
  fileStatus: unknown;
  gitCommitDiffs: unknown;
  gitDiffListView: unknown;
  gitDiffViewStyle: unknown;
  gitHistoryPanelHeight: unknown;
  gitHistoryPanelHeightRef: unknown;
  gitIssues: unknown;
  gitIssuesError: unknown;
  gitIssuesLoading: unknown;
  gitIssuesTotal: unknown;
  gitLogAhead: unknown;
  gitLogAheadEntries: unknown;
  gitLogBehind: unknown;
  gitLogBehindEntries: unknown;
  gitLogEntries: unknown;
  gitLogError: unknown;
  gitLogLoading: unknown;
  gitLogTotal: unknown;
  gitLogUpstream: unknown;
  gitPanelMode: unknown;
  gitPullRequestComments: unknown;
  gitPullRequestCommentsError: unknown;
  gitPullRequestCommentsLoading: unknown;
  gitPullRequestDiffs: unknown;
  gitPullRequestDiffsError: unknown;
  gitPullRequestDiffsLoading: unknown;
  gitPullRequests: unknown;
  gitPullRequestsError: unknown;
  gitPullRequestsLoading: unknown;
  gitPullRequestsTotal: unknown;
  gitRemoteUrl: unknown;
  gitRootCandidates: unknown;
  gitRootScanDepth: unknown;
  gitRootScanError: unknown;
  gitRootScanHasScanned: unknown;
  gitRootScanLoading: unknown;
  gitStatus: unknown;
  gitignoredDirectories: unknown;
  gitignoredFiles: unknown;
  localBranches: unknown;
  remoteBranches: unknown;
  repositoryError: unknown;
  repositoryStatuses: unknown;
  repositoryStatusesLoading: unknown;
  refreshRepositoryStatuses: unknown;
  handleStageRepositoryFile: unknown;
  handleUnstageRepositoryFile: unknown;
  handleUnstageRepositoryAll: unknown;
  handleUnstageRepositoryFiles: unknown;
  handleRevertRepositoryFile: unknown;
  handleRevertRepositoryFiles: unknown;
  handleStageRepositoryAll: unknown;
  handleCommitRepositories: unknown;
  repositoryCommitSummary: unknown;
  selectRepository: unknown;
  selectedRepositoryRoot: unknown;
};

export function buildGitSurfaceDomainContextSlice(
  input: GitSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    GitHubPanelData: input.GitHubPanelData,
    activeDiffError: input.activeDiffError,
    activeDiffLoading: input.activeDiffLoading,
    activeDiffs: input.activeDiffs,
    activeGitRoot: input.activeGitRoot,
    activeGitHistoryTabId: input.activeGitHistoryTabId,
    branchError: input.branchError,
    branches: input.branches,
    checkoutBranch: input.checkoutBranch,
    clearGitOperationErrors: input.clearGitOperationErrors,
    clearGitRootCandidates: input.clearGitRootCandidates,
    commitError: input.commitError,
    commitLoading: input.commitLoading,
    commitMessage: input.commitMessage,
    commitMessageError: input.commitMessageError,
    commitMessageLoading: input.commitMessageLoading,
    confirmBranch: input.confirmBranch,
    confirmCommit: input.confirmCommit,
    createBranch: input.createBranch,
    currentBranch: input.currentBranch,
    diffScrollRequestId: input.diffScrollRequestId,
    diffSource: input.diffSource,
    exitDiffView: input.exitDiffView,
    fileStatus: input.fileStatus,
    gitCommitDiffs: input.gitCommitDiffs,
    gitDiffListView: input.gitDiffListView,
    gitDiffViewStyle: input.gitDiffViewStyle,
    gitHistoryPanelHeight: input.gitHistoryPanelHeight,
    gitHistoryPanelHeightRef: input.gitHistoryPanelHeightRef,
    gitIssues: input.gitIssues,
    gitIssuesError: input.gitIssuesError,
    gitIssuesLoading: input.gitIssuesLoading,
    gitIssuesTotal: input.gitIssuesTotal,
    gitLogAhead: input.gitLogAhead,
    gitLogAheadEntries: input.gitLogAheadEntries,
    gitLogBehind: input.gitLogBehind,
    gitLogBehindEntries: input.gitLogBehindEntries,
    gitLogEntries: input.gitLogEntries,
    gitLogError: input.gitLogError,
    gitLogLoading: input.gitLogLoading,
    gitLogTotal: input.gitLogTotal,
    gitLogUpstream: input.gitLogUpstream,
    gitPanelMode: input.gitPanelMode,
    gitPullRequestComments: input.gitPullRequestComments,
    gitPullRequestCommentsError: input.gitPullRequestCommentsError,
    gitPullRequestCommentsLoading: input.gitPullRequestCommentsLoading,
    gitPullRequestDiffs: input.gitPullRequestDiffs,
    gitPullRequestDiffsError: input.gitPullRequestDiffsError,
    gitPullRequestDiffsLoading: input.gitPullRequestDiffsLoading,
    gitPullRequests: input.gitPullRequests,
    gitPullRequestsError: input.gitPullRequestsError,
    gitPullRequestsLoading: input.gitPullRequestsLoading,
    gitPullRequestsTotal: input.gitPullRequestsTotal,
    gitRemoteUrl: input.gitRemoteUrl,
    gitRootCandidates: input.gitRootCandidates,
    gitRootScanDepth: input.gitRootScanDepth,
    gitRootScanError: input.gitRootScanError,
    gitRootScanHasScanned: input.gitRootScanHasScanned,
    gitRootScanLoading: input.gitRootScanLoading,
    gitStatus: input.gitStatus,
    gitignoredDirectories: input.gitignoredDirectories,
    gitignoredFiles: input.gitignoredFiles,
    localBranches: input.localBranches,
    remoteBranches: input.remoteBranches,
    repositoryError: input.repositoryError,
    repositoryStatuses: input.repositoryStatuses,
    repositoryStatusesLoading: input.repositoryStatusesLoading,
    refreshRepositoryStatuses: input.refreshRepositoryStatuses,
    handleStageRepositoryFile: input.handleStageRepositoryFile,
    handleUnstageRepositoryFile: input.handleUnstageRepositoryFile,
    handleUnstageRepositoryAll: input.handleUnstageRepositoryAll,
    handleUnstageRepositoryFiles: input.handleUnstageRepositoryFiles,
    handleRevertRepositoryFile: input.handleRevertRepositoryFile,
    handleRevertRepositoryFiles: input.handleRevertRepositoryFiles,
    handleStageRepositoryAll: input.handleStageRepositoryAll,
    handleCommitRepositories: input.handleCommitRepositories,
    repositoryCommitSummary: input.repositoryCommitSummary,
    selectRepository: input.selectRepository,
    selectedRepositoryRoot: input.selectedRepositoryRoot,
  };
}


/**
 * T1.5：app/surface mode 路由（从 workspaceNavigation 拆出）。
 * 驱动 lazy surfaces；不反灌热会话投影。
 */
export type ModeRoutingDomainFields = {
  accessMode: unknown;
  activeTab: unknown;
  appMode: unknown;
  centerMode: unknown;
  claudeAccessModeRef: unknown;
  filePanelMode: unknown;
};

export function buildModeRoutingDomainContextSlice(
  input: ModeRoutingDomainFields,
): AppShellDomainContextValue {
  return {
    accessMode: input.accessMode,
    activeTab: input.activeTab,
    appMode: input.appMode,
    centerMode: input.centerMode,
    claudeAccessModeRef: input.claudeAccessModeRef,
    filePanelMode: input.filePanelMode,
  };
}


/**
 * T1.6：账号切换 / approvals 表面（从 workspaceNavigation 拆出）。
 */
export type AccountSurfaceDomainFields = {
  accountByWorkspace: unknown;
  accountSwitching: unknown;
  activeAccount: unknown;
  approvals: unknown;
};

export function buildAccountSurfaceDomainContextSlice(
  input: AccountSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    accountByWorkspace: input.accountByWorkspace,
    accountSwitching: input.accountSwitching,
    activeAccount: input.activeAccount,
    approvals: input.approvals,
  };
}


/**
 * T1.7：dictation 表面（从 workspaceNavigation residual 拆出，达 navigation ≤80 门禁）。
 * 语义上贴近 composer；独立 domain 避免继续污染 navigation bag。
 */
export type DictationSurfaceDomainFields = {
  clearDictationError: unknown;
  clearDictationHint: unknown;
  clearDictationTranscript: unknown;
  dictationError: unknown;
  dictationHint: unknown;
  dictationLevel: unknown;
  dictationModel: unknown;
  dictationReady: unknown;
  dictationState: unknown;
  dictationTranscript: unknown;
};

export function buildDictationSurfaceDomainContextSlice(
  input: DictationSurfaceDomainFields,
): AppShellDomainContextValue {
  return {
    clearDictationError: input.clearDictationError,
    clearDictationHint: input.clearDictationHint,
    clearDictationTranscript: input.clearDictationTranscript,
    dictationError: input.dictationError,
    dictationHint: input.dictationHint,
    dictationLevel: input.dictationLevel,
    dictationModel: input.dictationModel,
    dictationReady: input.dictationReady,
    dictationState: input.dictationState,
    dictationTranscript: input.dictationTranscript,
  };
}


/**
 * T1.9：workspaceNavigation residual 也走 dedicated builder，
 * 避免 defineAppShellDomainContexts 内继续内联大 object literal。
 */
export type WorkspaceNavigationDomainFields = {
  SettingsView: unknown;
  activeEditorFilePath: unknown;
  activeEditorLineRange: unknown;
  activeEngine: unknown;
  activeImages: unknown;
  activeFusingMessageId: unknown;
  fileCompareSession: unknown;
  fileHistoryTabs: unknown;
  activeQueue: unknown;
  activeQueuedHandoffBubble: unknown;
  activeRenamePrompt: unknown;
  agentTaskScrollRequest: unknown;
  activeTerminalId: unknown;
  activeWorkspaceKanbanTasks: unknown;
  addDebugEntry: unknown;
  agent: unknown;
  alertError: unknown;
  appRootRef: unknown;
  appSettings: unknown;
  appSettingsLoading: unknown;
  attachImages: unknown;
  canFuseActiveQueue: unknown;
  fuseDisabledReasonKey: unknown;
  choosePreset: unknown;
  claudeThinkingVisible: unknown;
  clearActiveImages: unknown;
  clearDebugEntries: unknown;
  clearDraftForThread: unknown;
  closePlanPanel: unknown;
  checkForUpdates: unknown;
  closeReleaseNotes: unknown;
  closeReviewPrompt: unknown;
  closeSettings: unknown;
  closeTerminalPanel: unknown;
  codexComposerModeRef: unknown;
  collapseRightPanel: unknown;
  collapseSidebar: unknown;
  commands: unknown;
  completionEmailIntentByThread: unknown;
  completionTrackerBySessionRef: unknown;
  completionTrackerReadyRef: unknown;
  composerEditorSettings: unknown;
  composerInputRef: unknown;
  composerInsert: unknown;
  confirmCustom: unknown;
  createPrompt: unknown;
  debugEntries: unknown;
  debugOpen: unknown;
  debugPanelHeight: unknown;
  deletePrompt: unknown;
  deleteThreadPrompt: unknown;
  dismissErrorToast: unknown;
  dismissUpdate: unknown;
  doctor: unknown;
  claudeDoctor: unknown;
  kimiDoctor: unknown;
  grokDoctor: unknown;
  opencodeDoctor: unknown;
  editorHighlightTarget: unknown;
  editorNavigationTarget: unknown;
  editorSplitCompanion: unknown;
  editorSplitLayout: unknown;
  engineModelsAsOptions: unknown;
  engineSelectedModelIdByType: unknown;
  engineStatuses: unknown;
  ensureLaunchTerminal: unknown;
  ensureTerminalWithTitle: unknown;
  errorToasts: unknown;
  expandRightPanel: unknown;
  expandSidebar: unknown;
  fileReferenceMode: unknown;
  fileTreeLoadError: unknown;
  fileTreeSourceVersion: unknown;
  files: unknown;
  getGlobalPromptsDir: unknown;
  getPinTimestamp: unknown;
  getThreadRows: unknown;
  globalSearchFilesByWorkspace: unknown;
};

export function buildWorkspaceNavigationDomainContextSlice(
  input: WorkspaceNavigationDomainFields,
): AppShellDomainContextValue {
  return {
    SettingsView: input.SettingsView,
    activeEditorFilePath: input.activeEditorFilePath,
    activeEditorLineRange: input.activeEditorLineRange,
    activeEngine: input.activeEngine,
    activeImages: input.activeImages,
    activeFusingMessageId: input.activeFusingMessageId,
    fileCompareSession: input.fileCompareSession,
    fileHistoryTabs: input.fileHistoryTabs,
    activeQueue: input.activeQueue,
    activeQueuedHandoffBubble: input.activeQueuedHandoffBubble,
    activeRenamePrompt: input.activeRenamePrompt,
    agentTaskScrollRequest: input.agentTaskScrollRequest,
    activeTerminalId: input.activeTerminalId,
    activeWorkspaceKanbanTasks: input.activeWorkspaceKanbanTasks,
    addDebugEntry: input.addDebugEntry,
    agent: input.agent,
    alertError: input.alertError,
    appRootRef: input.appRootRef,
    appSettings: input.appSettings,
    appSettingsLoading: input.appSettingsLoading,
    attachImages: input.attachImages,
    canFuseActiveQueue: input.canFuseActiveQueue,
    fuseDisabledReasonKey: input.fuseDisabledReasonKey,
    choosePreset: input.choosePreset,
    claudeThinkingVisible: input.claudeThinkingVisible,
    clearActiveImages: input.clearActiveImages,
    clearDebugEntries: input.clearDebugEntries,
    clearDraftForThread: input.clearDraftForThread,
    closePlanPanel: input.closePlanPanel,
    checkForUpdates: input.checkForUpdates,
    closeReleaseNotes: input.closeReleaseNotes,
    closeReviewPrompt: input.closeReviewPrompt,
    closeSettings: input.closeSettings,
    closeTerminalPanel: input.closeTerminalPanel,
    codexComposerModeRef: input.codexComposerModeRef,
    collapseRightPanel: input.collapseRightPanel,
    collapseSidebar: input.collapseSidebar,
    commands: input.commands,
    completionEmailIntentByThread: input.completionEmailIntentByThread,
    completionTrackerBySessionRef: input.completionTrackerBySessionRef,
    completionTrackerReadyRef: input.completionTrackerReadyRef,
    composerEditorSettings: input.composerEditorSettings,
    composerInputRef: input.composerInputRef,
    composerInsert: input.composerInsert,
    confirmCustom: input.confirmCustom,
    createPrompt: input.createPrompt,
    debugEntries: input.debugEntries,
    debugOpen: input.debugOpen,
    debugPanelHeight: input.debugPanelHeight,
    deletePrompt: input.deletePrompt,
    deleteThreadPrompt: input.deleteThreadPrompt,
    dismissErrorToast: input.dismissErrorToast,
    dismissUpdate: input.dismissUpdate,
    doctor: input.doctor,
    claudeDoctor: input.claudeDoctor,
    kimiDoctor: input.kimiDoctor,
    grokDoctor: input.grokDoctor,
    opencodeDoctor: input.opencodeDoctor,
    editorHighlightTarget: input.editorHighlightTarget,
    editorNavigationTarget: input.editorNavigationTarget,
    editorSplitCompanion: input.editorSplitCompanion,
    editorSplitLayout: input.editorSplitLayout,
    engineModelsAsOptions: input.engineModelsAsOptions,
    engineSelectedModelIdByType: input.engineSelectedModelIdByType,
    engineStatuses: input.engineStatuses,
    ensureLaunchTerminal: input.ensureLaunchTerminal,
    ensureTerminalWithTitle: input.ensureTerminalWithTitle,
    errorToasts: input.errorToasts,
    expandRightPanel: input.expandRightPanel,
    expandSidebar: input.expandSidebar,
    fileReferenceMode: input.fileReferenceMode,
    fileTreeLoadError: input.fileTreeLoadError,
    fileTreeSourceVersion: input.fileTreeSourceVersion,
    files: input.files,
    getGlobalPromptsDir: input.getGlobalPromptsDir,
    getPinTimestamp: input.getPinTimestamp,
    getThreadRows: input.getThreadRows,
    globalSearchFilesByWorkspace: input.globalSearchFilesByWorkspace,
  };
}
