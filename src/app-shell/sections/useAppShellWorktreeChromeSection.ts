import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { WorkspaceInfo } from "../../types";
import type { useAppShellWorkspaceFlowsSection } from "./useAppShellWorkspaceFlowsSection";

type WorkspaceFlowsSection = ReturnType<
  typeof useAppShellWorkspaceFlowsSection
>;

type WorktreeChromeTab = "projects" | "codex" | "spec" | "git" | "log";

type WorktreeChromeSectionParams = {
  activeTab: WorktreeChromeTab;
  activeWorkspace: WorkspaceInfo | null;
  confirmRenameWorktreeUpstream: WorkspaceFlowsSection["confirmRenameWorktreeUpstream"];
  handleOpenRenameWorktree: WorkspaceFlowsSection["handleOpenRenameWorktree"];
  handleRenameWorktreeCancel: WorkspaceFlowsSection["handleRenameWorktreeCancel"];
  handleRenameWorktreeChange: WorkspaceFlowsSection["handleRenameWorktreeChange"];
  handleRenameWorktreeConfirm: WorkspaceFlowsSection["handleRenameWorktreeConfirm"];
  isPhone: boolean;
  isTablet: boolean;
  renameWorktreeNotice: WorkspaceFlowsSection["renameWorktreeNotice"];
  renameWorktreePrompt: WorkspaceFlowsSection["renameWorktreePrompt"];
  renameWorktreeUpstreamPrompt: WorkspaceFlowsSection["renameWorktreeUpstreamPrompt"];
  setActiveTab: Dispatch<SetStateAction<WorktreeChromeTab>>;
  workspacesById: Map<string, WorkspaceInfo>;
};

export function useAppShellWorktreeChromeSection({
  activeTab,
  activeWorkspace,
  confirmRenameWorktreeUpstream,
  handleOpenRenameWorktree,
  handleRenameWorktreeCancel,
  handleRenameWorktreeChange,
  handleRenameWorktreeConfirm,
  isPhone,
  isTablet,
  renameWorktreeNotice,
  renameWorktreePrompt,
  renameWorktreeUpstreamPrompt,
  setActiveTab,
  workspacesById,
}: WorktreeChromeSectionParams) {
  const isWorktreeWorkspace = activeWorkspace?.kind === "worktree";
  const activeParentWorkspace = isWorktreeWorkspace
    ? (workspacesById.get(activeWorkspace?.parentId ?? "") ?? null)
    : null;
  const worktreeLabel = isWorktreeWorkspace
    ? (activeWorkspace?.worktree?.branch ?? activeWorkspace?.name ?? null)
    : null;
  const activeRenamePrompt =
    renameWorktreePrompt?.workspaceId === activeWorkspace?.id
      ? renameWorktreePrompt
      : null;
  const worktreeRename =
    isWorktreeWorkspace && activeWorkspace
      ? {
          name: activeRenamePrompt?.name ?? worktreeLabel ?? "",
          error: activeRenamePrompt?.error ?? null,
          notice: renameWorktreeNotice,
          isSubmitting: activeRenamePrompt?.isSubmitting ?? false,
          isDirty: activeRenamePrompt
            ? activeRenamePrompt.name.trim() !==
              activeRenamePrompt.originalName.trim()
            : false,
          upstream:
            renameWorktreeUpstreamPrompt?.workspaceId === activeWorkspace.id
              ? {
                  oldBranch: renameWorktreeUpstreamPrompt.oldBranch,
                  newBranch: renameWorktreeUpstreamPrompt.newBranch,
                  error: renameWorktreeUpstreamPrompt.error,
                  isSubmitting: renameWorktreeUpstreamPrompt.isSubmitting,
                  onConfirm: confirmRenameWorktreeUpstream,
                }
              : null,
          onFocus: handleOpenRenameWorktree,
          onChange: handleRenameWorktreeChange,
          onCancel: handleRenameWorktreeCancel,
          onCommit: handleRenameWorktreeConfirm,
        }
      : null;
  const baseWorkspaceRef = useRef(activeParentWorkspace ?? activeWorkspace);

  useEffect(() => {
    baseWorkspaceRef.current = activeParentWorkspace ?? activeWorkspace;
  }, [activeParentWorkspace, activeWorkspace]);

  useEffect(() => {
    if (!isPhone) {
      return;
    }
    if (!activeWorkspace && activeTab !== "projects") {
      setActiveTab("projects");
    }
  }, [activeTab, activeWorkspace, isPhone, setActiveTab]);

  useEffect(() => {
    if (!isTablet) {
      return;
    }
    if (activeTab === "projects") {
      setActiveTab("codex");
    }
  }, [activeTab, isTablet, setActiveTab]);

  return {
    activeParentWorkspace,
    activeRenamePrompt,
    baseWorkspaceRef,
    isWorktreeWorkspace,
    worktreeLabel,
    worktreeRename,
  };
}
