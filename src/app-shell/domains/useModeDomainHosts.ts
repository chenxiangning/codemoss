import { useMemo } from "react";
import type { AppMode } from "../../types";
import { useKanbanStore } from "../../features/kanban/hooks/useKanbanStore";
import type { WorkspaceInfo } from "../../types";

/**
 * S4 PR-E：按 appMode 的 feature flags（纯派生，无 UI）。
 * 视图层仍由 showKanban/showExtensions 等条件 JSX 控制；
 * 本 host 给 Git/Kanban 等数据路径统一「是否在表面模式」判定。
 */
export function resolveAppModeSurfaceFlags(appMode: AppMode) {
  const showKanban = appMode === "kanban";
  const showGitHistory = appMode === "gitHistory";
  const showExtensions = appMode === "extensions";
  const isChatSurface = appMode === "chat";
  /** chat / gitHistory 才需要右栏 Git active 轮询与 preload */
  const isGitSurfaceMode = appMode === "chat" || appMode === "gitHistory";
  return {
    appMode,
    showKanban,
    showGitHistory,
    showExtensions,
    isChatSurface,
    isGitSurfaceMode,
  };
}

export function useAppModeSurfaceFlags(appMode: AppMode) {
  return useMemo(() => resolveAppModeSurfaceFlags(appMode), [appMode]);
}

/**
 * Kanban 数据 host。
 *
 * 注意：scheduled/autoStart 任务在非看板视图仍须执行（见 useAppShellKanbanExecutionSection），
 * 因此 store 保持常驻；本 host 只统一出口并附带 surface flag，供后续按任务态做更细门控。
 */
export function useKanbanDomainHost(input: {
  workspaces: WorkspaceInfo[];
  appMode: AppMode;
}) {
  const surface = useAppModeSurfaceFlags(input.appMode);
  const store = useKanbanStore(input.workspaces);
  return {
    ...store,
    isKanbanSurfaceActive: surface.showKanban,
    isGitSurfaceMode: surface.isGitSurfaceMode,
    modeSurface: surface,
  };
}

export type KanbanDomainHost = ReturnType<typeof useKanbanDomainHost>;
