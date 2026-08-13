import { useCallback } from "react";
import { useOpenPaths } from "../../features/workspaces/hooks/useOpenPaths";
import { useWorkspaceDropZone } from "../../features/workspaces/hooks/useWorkspaceDropZone";

type WorkspacePathsIntakeParams = {
  handleAddWorkspaceFromPath: (path: string) => Promise<void>;
};

export function useWorkspacePathsIntake({
  handleAddWorkspaceFromPath,
}: WorkspacePathsIntakeParams) {
  const handleDropWorkspacePaths = useCallback(
    async (paths: string[]) => {
      const uniquePaths = Array.from(
        new Set(paths.filter((path) => path.length > 0)),
      );
      if (uniquePaths.length === 0) {
        return;
      }
      uniquePaths.forEach((path) => {
        void handleAddWorkspaceFromPath(path);
      });
    },
    [handleAddWorkspaceFromPath],
  );

  useOpenPaths({
    onOpenPaths: handleDropWorkspacePaths,
  });

  const {
    dropTargetRef: workspaceDropTargetRef,
    isDragOver: isWorkspaceDropActive,
    handleDragOver: handleWorkspaceDragOver,
    handleDragEnter: handleWorkspaceDragEnter,
    handleDragLeave: handleWorkspaceDragLeave,
    handleDrop: handleWorkspaceDrop,
  } = useWorkspaceDropZone({
    onDropPaths: handleDropWorkspacePaths,
  });

  return {
    handleDropWorkspacePaths,
    handleWorkspaceDragEnter,
    handleWorkspaceDragLeave,
    handleWorkspaceDragOver,
    handleWorkspaceDrop,
    isWorkspaceDropActive,
    workspaceDropTargetRef,
  };
}
