import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalSearchShortcut } from "../../features/app/hooks/useGlobalSearchShortcut";
import type { CenterMode } from "../../features/app/hooks/useGitPanelController";
import { useRecordRecentFilesFromActivity } from "../../features/quick-switcher/hooks/useRecordRecentFilesFromActivity";
import { useQuickSwitcherRecentFiles } from "../../features/quick-switcher/hooks/useQuickSwitcherRecentFiles";
import type {
  QuickSwitcherNavigationId,
  QuickSwitcherRunningSession,
} from "../../features/quick-switcher/types";
import { projectQuickSwitcherSessionGroups } from "../../features/quick-switcher/sessionProjection";
import { pushQuickSwitcherSelectWorkspaceToast } from "./quickSwitcherNavigationState";
import type { SessionActivityEvent } from "../../features/session-activity/types";
import type { SessionRadarEntry } from "../../features/session-activity/hooks/useSessionRadarFeed";
import type { AppMode, ThreadSummary, WorkspaceInfo } from "../../types";

// Stable empty timeline for activity kill-switch (avoid effect re-fire each render)
const EMPTY_ACTIVITY_TIMELINE: SessionActivityEvent[] = [];

type QuickSwitcherShellBoundary = {
  activeWorkspaceId: string | null;
  threadsByWorkspace: Record<string, ThreadSummary[]>;
  workspaces: WorkspaceInfo[];
  activityTimeline: SessionActivityEvent[];
  runningSessions: SessionRadarEntry[];
  isCompact: boolean;
  isSearchPaletteOpen: boolean;
  setIsSearchPaletteOpen: (open: boolean) => void;
  setActiveTab: (tab: "projects" | "codex" | "spec" | "git" | "log") => void;
  setActiveThreadId: (threadId: string, workspaceId: string) => void;
  setAppMode: (mode: AppMode) => void;
  setCenterMode: (mode: CenterMode) => void;
  setFilePanelMode: (mode: "git" | "files") => void;
  setGitPanelMode: (mode: "diff" | "log" | "issues" | "prs") => void;
  setHomeOpen: (open: boolean) => void;
  setWorkspaceHomeWorkspaceId: (id: string | null) => void;
  expandRightPanel: () => void;
  handleOpenFile: (
    path: string,
    location?: undefined,
    options?: { targetWorkspace?: WorkspaceInfo | null },
  ) => void;
  selectWorkspace: (workspaceId: string) => void;
  handleToggleTerminalPanel: () => void;
  openSettings: () => void;
};

