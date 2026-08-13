import { useCallback, useEffect, useRef, useState } from "react";
import { useGitBranches } from "../../features/git/hooks/useGitBranches";
import { useGitRepositories } from "../../features/git/hooks/useGitRepositories";
import { useGitActions } from "../../features/git/hooks/useGitActions";
import { pickWorkspacePath } from "../../services/tauri/filePickers";
import { useEventCallback } from "../../utils/useEventCallback";
import { resolveWorkspaceRelativePath } from "../../utils/workspacePaths";
import { pushErrorToast } from "../../services/toasts";
import { getGitBranchUpdateFeedback } from "../../features/git/utils/gitBranchUpdateFeedback";
import { buildGitBranchCoverage } from "../../features/git/utils/gitRepositoryCommonBranches";
import type {
  GitRepositoryBatchResult,
  GitRepositoryCommonBranchesResult,
} from "../../features/git/types/gitRepositoryActions";
import type {
  DebugEntry,
  WorkspaceInfo,
  WorkspaceSettings,
} from "../../types";

type GitWorkspaceOpsGitStatus = {
  isGitRepository: boolean;
  error: string | null;
  files: readonly unknown[];
};

type GitWorkspaceOpsSectionParams = {
  activeWorkspace: WorkspaceInfo | null;
  addDebugEntry: (entry: DebugEntry) => void;
  clearGitRootCandidates: () => void;
  gitStatus: GitWorkspaceOpsGitStatus;
  refreshGitDiffs: () => void;
  refreshGitStatus: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  updateWorkspaceSettings: (
    workspaceId: string,
    patch: Partial<WorkspaceSettings>,
  ) => Promise<unknown>;
};

