import { memo } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import { DesktopLayout } from "../../layout/components/DesktopLayout";
import type {
  CenterMode,
  EditorSplitCompanion,
} from "../hooks/useGitPanelController";
type AppLayoutProps = {
  showHome: boolean;
  showKanban: boolean;
  showExtensions: boolean;
  showMarket: boolean;
  showGitHistory: boolean;
  hideRightPanel: boolean;
  isSoloMode: boolean;
  kanbanNode: ReactNode;
  extensionsNode: ReactNode;
  marketNode: ReactNode;
  gitHistoryNode: ReactNode;
  showGitDetail: boolean;
  activeTab: "projects" | "codex" | "spec" | "git" | "log";
  tabletTab: "codex" | "spec" | "git" | "log";
  centerMode: CenterMode;
  editorSplitLayout: "vertical" | "horizontal";
  editorSplitCompanion: EditorSplitCompanion;
  isEditorFileMaximized: boolean;
  hasActivePlan: boolean;
  activeWorkspace: boolean;
  activeWorkspaceId?: string | null;
  activeWorkspacePath?: string | null;
  sidebarNode: ReactNode;
  messagesNode: ReactNode;
  composerNode: ReactNode;
  approvalToastsNode: ReactNode;
  updateToastNode: ReactNode;
  errorToastsNode: ReactNode;
  globalRuntimeNoticeDockNode: ReactNode;
  homeNode: ReactNode;
  mainHeaderNode: ReactNode;
  desktopTopbarLeftNode: ReactNode;
  tabletNavNode: ReactNode;
  tabBarNode: ReactNode;
  rightPanelToolbarNode: ReactNode;
  gitDiffPanelNode: ReactNode;
  gitDiffViewerNode: ReactNode;
  fileViewPanelNode: ReactNode;
  noteCardsPanelNode: ReactNode;
  fileComparePanelNode: ReactNode;
  projectMapPanelNode: ReactNode;
  intentCanvasPanelNode: ReactNode;
  browserDockNode?: ReactNode;
  planPanelNode: ReactNode;
  runtimeConsoleDockNode: ReactNode;
  debugPanelNode: ReactNode;
  debugPanelFullNode: ReactNode;
  terminalDockNode: ReactNode;
  compactEmptyCodexNode: ReactNode;
  compactEmptySpecNode: ReactNode;
  compactEmptyGitNode: ReactNode;
  compactGitBackNode: ReactNode;
  settingsOpen: boolean;
  settingsNode: ReactNode;
  onSidebarResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onRightPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onPlanPanelResizeStart: (event: MouseEvent<HTMLDivElement>) => void;
  onGitHistoryPanelResizeStart: (event: PointerEvent<HTMLDivElement>) => void;
};

export const AppLayout = memo(function AppLayout({
  showHome,
  showKanban,
  showExtensions,
  showMarket,
  showGitHistory,
  hideRightPanel,
  isSoloMode,
  kanbanNode,
  extensionsNode,
  marketNode,
  gitHistoryNode,
  centerMode,
  editorSplitLayout,
  editorSplitCompanion,
  isEditorFileMaximized,
  hasActivePlan,
  activeWorkspace,
  activeWorkspaceId = null,
  activeWorkspacePath = null,
  sidebarNode,
  messagesNode,
  composerNode,
  approvalToastsNode,
  updateToastNode,
  errorToastsNode,
  globalRuntimeNoticeDockNode,
  homeNode,
  desktopTopbarLeftNode,
  rightPanelToolbarNode,
  gitDiffPanelNode,
  gitDiffViewerNode,
  fileViewPanelNode,
  noteCardsPanelNode,
  fileComparePanelNode,
  projectMapPanelNode,
  intentCanvasPanelNode,
  browserDockNode = null,
  planPanelNode,
  runtimeConsoleDockNode,
  debugPanelNode,
  terminalDockNode,
  settingsOpen,
  settingsNode,
  onSidebarResizeStart,
  onRightPanelResizeStart,
  onPlanPanelResizeStart,
  onGitHistoryPanelResizeStart,
}: AppLayoutProps) {
  return (
    <DesktopLayout
      sidebarNode={sidebarNode}
      updateToastNode={updateToastNode}
      approvalToastsNode={approvalToastsNode}
      errorToastsNode={errorToastsNode}
      globalRuntimeNoticeDockNode={globalRuntimeNoticeDockNode}
      homeNode={homeNode}
      showHome={showHome}
      showWorkspace={activeWorkspace && !showHome && !showKanban && !showExtensions && !showMarket}
      showKanban={showKanban}
      showExtensions={showExtensions}
      showMarket={showMarket}
      showGitHistory={showGitHistory}
      hideRightPanel={hideRightPanel}
      isSoloMode={isSoloMode}
      kanbanNode={kanbanNode}
      extensionsNode={extensionsNode}
      marketNode={marketNode}
      gitHistoryNode={gitHistoryNode}
      settingsOpen={settingsOpen}
      settingsNode={settingsNode}
      topbarLeftNode={desktopTopbarLeftNode}
      centerMode={centerMode}
      editorSplitLayout={editorSplitLayout}
      editorSplitCompanion={editorSplitCompanion}
      isEditorFileMaximized={isEditorFileMaximized}
      messagesNode={messagesNode}
      gitDiffViewerNode={gitDiffViewerNode}
      fileViewPanelNode={fileViewPanelNode}
      noteCardsPanelNode={noteCardsPanelNode}
      fileComparePanelNode={fileComparePanelNode}
      projectMapPanelNode={projectMapPanelNode}
      intentCanvasPanelNode={intentCanvasPanelNode}
      browserDockNode={browserDockNode}
      rightPanelToolbarNode={rightPanelToolbarNode}
      gitDiffPanelNode={gitDiffPanelNode}
      planPanelNode={planPanelNode}
      composerNode={composerNode}
      activeWorkspaceId={activeWorkspaceId}
      activeWorkspacePath={activeWorkspacePath}
      runtimeConsoleDockNode={runtimeConsoleDockNode}
      terminalDockNode={terminalDockNode}
      debugPanelNode={debugPanelNode}
      hasActivePlan={hasActivePlan}
      onSidebarResizeStart={onSidebarResizeStart}
      onRightPanelResizeStart={onRightPanelResizeStart}
      onPlanPanelResizeStart={onPlanPanelResizeStart}
      onGitHistoryPanelResizeStart={onGitHistoryPanelResizeStart}
    />
  );
});
