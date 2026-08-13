// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, WorkspaceInfo } from "../../types";
import { useWorkspaceSessionHost } from "./useWorkspaceSessionHost";

const useWorkspaceControllerMock = vi.fn();
const useAppShellWorkspaceHomeStateMock = vi.fn();

vi.mock("../../features/app/hooks/useWorkspaceController", () => ({
  useWorkspaceController: (...args: unknown[]) =>
    useWorkspaceControllerMock(...args),
}));

vi.mock("../sections/useAppShellWorkspaceHomeState", () => ({
  useAppShellWorkspaceHomeState: (...args: unknown[]) =>
    useAppShellWorkspaceHomeStateMock(...args),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "demo",
  path: "/tmp/demo",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const appSettings = {
  codexBin: "codex",
} as AppSettings;

describe("useWorkspaceSessionHost", () => {
  beforeEach(() => {
    useWorkspaceControllerMock.mockReturnValue({
      workspaces: [workspace],
      workspaceGroups: [],
      groupedWorkspaces: [],
      getWorkspaceGroupName: vi.fn(),
      ungroupedLabel: "Ungrouped",
      activeWorkspace: workspace,
      activeWorkspaceId: "ws-1",
      setActiveWorkspaceId: vi.fn(),
      addWorkspace: vi.fn(),
      addWorkspaceFromPath: vi.fn(),
      addCloneAgent: vi.fn(),
      addWorktreeAgent: vi.fn(),
      connectWorkspace: vi.fn(),
      markWorkspaceConnected: vi.fn(),
      updateWorkspaceSettings: vi.fn(),
      updateWorkspaceCodexBin: vi.fn(),
      createWorkspaceGroup: vi.fn(),
      renameWorkspaceGroup: vi.fn(),
      moveWorkspaceGroup: vi.fn(),
      deleteWorkspaceGroup: vi.fn(),
      assignWorkspaceGroup: vi.fn(),
      removeWorkspace: vi.fn(),
      removeWorktree: vi.fn(),
      renameWorktree: vi.fn(),
      renameWorktreeUpstream: vi.fn(),
      deletingWorktreeIds: new Set(),
      hasLoaded: true,
      refreshWorkspaces: vi.fn(),
    });
    useAppShellWorkspaceHomeStateMock.mockReturnValue({
      homeOpen: true,
      homeWorkspaceDefaultId: "ws-1",
      homeWorkspaceSelectedId: "ws-1",
      setHomeOpen: vi.fn(),
      workspacesById: new Map([["ws-1", workspace]]),
      workspacesByPath: new Map([["/tmp/demo", workspace]]),
    });
  });

  it("composes workspace controller with home projection", () => {
    const addDebugEntry = vi.fn();
    const queueSaveSettings = vi.fn();

    const { result } = renderHook(() =>
      useWorkspaceSessionHost({
        appSettings,
        appSettingsLoading: false,
        addDebugEntry,
        queueSaveSettings,
      }),
    );

    expect(useWorkspaceControllerMock).toHaveBeenCalledWith({
      appSettings,
      addDebugEntry,
      queueSaveSettings,
    });
    expect(useAppShellWorkspaceHomeStateMock).toHaveBeenCalledWith({
      activeWorkspaceId: "ws-1",
      appSettingsLoading: false,
      groupedWorkspaces: [],
      hasLoaded: true,
      workspaces: [workspace],
    });

    expect(result.current.activeWorkspaceId).toBe("ws-1");
    expect(result.current.homeOpen).toBe(true);
    expect(result.current.workspacesById.get("ws-1")?.path).toBe("/tmp/demo");
    expect(result.current.hasLoaded).toBe(true);
  });
});
