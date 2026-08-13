export type ShortcutSettingKey =
  | "composerModelShortcut"
  | "composerAccessShortcut"
  | "composerReasoningShortcut"
  | "composerCollaborationShortcut"
  | "interruptShortcut"
  | "openSettingsShortcut"
  | "newWindowShortcut"
  | "newAgentShortcut"
  | "newWorktreeAgentShortcut"
  | "newCloneAgentShortcut"
  | "archiveThreadShortcut"
  | "closeCurrentSessionShortcut"
  | "openChatShortcut"
  | "openKanbanShortcut"
  | "cycleOpenSessionPrevShortcut"
  | "cycleOpenSessionNextShortcut"
  | "toggleLeftConversationSidebarShortcut"
  | "toggleRightConversationSidebarShortcut"
  | "toggleProjectsSidebarShortcut"
  | "toggleGitSidebarShortcut"
  | "toggleGlobalSearchShortcut"
  | "toggleDebugPanelShortcut"
  | "toggleTerminalShortcut"
  | "toggleRuntimeConsoleShortcut"
  | "toggleFilesSurfaceShortcut"
  | "saveFileShortcut"
  | "findInFileShortcut"
  | "expandSelectionShortcut"
  | "toggleGitDiffListViewShortcut"
  | "toggleGitGraphShortcut"
  | "openNotesShortcut"
  | "openIntentCanvasShortcut"
  | "openRadarShortcut"
  | "openProjectMapShortcut"
  | "openBrowserDockShortcut"
  | "openFileCompareShortcut"
  | "increaseUiScaleShortcut"
  | "decreaseUiScaleShortcut"
  | "resetUiScaleShortcut"
  | "cycleAgentNextShortcut"
  | "cycleAgentPrevShortcut"
  | "cycleWorkspaceNextShortcut"
  | "cycleWorkspacePrevShortcut";

export type ShortcutDraftKey =
  | "model"
  | "access"
  | "reasoning"
  | "collaboration"
  | "interrupt"
  | "openSettings"
  | "newWindow"
  | "newAgent"
  | "newWorktreeAgent"
  | "newCloneAgent"
  | "archiveThread"
  | "closeCurrentSession"
  | "openChat"
  | "openKanban"
  | "cycleOpenSessionPrev"
  | "cycleOpenSessionNext"
  | "leftConversationSidebar"
  | "rightConversationSidebar"
  | "projectsSidebar"
  | "gitSidebar"
  | "globalSearch"
  | "debugPanel"
  | "terminal"
  | "runtimeConsole"
  | "filesSurface"
  | "saveFile"
  | "findInFile"
  | "expandSelection"
  | "gitDiffListView"
  | "gitGraph"
  | "notes"
  | "intentCanvas"
  | "radar"
  | "projectMap"
  | "browserDock"
  | "fileCompare"
  | "increaseUiScale"
  | "decreaseUiScale"
  | "resetUiScale"
  | "cycleAgentNext"
  | "cycleAgentPrev"
  | "cycleWorkspaceNext"
  | "cycleWorkspacePrev";

export type ShortcutDrafts = Record<ShortcutDraftKey, string | null>;

export type ShortcutCategory =
  | "common"
  | "app"
  | "file"
  | "composer"
  | "panels"
  | "editor"
  | "git"
  | "uiScale"
  | "navigation";

export type ShortcutScope = "global" | "surface" | "editor" | "native-menu";

export type ShortcutTriggerSurface =
  "dom" | "native-menu" | "editor" | "settings";

export type ShortcutActionMetadata = {
  id: string;
  setting: ShortcutSettingKey;
  draftKey: ShortcutDraftKey;
  category: ShortcutCategory;
  labelKey: string;
  featuredLabelKey?: string;
  defaultShortcut: string | null;
  defaultLabelKey?: string;
  scope: ShortcutScope;
  triggerSurface: ShortcutTriggerSurface;
  featured?: boolean;
  featuredOrder?: number;
};