export function useAppShellQuickSwitcherSection(
  input: QuickSwitcherShellBoundary,
) {
  const {
    activeWorkspaceId,
    // activityTimeline unused while session-activity kill-switch is on
    activityTimeline: _activityTimeline,
    expandRightPanel,
    handleOpenFile,
    handleToggleTerminalPanel,
    isCompact,
    isSearchPaletteOpen,
    openSettings,
    runningSessions,
    selectWorkspace,
    setActiveTab,
    setActiveThreadId,
    setAppMode,
    setCenterMode,
    setFilePanelMode,
    setGitPanelMode,
    setHomeOpen,
    setIsSearchPaletteOpen,
    setWorkspaceHomeWorkspaceId,
    threadsByWorkspace,
    workspaces,
  } = input;
  const [isQuickSwitcherOpen, setIsQuickSwitcherOpen] = useState(false);
  const { t } = useTranslation();

  // DISABLED: disable-session-activity-and-solo-mode — no AI recent-files from activity
  useRecordRecentFilesFromActivity(activeWorkspaceId, EMPTY_ACTIVITY_TIMELINE);

  const quickSwitcherSessionGroups = useMemo(
    () => projectQuickSwitcherSessionGroups(workspaces, threadsByWorkspace),
    [threadsByWorkspace, workspaces],
  );
  const quickSwitcherRunningSessions = useMemo<QuickSwitcherRunningSession[]>(
    () =>
      runningSessions.map((entry) => ({
        workspaceId: entry.workspaceId,
        workspaceName: entry.workspaceName,
        threadId: entry.threadId,
        threadName: entry.threadName,
        engine: entry.engine,
        // 直取 radar 开始时间：null 表示尚未观测到开始时间，由渲染层省略时间
        // 显示（不回退 updatedAt，避免语义误导）。
        startedAt: entry.startedAt,
      })),
    [runningSessions],
  );
  const quickSwitcherRecentFileGroups = useQuickSwitcherRecentFiles(workspaces);

  const closeQuickSwitcher = useCallback(() => {
    setIsQuickSwitcherOpen(false);
  }, []);

  const handleOpenQuickSwitcher = useCallback(() => {
    setIsSearchPaletteOpen(false);
    setIsQuickSwitcherOpen(true);
  }, [setIsSearchPaletteOpen]);

  const handleToggleQuickSwitcher = useCallback(() => {
    setIsQuickSwitcherOpen((current) => !current);
    setIsSearchPaletteOpen(false);
  }, [setIsSearchPaletteOpen]);

  useGlobalSearchShortcut({
    isEnabled: !isCompact,
    shortcut: "cmd+e",
    onTrigger: handleToggleQuickSwitcher,
  });

  useEffect(() => {
    if (isSearchPaletteOpen) {
      setIsQuickSwitcherOpen(false);
    }
  }, [isSearchPaletteOpen]);

  const handleQuickSwitcherSelectSession = useCallback(
    (workspaceId: string, threadId: string) => {
      if (!workspaceId) {
        return;
      }
      // 与 file 激活路径对齐（fix-quick-switcher-file-activation-main-area）：
      // 会话激活同样先关闭首页表面，否则 action 会在 home 遮罩后执行、
      // 用户看不到任何反馈。
      setHomeOpen(false);
      setWorkspaceHomeWorkspaceId(null);
      setAppMode("chat");
      setActiveTab("codex");
      if (workspaceId !== activeWorkspaceId) {
        selectWorkspace(workspaceId);
      }
      setActiveThreadId(threadId, workspaceId);
      closeQuickSwitcher();
    }, [
      activeWorkspaceId,
      closeQuickSwitcher,
      selectWorkspace,
      setActiveTab,
      setActiveThreadId,
      setAppMode,
      setHomeOpen,
      setWorkspaceHomeWorkspaceId,
    ],
  );

  const handleQuickSwitcherSelectFile = useCallback(
    (workspaceId: string, path: string) => {
      const targetWorkspace = workspaces.find(
        (workspace) => workspace.id === workspaceId,
      );
      if (!targetWorkspace) {
        return;
      }
      setHomeOpen(false);
      setWorkspaceHomeWorkspaceId(null);
      setAppMode("chat");
      setActiveTab("codex");
      if (workspaceId !== activeWorkspaceId) {
        selectWorkspace(workspaceId);
      }
      handleOpenFile(path, undefined, { targetWorkspace });
      closeQuickSwitcher();
    },
    [
      activeWorkspaceId,
      closeQuickSwitcher,
      handleOpenFile,
      selectWorkspace,
      setActiveTab,
      setAppMode,
      setHomeOpen,
      setWorkspaceHomeWorkspaceId,
      workspaces,
    ],
  );

  const handleQuickSwitcherNavigate = useCallback(
    (target: QuickSwitcherNavigationId) => {
      // 统一放入口处（含回切与提示分支）：任何导航激活先关闭首页表面，
      // 与 file/session 激活路径对齐，避免 action 在 home 遮罩后执行。
      setHomeOpen(false);
      setWorkspaceHomeWorkspaceId(null);
      switch (target) {
        case "chat":
          setAppMode("chat");
          setActiveTab("codex");
          setCenterMode("chat");
          break;
        // files/git/kanban/settings 的「已开 → 回切」拦截已上移到 wrapper
        // （useAppShellLayoutNodesSection 的 handleQuickSwitcherNavigate，
        // design.md D1）；这里的 case 保留为兜底 open action，服务未经
        // wrapper 的入口路径（如 command palette）。
        case "files":
          setAppMode("chat");
          setCenterMode("chat");
          setFilePanelMode("files");
          expandRightPanel();
          break;
        case "git":
          setAppMode("chat");
          setFilePanelMode("git");
          setGitPanelMode("diff");
          expandRightPanel();
          break;
        case "history":
          setAppMode("gitHistory");
          break;
        case "kanban":
          setAppMode("kanban");
          break;
        case "spec":
        case "intentCanvas":
        case "projectMap":
        case "globalSearch":
        case "notes":
        case "memory":
          // These targets have no local action here: the app-shell wiring in
          // useAppShellLayoutNodesSection intercepts them with the canonical
          // open actions (handleOpenSpecHub detached window,
          // handleOpenIntentCanvas, handleOpenProjectMap,
          // handleOpenSearchPalette, handleOpenNotes, handleOpenProjectMemory)
          // before delegating the remaining targets to this base handler.
          // Keep the cases explicit so the delegation contract stays visible
          // instead of falling through.
          break;
        case "terminal":
          // 无 active workspace 时终端面板是静默 no-op（usePanelVisibility），
          // 按 D2 改为 info toast 提示先选择工作区，且不执行 toggle。
          if (!activeWorkspaceId) {
            pushQuickSwitcherSelectWorkspaceToast(t, "terminal");
            break;
          }
          handleToggleTerminalPanel();
          break;
        case "settings":
          openSettings();
          break;
      }
      closeQuickSwitcher();
    },
    [
      activeWorkspaceId,
      closeQuickSwitcher,
      expandRightPanel,
      handleToggleTerminalPanel,
      openSettings,
      setActiveTab,
      setAppMode,
      setCenterMode,
      setFilePanelMode,
      setGitPanelMode,
      setHomeOpen,
      setWorkspaceHomeWorkspaceId,
      t,
    ],
  );

  return {
    closeQuickSwitcher,
    handleOpenQuickSwitcher,
    handleQuickSwitcherNavigate,
    handleQuickSwitcherSelectFile,
    handleQuickSwitcherSelectSession,
    isQuickSwitcherOpen,
    quickSwitcherRunningSessions,
    quickSwitcherSessionGroups,
    quickSwitcherRecentFileGroups,
  };
}
