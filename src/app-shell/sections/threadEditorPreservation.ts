import type { CenterMode } from "../../features/app/hooks/useGitPanelController";

export function shouldPreserveEditorOnThreadSelect({
  isCompact,
  centerMode,
  activeWorkspaceId,
  targetWorkspaceId,
  activeEditorFilePath,
}: {
  isCompact: boolean;
  centerMode: CenterMode;
  activeWorkspaceId: string | null | undefined;
  targetWorkspaceId: string;
  activeEditorFilePath: string | null | undefined;
}) {
  return Boolean(
    !isCompact &&
      centerMode === "editor" &&
      activeEditorFilePath &&
      activeWorkspaceId === targetWorkspaceId,
  );
}

export function getThreadSelectDiffCleanupAction(preserveEditor: boolean) {
  return preserveEditor ? "clear-selected-diff" : "exit-diff-view";
}

export function shouldCollapseRightPanelOnThreadSelect({
  preserveEditor,
  requestedCollapse,
}: {
  preserveEditor: boolean;
  requestedCollapse: boolean;
}) {
  return requestedCollapse && !preserveEditor;
}
