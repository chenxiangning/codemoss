// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../types";
import { useAppShellWorktreeChromeSection } from "./useAppShellWorktreeChromeSection";

function createWorkspace(
  id: string,
  overrides: Partial<WorkspaceInfo> = {},
): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
    ...overrides,
  };
}

function createParams(overrides: Record<string, unknown> = {}) {
  const parent = createWorkspace("parent");
  const worktree = createWorkspace("worktree", {
    kind: "worktree",
    parentId: parent.id,
    worktree: { branch: "feature/test" },
  });
  return {
    activeTab: "codex" as const,
    activeWorkspace: worktree,
    confirmRenameWorktreeUpstream: vi.fn(),
    handleOpenRenameWorktree: vi.fn(),
    handleRenameWorktreeCancel: vi.fn(),
    handleRenameWorktreeChange: vi.fn(),
    handleRenameWorktreeConfirm: vi.fn(),
    isPhone: false,
    isTablet: false,
    renameWorktreeNotice: null,
    renameWorktreePrompt: null,
    renameWorktreeUpstreamPrompt: null,
    setActiveTab: vi.fn(),
    workspacesById: new Map([
      [parent.id, parent],
      [worktree.id, worktree],
    ]),
    ...overrides,
  };
}

describe("useAppShellWorktreeChromeSection", () => {
  it("derives worktree chrome state and keeps the parent as base workspace", () => {
    const params = createParams();
    const { result } = renderHook(() =>
      useAppShellWorktreeChromeSection(params),
    );

    expect(result.current.isWorktreeWorkspace).toBe(true);
    expect(result.current.activeParentWorkspace?.id).toBe("parent");
    expect(result.current.baseWorkspaceRef.current?.id).toBe("parent");
    expect(result.current.worktreeLabel).toBe("feature/test");
    expect(result.current.worktreeRename?.name).toBe("feature/test");
  });

  it("moves phone users without a workspace to projects", () => {
    const setActiveTab = vi.fn();
    renderHook(() =>
      useAppShellWorktreeChromeSection(
        createParams({
          activeWorkspace: null,
          activeTab: "codex",
          isPhone: true,
          setActiveTab,
        }),
      ),
    );

    expect(setActiveTab).toHaveBeenCalledWith("projects");
  });

  it("moves tablet users away from the projects tab", () => {
    const setActiveTab = vi.fn();
    renderHook(() =>
      useAppShellWorktreeChromeSection(
        createParams({ activeTab: "projects", isTablet: true, setActiveTab }),
      ),
    );

    expect(setActiveTab).toHaveBeenCalledWith("codex");
  });
});