export function useAppShellGitWorkspaceOpsSection({
  activeWorkspace,
  addDebugEntry,
  clearGitRootCandidates,
  gitStatus,
  refreshGitDiffs,
  refreshGitStatus,
  t,
  updateWorkspaceSettings,
}: GitWorkspaceOpsSectionParams) {
  const {
    repositories,
    error: repositoryError,
    isLoading: repositoriesLoading,
    refreshRepositories,
  } = useGitRepositories({
    activeWorkspace,
    onDebug: addDebugEntry,
  });
  const [selectedRepositoryRoot, setSelectedRepositoryRoot] = useState<string | null>(null);
  const updatingRepositoryBranchesRef = useRef(new Set<string>());
  const batchRepositoryActionPendingRef = useRef(false);
  const {
    branches,
    localBranches,
    remoteBranches,
    currentBranch,
    error: branchError,
    checkoutBranch,
    createBranch,
    updateBranch,
    refreshBranches,
    loadBranchesForRepository,
  } = useGitBranches({
    activeWorkspace,
    onDebug: addDebugEntry,
    repositoryRoot: selectedRepositoryRoot,
    onMutationComplete: refreshRepositories,
  });

  useEffect(() => {
    setSelectedRepositoryRoot(null);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (repositories.length === 1) {
      setSelectedRepositoryRoot(repositories[0]?.repositoryRoot ?? "");
      return;
    }
    if (
      selectedRepositoryRoot !== null &&
      !repositories.some(
        (repository) => repository.repositoryRoot === selectedRepositoryRoot,
      )
    ) {
      setSelectedRepositoryRoot(null);
    }
  }, [repositories, selectedRepositoryRoot]);

  const selectRepository = useCallback((repositoryRoot: string | null) => {
    setSelectedRepositoryRoot(repositoryRoot);
  }, []);
  const handleCheckoutBranch = useEventCallback(async (name: string) => {
    await checkoutBranch(name);
    refreshGitStatus();
  });
  const handleCreateBranch = useEventCallback(async (name: string) => {
    await createBranch(name);
    refreshGitStatus();
  });
  const handleUpdateBranch = useEventCallback(async (name: string, repositoryRootOverride?: string) => {
    const updateKey = repositoryRootOverride === undefined
      ? null
      : JSON.stringify([activeWorkspace?.id ?? null, repositoryRootOverride, name]);
    if (updateKey && updatingRepositoryBranchesRef.current.has(updateKey)) {
      return null;
    }
    if (updateKey) {
      updatingRepositoryBranchesRef.current.add(updateKey);
      pushErrorToast({
        id: updateKey,
        title: t("git.historyBranchMenuUpdate"),
        message: t("git.historyRunningOperation", {
          operation: t("git.historyBranchMenuUpdate"),
        }),
        variant: "info",
        sticky: true,
      });
    }
    try {
      const result = await updateBranch(name, repositoryRootOverride);
      refreshGitStatus();
      if (result && repositoryRootOverride !== undefined) {
        const feedback = getGitBranchUpdateFeedback(t, result, name);
        pushErrorToast({
          id: updateKey ?? undefined,
          title: t("git.historyBranchMenuUpdate"),
          message: feedback.message,
          variant: feedback.tone,
          durationMs: 4_000,
        });
      } else if (!result && updateKey) {
        pushErrorToast({
          id: updateKey,
          title: t("git.historyBranchMenuUpdate"),
          message: t("git.statusUnavailable"),
          variant: "error",
        });
      }
      return result;
    } catch (error) {
      if (repositoryRootOverride === undefined) throw error;
      pushErrorToast({
        id: updateKey ?? undefined,
        title: t("git.historyBranchMenuUpdate"),
        message: error instanceof Error ? error.message : String(error),
        variant: "error",
      });
      return null;
    } finally {
      if (updateKey) updatingRepositoryBranchesRef.current.delete(updateKey);
    }
  });
  const runRepositoryBatch = useEventCallback(async (
    operation: "update" | "checkout",
    targetBranch?: string,
    eligibleRepositoryRoots?: readonly string[],
  ): Promise<GitRepositoryBatchResult | null> => {
    if (batchRepositoryActionPendingRef.current || repositories.length <= 1) {
      return null;
    }
    batchRepositoryActionPendingRef.current = true;
    const result: GitRepositoryBatchResult = {
      successCount: 0,
      failedRepositories: [],
      skippedRepositories: [],
    };
    const eligibleRoots = eligibleRepositoryRoots
      ? new Set(eligibleRepositoryRoots)
      : null;
    const normalizedTargetBranch = targetBranch?.trim();
    try {
      for (const repository of repositories) {
        if (eligibleRoots && !eligibleRoots.has(repository.repositoryRoot)) {
          result.skippedRepositories.push(repository.displayName);
          continue;
        }
        const branchName = operation === "update"
          ? repository.currentBranch
          : normalizedTargetBranch;
        if (!branchName) {
          result.skippedRepositories.push(repository.displayName);
          continue;
        }
        try {
          if (operation === "update") {
            await updateBranch(branchName, repository.repositoryRoot, false);
          } else {
            await checkoutBranch(branchName, repository.repositoryRoot, false);
          }
          result.successCount += 1;
        } catch {
          result.failedRepositories.push(repository.displayName);
        }
      }
      await Promise.all([
        refreshBranches(),
        refreshRepositories(),
      ]);
      refreshGitStatus();
      return result;
    } finally {
      batchRepositoryActionPendingRef.current = false;
    }
  });
  const handleUpdateAllRepositories = useEventCallback(
    () => runRepositoryBatch("update"),
  );
  const handleCheckoutAllRepositories = useEventCallback(
    (branchName: string, eligibleRepositoryRoots?: readonly string[]) =>
      runRepositoryBatch("checkout", branchName, eligibleRepositoryRoots),
  );
  const handleLoadCommonRepositoryBranches = useEventCallback(async (): Promise<GitRepositoryCommonBranchesResult | null> => {
    if (repositories.length <= 1) return null;
    const loadedRepositories = await Promise.all(repositories.map(async (repository) => {
      try {
        const branchList = await loadBranchesForRepository(repository.repositoryRoot);
        return branchList?.repositoryState === "git_repository"
          ? { repository, branchList }
          : { repository, branchList: null };
      } catch {
        return { repository, branchList: null };
      }
    }));
    const failedRepositories = loadedRepositories
      .filter(({ branchList }) => branchList === null)
      .map(({ repository }) => repository.displayName);
    const branchLists = loadedRepositories.flatMap(({ repository, branchList }) =>
      branchList ? [{ repository, branchList }] : []);
    return {
      localBranches: buildGitBranchCoverage(branchLists.map(({ repository, branchList }) => ({
        repositoryRoot: repository.repositoryRoot,
        displayName: repository.displayName,
        branches: branchList.localBranches,
      }))),
      remoteBranches: buildGitBranchCoverage(branchLists.map(({ repository, branchList }) => ({
        repositoryRoot: repository.repositoryRoot,
        displayName: repository.displayName,
        branches: branchList.remoteBranches,
      }))),
      failedRepositories,
      totalRepositoryCount: repositories.length,
    };
  });
  const alertError = useCallback((error: unknown) => {
    pushErrorToast({
      title: t("errors.requestFailed"),
      message: error instanceof Error ? error.message : String(error),
    });
  }, [t]);
  const handleOpenDetachedFileExplorer = useCallback(
    async (initialFilePath?: string | null) => {
      if (!activeWorkspace) {
        return;
      }
      try {
        // Dynamic import keeps detached file explorer out of AppShell first-hop mapDeps (P0-3).
        const {
          buildDetachedFileExplorerSession,
          openOrFocusDetachedFileExplorer,
        } = await import("../../features/files/detachedFileExplorer");
        await openOrFocusDetachedFileExplorer(
          buildDetachedFileExplorerSession({
            workspaceId: activeWorkspace.id,
            workspacePath: activeWorkspace.path,
            workspaceName: activeWorkspace.name,
            gitRoot: activeWorkspace.settings.gitRoot ?? null,
            initialFilePath,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pushErrorToast({
          title: t("files.openDetachedExplorer"),
          message,
        });
      }
    },
    [activeWorkspace, t],
  );
  const {
    applyWorktreeChanges: handleApplyWorktreeChanges,
    revertAllGitChanges: handleRevertAllGitChanges,
    revertGitFile: handleRevertGitFile,
    revertGitPaths: handleRevertGitPaths,
    stageGitAll: handleStageGitAll,
    stageGitFile: handleStageGitFile,
    unstageGitAll: handleUnstageGitAll,
    unstageGitFile: handleUnstageGitFile,
    unstageGitPaths: handleUnstageGitPaths,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  } = useGitActions({
    activeWorkspace,
    onRefreshGitStatus: refreshGitStatus,
    onRefreshGitDiffs: refreshGitDiffs,
    onError: alertError,
  });
  const activeGitRoot = activeWorkspace?.settings.gitRoot ?? null;
  const handleSetGitRoot = useCallback(
    async (path: string | null) => {
      if (!activeWorkspace) {
        return;
      }
      await updateWorkspaceSettings(activeWorkspace.id, {
        gitRoot: path,
      });
      clearGitRootCandidates();
      refreshGitStatus();
    },
    [
      activeWorkspace,
      clearGitRootCandidates,
      refreshGitStatus,
      updateWorkspaceSettings,
    ],
  );
  const handlePickGitRoot = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }
    const selection = await pickWorkspacePath();
    if (!selection) {
      return;
    }
    const relativeRoot = resolveWorkspaceRelativePath(
      activeWorkspace.path,
      selection,
    );
    const nextRoot = relativeRoot === "" ? null : relativeRoot;
    await handleSetGitRoot(nextRoot);
  }, [activeWorkspace, handleSetGitRoot]);
  const fileStatus = !gitStatus.isGitRepository
    ? t("git.noRepositoriesFound")
    : gitStatus.error
      ? t("git.statusUnavailable")
      : gitStatus.files.length > 0
        ? t("git.filesChanged", { count: gitStatus.files.length })
        : t("git.workingTreeClean");

  return {
    activeGitRoot,
    alertError,
    branches,
    branchError,
    currentBranch,
    localBranches,
    remoteBranches,
    repositories,
    repositoriesLoading,
    repositoryError,
    refreshRepositories,
    selectedRepositoryRoot,
    selectRepository,
    checkoutBranch,
    createBranch,
    fileStatus,
    handleApplyWorktreeChanges,
    handleCheckoutBranch,
    handleCreateBranch,
    handleUpdateBranch,
    handleUpdateAllRepositories,
    handleCheckoutAllRepositories,
    handleLoadCommonRepositoryBranches,
    handleOpenDetachedFileExplorer,
    handlePickGitRoot,
    handleRevertAllGitChanges,
    handleRevertGitFile,
    handleRevertGitPaths,
    handleSetGitRoot,
    handleStageGitAll,
    handleStageGitFile,
    handleUnstageGitAll,
    handleUnstageGitFile,
    handleUnstageGitPaths,
    worktreeApplyError,
    worktreeApplyLoading,
    worktreeApplySuccess,
  };
}
