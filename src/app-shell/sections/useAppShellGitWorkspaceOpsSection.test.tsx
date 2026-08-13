// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitBranchListItem, GitRepositorySummary, WorkspaceInfo } from "../../types";
import { useGitBranches } from "../../features/git/hooks/useGitBranches";
import { useGitRepositories } from "../../features/git/hooks/useGitRepositories";
import { useGitActions } from "../../features/git/hooks/useGitActions";
import { pickWorkspacePath } from "../../services/tauri/filePickers";
import { pushErrorToast } from "../../services/toasts";
import { useAppShellGitWorkspaceOpsSection } from "./useAppShellGitWorkspaceOpsSection";

vi.mock("../../features/git/hooks/useGitBranches", () => ({
  useGitBranches: vi.fn(),
}));

vi.mock("../../features/git/hooks/useGitActions", () => ({
  useGitActions: vi.fn(),
}));

vi.mock("../../features/git/hooks/useGitRepositories", () => ({
  useGitRepositories: vi.fn(),
}));

vi.mock("../../features/files/detachedFileExplorer", () => ({
  buildDetachedFileExplorerSession: vi.fn((input) => input),
  openOrFocusDetachedFileExplorer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../services/tauri/filePickers", () => ({
  pickWorkspacePath: vi.fn(),
}));

vi.mock("../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function repositorySummary(
  repositoryRoot: string,
  displayName: string,
  currentBranch: string | null,
): GitRepositorySummary {
  return {
    repositoryRoot,
    displayName,
    currentBranch,
    headState: currentBranch ? "branch" : "unborn",
    upstream: null,
    ahead: 0,
    behind: 0,
    stagedCount: 0,
    modifiedCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    fileStatuses: [],
    isClean: true,
    error: null,
  };
}

function branchItem(name: string, isRemote = false): GitBranchListItem {
  return {
    name,
    isCurrent: false,
    isRemote,
    remote: isRemote ? name.split("/")[0] ?? null : null,
    upstream: null,
    lastCommit: 0,
    headSha: null,
    ahead: 0,
    behind: 0,
  };
}

function branchList(localNames: string[], remoteNames: string[]) {
  return {
    branches: localNames.map((name) => ({ name, lastCommit: 0 })),
    localBranches: localNames.map((name) => branchItem(name)),
    remoteBranches: remoteNames.map((name) => branchItem(name, true)),
    currentBranch: localNames[0] ?? null,
    repositoryState: "git_repository" as const,
    diagnostic: null,
  };
}