export const shortcutCategoryDefinitions: Array<{
  id: ShortcutCategory;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    id: "common",
    titleKey: "settings.commonModulesSubtitle",
    descriptionKey: "settings.commonModulesSubDescription",
  },
  {
    id: "app",
    titleKey: "settings.appSubtitle",
    descriptionKey: "settings.appSubDescription",
  },
  {
    id: "file",
    titleKey: "settings.fileSubtitle",
    descriptionKey: "settings.fileSubDescription",
  },
  {
    id: "composer",
    titleKey: "settings.composerSubtitle",
    descriptionKey: "settings.composerSubDescription",
  },
  {
    id: "panels",
    titleKey: "settings.panelsSubtitle",
    descriptionKey: "settings.panelsSubDescription",
  },
  {
    id: "editor",
    titleKey: "settings.editorSubtitle",
    descriptionKey: "settings.editorSubDescription",
  },
  {
    id: "git",
    titleKey: "settings.gitSubtitle",
    descriptionKey: "settings.gitSubDescription",
  },
  {
    id: "navigation",
    titleKey: "settings.navigationSubtitle",
    descriptionKey: "settings.navigationSubDescription",
  },
];

export const shortcutActions: ShortcutActionMetadata[] = [
  {
    id: "open-settings",
    setting: "openSettingsShortcut",
    draftKey: "openSettings",
    category: "app",
    labelKey: "settings.openSettings",
    defaultShortcut: "cmd+,",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "new-window",
    setting: "newWindowShortcut",
    draftKey: "newWindow",
    category: "app",
    labelKey: "settings.newWindow",
    defaultShortcut: "cmd+shift+n",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "open-chat-mode",
    setting: "openChatShortcut",
    draftKey: "openChat",
    category: "app",
    labelKey: "settings.openChatMode",
    defaultShortcut: "cmd+j",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "open-kanban-mode",
    setting: "openKanbanShortcut",
    draftKey: "openKanban",
    category: "app",
    labelKey: "settings.openKanbanMode",
    defaultShortcut: "cmd+k",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "new-agent",
    setting: "newAgentShortcut",
    draftKey: "newAgent",
    category: "file",
    labelKey: "settings.newAgent",
    defaultShortcut: "cmd+n",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "new-worktree-agent",
    setting: "newWorktreeAgentShortcut",
    draftKey: "newWorktreeAgent",
    category: "file",
    labelKey: "settings.newWorktreeAgent",
    defaultShortcut: "cmd+alt+shift+n",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "new-clone-agent",
    setting: "newCloneAgentShortcut",
    draftKey: "newCloneAgent",
    category: "file",
    labelKey: "settings.newCloneAgent",
    defaultShortcut: "cmd+alt+n",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "archive-active-thread",
    setting: "archiveThreadShortcut",
    draftKey: "archiveThread",
    category: "file",
    labelKey: "settings.archiveActiveThread",
    defaultShortcut: "cmd+ctrl+a",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "close-current-session",
    setting: "closeCurrentSessionShortcut",
    draftKey: "closeCurrentSession",
    category: "navigation",
    labelKey: "settings.closeCurrentSession",
    defaultShortcut: "cmd+w",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "cycle-open-session-prev",
    setting: "cycleOpenSessionPrevShortcut",
    draftKey: "cycleOpenSessionPrev",
    category: "navigation",
    labelKey: "settings.previousOpenSession",
    defaultShortcut: "cmd+shift+[",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "cycle-open-session-next",
    setting: "cycleOpenSessionNextShortcut",
    draftKey: "cycleOpenSessionNext",
    category: "navigation",
    labelKey: "settings.nextOpenSession",
    defaultShortcut: "cmd+shift+]",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "toggle-left-conversation-sidebar",
    setting: "toggleLeftConversationSidebarShortcut",
    draftKey: "leftConversationSidebar",
    category: "panels",
    labelKey: "settings.toggleLeftConversationSidebar",
    defaultShortcut: "cmd+alt+[",
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 1,
  },
  {
    id: "toggle-right-conversation-sidebar",
    setting: "toggleRightConversationSidebarShortcut",
    draftKey: "rightConversationSidebar",
    category: "panels",
    labelKey: "settings.toggleRightConversationSidebar",
    defaultShortcut: "cmd+alt+]",
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 2,
  },
  {
    id: "toggle-projects-sidebar",
    setting: "toggleProjectsSidebarShortcut",
    draftKey: "projectsSidebar",
    category: "panels",
    labelKey: "settings.toggleProjectsSidebar",
    defaultShortcut: "cmd+shift+p",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "toggle-git-sidebar",
    setting: "toggleGitSidebarShortcut",
    draftKey: "gitSidebar",
    category: "panels",
    labelKey: "settings.toggleGitSidebar",
    featuredLabelKey: "panels.git",
    defaultShortcut: "cmd+shift+g",
    scope: "native-menu",
    triggerSurface: "native-menu",
    featured: true,
    featuredOrder: 5,
  },
  {
    id: "toggle-global-search",
    setting: "toggleGlobalSearchShortcut",
    draftKey: "globalSearch",
    category: "panels",
    labelKey: "settings.toggleGlobalSearch",
    defaultShortcut: "cmd+o",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "toggle-debug-panel",
    setting: "toggleDebugPanelShortcut",
    draftKey: "debugPanel",
    category: "panels",
    labelKey: "settings.toggleDebugPanel",
    defaultShortcut: "cmd+shift+d",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "toggle-terminal",
    setting: "toggleTerminalShortcut",
    draftKey: "terminal",
    category: "panels",
    labelKey: "settings.toggleTerminalPanel",
    defaultShortcut: "cmd+shift+t",
    scope: "native-menu",
    triggerSurface: "native-menu",
    featured: true,
    featuredOrder: 12,
  },
  {
    id: "toggle-runtime-console",
    setting: "toggleRuntimeConsoleShortcut",
    draftKey: "runtimeConsole",
    category: "panels",
    labelKey: "settings.toggleRuntimeConsole",
    defaultShortcut: "cmd+shift+`",
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "toggle-files-surface",
    setting: "toggleFilesSurfaceShortcut",
    draftKey: "filesSurface",
    category: "panels",
    labelKey: "settings.openFilesSurface",
    featuredLabelKey: "panels.files",
    defaultShortcut: "cmd+shift+e",
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 4,
  },
  {
    id: "toggle-git-graph",
    setting: "toggleGitGraphShortcut",
    draftKey: "gitGraph",
    category: "panels",
    labelKey: "git.historyQuickAction",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 3,
  },
  {
    id: "open-notes",
    setting: "openNotesShortcut",
    draftKey: "notes",
    category: "panels",
    labelKey: "panels.notes",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 6,
  },
  {
    id: "open-intent-canvas",
    setting: "openIntentCanvasShortcut",
    draftKey: "intentCanvas",
    category: "panels",
    labelKey: "intentCanvas.manager.title",
    featuredLabelKey: "panels.intentCanvas",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 7,
  },
  {
    id: "open-radar",
    setting: "openRadarShortcut",
    draftKey: "radar",
    category: "panels",
    labelKey: "panels.radar",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 8,
  },
  {
    id: "open-project-map",
    setting: "openProjectMapShortcut",
    draftKey: "projectMap",
    category: "panels",
    labelKey: "intentCanvas.manager.projectMap",
    featuredLabelKey: "panels.projectMap",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 9,
  },
  {
    id: "open-browser-dock",
    setting: "openBrowserDockShortcut",
    draftKey: "browserDock",
    category: "panels",
    labelKey: "browserAgent.dock.panelTitle",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 10,
  },
  {
    id: "open-file-compare",
    setting: "openFileCompareShortcut",
    draftKey: "fileCompare",
    category: "panels",
    labelKey: "files.fileCompare.title",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
    featured: true,
    featuredOrder: 11,
  },
  {
    id: "composer-cycle-model",
    setting: "composerModelShortcut",
    draftKey: "model",
    category: "composer",
    labelKey: "settings.cycleModel",
    defaultShortcut: "cmd+shift+m",
    defaultLabelKey: "settings.pressNewShortcut",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "composer-cycle-access",
    setting: "composerAccessShortcut",
    draftKey: "access",
    category: "composer",
    labelKey: "settings.cycleAccessMode",
    defaultShortcut: "cmd+shift+a",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "composer-cycle-reasoning",
    setting: "composerReasoningShortcut",
    draftKey: "reasoning",
    category: "composer",
    labelKey: "settings.cycleReasoningMode",
    defaultShortcut: "cmd+shift+r",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "composer-cycle-collaboration",
    setting: "composerCollaborationShortcut",
    draftKey: "collaboration",
    category: "composer",
    labelKey: "settings.cycleCollaborationMode",
    defaultShortcut: "shift+tab",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "interrupt-active-run",
    setting: "interruptShortcut",
    draftKey: "interrupt",
    category: "composer",
    labelKey: "settings.stopActiveRun",
    defaultShortcut: null,
    scope: "global",
    triggerSurface: "dom",
  },
  {
    id: "save-file",
    setting: "saveFileShortcut",
    draftKey: "saveFile",
    category: "editor",
    labelKey: "settings.saveFile",
    defaultShortcut: "cmd+s",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "find-in-file",
    setting: "findInFileShortcut",
    draftKey: "findInFile",
    category: "editor",
    labelKey: "settings.findInFile",
    defaultShortcut: "cmd+f",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "expand-selection",
    setting: "expandSelectionShortcut",
    draftKey: "expandSelection",
    category: "editor",
    labelKey: "settings.expandSelection",
    defaultShortcut: "cmd+w",
    scope: "editor",
    triggerSurface: "editor",
  },
  {
    id: "toggle-git-diff-list-view",
    setting: "toggleGitDiffListViewShortcut",
    draftKey: "gitDiffListView",
    category: "git",
    labelKey: "settings.toggleGitDiffListView",
    defaultShortcut: "alt+shift+v",
    scope: "surface",
    triggerSurface: "dom",
  },
  // UI scale shortcuts removed — scale permanently locked to 100%.
  {
    id: "cycle-agent-next",
    setting: "cycleAgentNextShortcut",
    draftKey: "cycleAgentNext",
    category: "navigation",
    labelKey: "settings.nextAgent",
    defaultShortcut: "cmd+ctrl+down",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "cycle-agent-prev",
    setting: "cycleAgentPrevShortcut",
    draftKey: "cycleAgentPrev",
    category: "navigation",
    labelKey: "settings.previousAgent",
    defaultShortcut: "cmd+ctrl+up",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "cycle-workspace-next",
    setting: "cycleWorkspaceNextShortcut",
    draftKey: "cycleWorkspaceNext",
    category: "navigation",
    labelKey: "settings.nextWorkspace",
    defaultShortcut: "cmd+shift+down",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
  {
    id: "cycle-workspace-prev",
    setting: "cycleWorkspacePrevShortcut",
    draftKey: "cycleWorkspacePrev",
    category: "navigation",
    labelKey: "settings.previousWorkspace",
    defaultShortcut: "cmd+shift+up",
    scope: "native-menu",
    triggerSurface: "native-menu",
  },
];

export const shortcutDraftKeyBySetting: Record<
  ShortcutSettingKey,
  ShortcutDraftKey
> = {
  composerModelShortcut: "model",
  composerAccessShortcut: "access",
  composerReasoningShortcut: "reasoning",
  composerCollaborationShortcut: "collaboration",
  interruptShortcut: "interrupt",
  openSettingsShortcut: "openSettings",
  newWindowShortcut: "newWindow",
  newAgentShortcut: "newAgent",
  newWorktreeAgentShortcut: "newWorktreeAgent",
  newCloneAgentShortcut: "newCloneAgent",
  archiveThreadShortcut: "archiveThread",
  closeCurrentSessionShortcut: "closeCurrentSession",
  openChatShortcut: "openChat",
  openKanbanShortcut: "openKanban",
  cycleOpenSessionPrevShortcut: "cycleOpenSessionPrev",
  cycleOpenSessionNextShortcut: "cycleOpenSessionNext",
  toggleLeftConversationSidebarShortcut: "leftConversationSidebar",
  toggleRightConversationSidebarShortcut: "rightConversationSidebar",
  toggleProjectsSidebarShortcut: "projectsSidebar",
  toggleGitSidebarShortcut: "gitSidebar",
  toggleGlobalSearchShortcut: "globalSearch",
  toggleDebugPanelShortcut: "debugPanel",
  toggleTerminalShortcut: "terminal",
  toggleRuntimeConsoleShortcut: "runtimeConsole",
  toggleFilesSurfaceShortcut: "filesSurface",
  saveFileShortcut: "saveFile",
  findInFileShortcut: "findInFile",
  expandSelectionShortcut: "expandSelection",
  toggleGitDiffListViewShortcut: "gitDiffListView",
  toggleGitGraphShortcut: "gitGraph",
  openNotesShortcut: "notes",
  openIntentCanvasShortcut: "intentCanvas",
  openRadarShortcut: "radar",
  openProjectMapShortcut: "projectMap",
  openBrowserDockShortcut: "browserDock",
  openFileCompareShortcut: "fileCompare",
  increaseUiScaleShortcut: "increaseUiScale",
  decreaseUiScaleShortcut: "decreaseUiScale",
  resetUiScaleShortcut: "resetUiScale",
  cycleAgentNextShortcut: "cycleAgentNext",
  cycleAgentPrevShortcut: "cycleAgentPrev",
  cycleWorkspaceNextShortcut: "cycleWorkspaceNext",
  cycleWorkspacePrevShortcut: "cycleWorkspacePrev",
};

export function buildShortcutDrafts(
  settings: Record<ShortcutSettingKey, string | null | undefined>,
): ShortcutDrafts {
  return Object.fromEntries(
    shortcutActions.map((action) => [
      action.draftKey,
      settings[action.setting] ?? "",
    ]),
  ) as ShortcutDrafts;
}
