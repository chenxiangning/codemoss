import type {
  GitFileStatus,
  GitRepositorySummary,
  OpenAppTarget,
} from "../../../types";
import type { IntentCanvasCodeSelectionAnchor } from "@mossx/plugin-intent-canvas/runtime";
import type {
  CodeAnnotationDraftInput,
  CodeAnnotationSelection,
} from "@mossx/plugin-code-annotations/runtime";
import type { NoteCaptureDraft } from "@mossx/plugin-notes/runtime";
import type { FileHistoryTarget } from "@mossx/plugin-git-history/runtime";
import type { GitLineMarkers } from "../utils/gitLineMarkers";
import type { FileRenderPressure } from "../types/fileRenderPressure";

export const NAVIGATE_BACK_SHORTCUT = "cmd+alt+arrowleft";
export const NAVIGATE_FORWARD_SHORTCUT = "cmd+alt+arrowright";

export function resetGitLineMarkersIfNeeded(
  markers: GitLineMarkers,
): GitLineMarkers {
  return markers.added.length === 0 && markers.modified.length === 0
    ? markers
    : { added: [], modified: [] };
}

export type FileViewPanelProps = {
  workspaceId: string;
  workspaceName?: string | null;
  workspacePath: string;
  gitRoot?: string | null;
  gitRepositories?: GitRepositorySummary[];
  customSpecRoot?: string | null;
  filePath: string;
  gitStatusFiles?: GitFileStatus[];
  openTabs?: string[];
  activeTabPath?: string | null;
  onActivateTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
  onCloseOtherTabs?: (path: string) => void;
  onCloseAllTabs?: () => void;
  onReorderTabs?: (nextOrder: string[]) => void;
  fileReferenceMode?: "path" | "none";
  onFileReferenceModeChange?: (mode: "path" | "none") => void;
  activeFileLineRange?: { startLine: number; endLine: number } | null;
  onActiveFileLineRangeChange?: (
    range: { startLine: number; endLine: number } | null,
  ) => void;
  onActiveCodeAnchorChange?: (
    anchor: IntentCanvasCodeSelectionAnchor | null,
  ) => void;
  onAssociateIntentCanvasCodeAnchor?: (
    anchor: IntentCanvasCodeSelectionAnchor,
  ) => Promise<void> | void;
  initialMode?: "edit" | "preview";
  openTargets: OpenAppTarget[];
  openAppIconById: Record<string, string>;
  selectedOpenAppId: string;
  onSelectOpenAppId: (id: string) => void;
  editorSplitLayout?: "vertical" | "horizontal";
  onToggleEditorSplitLayout?: () => void;
  isEditorFileMaximized?: boolean;
  onToggleEditorFileMaximized?: () => void;
  navigationTarget?: {
    path: string;
    line: number;
    endLine?: number;
    column: number;
    scrollPosition?: "nearest" | "center";
    requestId: number;
  } | null;
  highlightMarkers?: GitLineMarkers | null;
  onNavigateToLocation?: (
    path: string,
    location: { line: number; column: number },
  ) => void;
  onOpenFileHistory?: (target: FileHistoryTarget) => void;
  onRevealInFileTree?: (path: string) => void;
  onClose: () => void;
  onInsertText?: (text: string) => void;
  onCreateCodeAnnotation?: (annotation: CodeAnnotationDraftInput) => void;
  onCaptureNote?: (draft: NoteCaptureDraft) => void;
  onRemoveCodeAnnotation?: (annotationId: string) => void;
  codeAnnotations?: CodeAnnotationSelection[];
  headerLayout?: "stacked" | "single-row";
  onSingleRowLeadingAction?: () => void;
  singleRowLeadingDirection?: "left" | "right";
  singleRowLeadingLabel?: string;
  externalChangeMonitoringEnabled?: boolean;
  externalChangeTransportMode?: "watcher" | "polling";
  externalChangePollIntervalMs?: number;
  externalChangeApplyMode?: "auto" | "manual";
  externalChangeAutoApplyDebounceMs?: number;
  markdownPreviewSnapshotMode?: "stable" | "live";
  fileRenderPressure?: FileRenderPressure;
  saveFileShortcut?: string | null;
  findInFileShortcut?: string | null;
  expandSelectionShortcut?: string | null;
  onSaveSuccess?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
};