describe("useAppShellGitWorkspaceOpsSection", () => {
  const checkoutBranch = vi.fn().mockResolvedValue(undefined);
  const createBranch = vi.fn().mockResolvedValue(undefined);
  const updateBranch = vi.fn().mockResolvedValue(undefined);
  const refreshBranches = vi.fn().mockResolvedValue(undefined);
  const loadBranchesForRepository = vi.fn();
  const refreshRepositories = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    checkoutBranch.mockResolvedValue(undefined);
    updateBranch.mockResolvedValue(undefined);
    refreshBranches.mockResolvedValue(undefined);
    refreshRepositories.mockResolvedValue(undefined);
    loadBranchesForRepository.mockResolvedValue(branchList([], []));
    vi.mocked(useGitBranches).mockReturnValue({
      branches: [],
      localBranches: [],
      remoteBranches: [],
      currentBranch: null,
      checkoutBranch,
      createBranch,
      updateBranch,
      error: null,
      refreshBranches,
      loadBranchesForRepository,
    });
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    vi.mocked(useGitActions).mockReturnValue({
      applyWorktreeChanges: vi.fn(),
      revertAllGitChanges: vi.fn(),
      revertGitFile: vi.fn(),
      revertGitPaths: vi.fn(),
      stageGitAll: vi.fn(),
      stageGitFile: vi.fn(),
      unstageGitAll: vi.fn(),
      unstageGitFile: vi.fn(),
      unstageGitPaths: vi.fn(),
      worktreeApplyError: null,
      worktreeApplyLoading: false,
      worktreeApplySuccess: false,
    });
  });

  it("refreshes git status after branch checkout and creation", async () => {
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleCheckoutBranch("main");
      await result.current.handleCreateBranch("feature/test");
    });

    expect(checkoutBranch).toHaveBeenCalledWith("main");
    expect(createBranch).toHaveBeenCalledWith("feature/test");
    expect(refreshGitStatus).toHaveBeenCalledTimes(2);
  });

  it("stores a picked git root relative to the workspace", async () => {
    vi.mocked(pickWorkspacePath).mockResolvedValue("/tmp/workspace/packages/app");
    const updateWorkspaceSettings = vi.fn().mockResolvedValue(undefined);
    const clearGitRootCandidates = vi.fn();
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates,
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings,
      }),
    );

    await act(async () => {
      await result.current.handlePickGitRoot();
    });

    expect(updateWorkspaceSettings).toHaveBeenCalledWith("ws-1", {
      gitRoot: "packages/app",
    });
    expect(clearGitRootCandidates).toHaveBeenCalledTimes(1);
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
  });

  it("updates an explicit repository branch and reports the result", async () => {
    updateBranch.mockResolvedValueOnce({
      branch: "main",
      status: "no-op",
      reason: "already_up_to_date",
      message: "already current",
    });
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleUpdateBranch("main", "services/api");
    });

    expect(updateBranch).toHaveBeenCalledWith("main", "services/api");
    expect(useGitBranches).toHaveBeenCalledWith(expect.objectContaining({
      activeWorkspace: workspace,
      repositoryRoot: null,
    }));
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
    expect(pushErrorToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "git.historyBranchMenuUpdate",
      message: "git.historyBranchUpdateAlreadyUpToDate",
      variant: "success",
    }));
  });

  it("deduplicates a pending repository update and reports failures", async () => {
    let rejectUpdate: ((error: Error) => void) | null = null;
    updateBranch.mockReturnValueOnce(new Promise((_, reject) => {
      rejectUpdate = reject;
    }));
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    let firstUpdate: Promise<unknown> | null = null;
    await act(async () => {
      firstUpdate = result.current.handleUpdateBranch("main", "services/api");
      const duplicateResult = await result.current.handleUpdateBranch("main", "services/api");
      expect(duplicateResult).toBeNull();
      rejectUpdate?.(new Error("network unavailable"));
      await firstUpdate;
    });

    expect(updateBranch).toHaveBeenCalledTimes(1);
    expect(pushErrorToast).toHaveBeenCalledWith(expect.objectContaining({
      message: "network unavailable",
      variant: "error",
    }));
  });

  it("updates repositories sequentially, preserves empty-root scope, and skips missing branches", async () => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [
        repositorySummary("", "root", "main"),
        repositorySummary("services/api", "api", "release"),
        repositorySummary("services/empty", "empty", null),
      ],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus,
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    const batchResult = await result.current.handleUpdateAllRepositories();

    expect(updateBranch).toHaveBeenNthCalledWith(1, "main", "", false);
    expect(updateBranch).toHaveBeenNthCalledWith(2, "release", "services/api", false);
    expect(batchResult).toEqual({
      successCount: 2,
      failedRepositories: [],
      skippedRepositories: ["empty"],
    });
    expect(refreshBranches).toHaveBeenCalledTimes(1);
    expect(refreshRepositories).toHaveBeenCalledTimes(1);
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
  });

  it("continues checkout after one repository fails and deduplicates a pending batch", async () => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [
        repositorySummary("", "root", "main"),
        repositorySummary("services/api", "api", "main"),
      ],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    let resolveRootCheckout: () => void = vi.fn();
    checkoutBranch
      .mockReturnValueOnce(new Promise<void>((resolve) => {
        resolveRootCheckout = resolve;
      }))
      .mockRejectedValueOnce(new Error("dirty worktree"));
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    const firstBatch = result.current.handleCheckoutAllRepositories("feature/shared");
    expect(await result.current.handleCheckoutAllRepositories("feature/shared")).toBeNull();
    resolveRootCheckout();
    const batchResult = await firstBatch;

    expect(checkoutBranch).toHaveBeenNthCalledWith(1, "feature/shared", "", false);
    expect(checkoutBranch).toHaveBeenNthCalledWith(2, "feature/shared", "services/api", false);
    expect(batchResult).toEqual({
      successCount: 1,
      failedRepositories: ["api"],
      skippedRepositories: [],
    });
  });

  it("loads exact common local and remote branches for every repository scope", async () => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [
        repositorySummary("", "root", "main"),
        repositorySummary("services/api", "api", "main"),
        repositorySummary("docs", "docs", "release/1.0"),
      ],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    loadBranchesForRepository
      .mockResolvedValueOnce(branchList(["main", "release/1.0"], ["origin/main", "upstream/dev"]))
      .mockResolvedValueOnce(branchList(["main", "feature/api"], ["origin/main", "origin/dev"]))
      .mockResolvedValueOnce(branchList(["release/1.0", "feature/api"], ["origin/dev", "upstream/dev"]));
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    expect(await result.current.handleLoadCommonRepositoryBranches()).toEqual({
      localBranches: [
        {
          name: "feature/api",
          repositories: [
            { repositoryRoot: "services/api", displayName: "api" },
            { repositoryRoot: "docs", displayName: "docs" },
          ],
        },
        {
          name: "main",
          repositories: [
            { repositoryRoot: "", displayName: "root" },
            { repositoryRoot: "services/api", displayName: "api" },
          ],
        },
        {
          name: "release/1.0",
          repositories: [
            { repositoryRoot: "", displayName: "root" },
            { repositoryRoot: "docs", displayName: "docs" },
          ],
        },
      ],
      remoteBranches: [
        {
          name: "origin/dev",
          repositories: [
            { repositoryRoot: "services/api", displayName: "api" },
            { repositoryRoot: "docs", displayName: "docs" },
          ],
        },
        {
          name: "origin/main",
          repositories: [
            { repositoryRoot: "", displayName: "root" },
            { repositoryRoot: "services/api", displayName: "api" },
          ],
        },
        {
          name: "upstream/dev",
          repositories: [
            { repositoryRoot: "", displayName: "root" },
            { repositoryRoot: "docs", displayName: "docs" },
          ],
        },
      ],
      failedRepositories: [],
      totalRepositoryCount: 3,
    });
    expect(loadBranchesForRepository).toHaveBeenNthCalledWith(1, "");
    expect(loadBranchesForRepository).toHaveBeenNthCalledWith(2, "services/api");
    expect(loadBranchesForRepository).toHaveBeenNthCalledWith(3, "docs");
  });

  it("keeps shared branch groups when one repository cannot be read", async () => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [
        repositorySummary("", "root", "main"),
        repositorySummary("services/api", "api", "main"),
        repositorySummary("docs", "docs", "main"),
      ],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    loadBranchesForRepository
      .mockResolvedValueOnce(branchList(["main"], ["origin/main"]))
      .mockResolvedValueOnce(branchList(["main"], ["origin/main"]))
      .mockRejectedValueOnce(new Error("unavailable"));
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    expect(await result.current.handleLoadCommonRepositoryBranches()).toEqual({
      localBranches: [{
        name: "main",
        repositories: [
          { repositoryRoot: "", displayName: "root" },
          { repositoryRoot: "services/api", displayName: "api" },
        ],
      }],
      remoteBranches: [{
        name: "origin/main",
        repositories: [
          { repositoryRoot: "", displayName: "root" },
          { repositoryRoot: "services/api", displayName: "api" },
        ],
      }],
      failedRepositories: ["docs"],
      totalRepositoryCount: 3,
    });
  });

  it("checks out only eligible repositories and reports non-members as skipped", async () => {
    vi.mocked(useGitRepositories).mockReturnValue({
      repositories: [
        repositorySummary("", "root", "main"),
        repositorySummary("services/api", "api", "main"),
        repositorySummary("docs", "docs", "main"),
      ],
      isLoading: false,
      error: null,
      refreshRepositories,
    });
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    expect(await result.current.handleCheckoutAllRepositories("  release/1.0  ", ["", "docs"])).toEqual({
      successCount: 2,
      failedRepositories: [],
      skippedRepositories: ["api"],
    });
    expect(checkoutBranch).toHaveBeenNthCalledWith(1, "release/1.0", "", false);
    expect(checkoutBranch).toHaveBeenNthCalledWith(2, "release/1.0", "docs", false);
  });

  it("routes shared action errors through the global Error Toast", () => {
    const { result } = renderHook(() =>
      useAppShellGitWorkspaceOpsSection({
        activeWorkspace: workspace,
        addDebugEntry: vi.fn(),
        clearGitRootCandidates: vi.fn(),
        gitStatus: { isGitRepository: true, error: null, files: [] },
        refreshGitDiffs: vi.fn(),
        refreshGitStatus: vi.fn(),
        t: (key) => key,
        updateWorkspaceSettings: vi.fn(),
      }),
    );

    act(() => {
      result.current.alertError(new Error("git action failed"));
    });

    expect(pushErrorToast).toHaveBeenCalledWith({
      title: "errors.requestFailed",
      message: "git action failed",
    });
  });
});
