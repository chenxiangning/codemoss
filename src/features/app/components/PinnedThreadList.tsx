import { useMemo } from "react";
import type { MouseEvent } from "react";

import type { ThreadSummary } from "../../../types";
import type { ThreadMoveFolderTarget } from "../hooks/useSidebarMenus";
import type { ThreadStatusMap } from "./threadRowStatusStore";
import { ThreadList } from "./ThreadList";

type PinnedThreadRow = {
  thread: ThreadSummary;
  depth: number;
  hasChildren?: boolean;
  workspaceId: string;
  workspacePath: string;
};

type PinnedThreadRowGroup = {
  key: string;
  workspaceId: string;
  workspacePath: string;
  rootCount: number;
  rows: Array<{
    thread: ThreadSummary;
    depth: number;
    hasChildren?: boolean;
  }>;
};

type PinnedThreadListProps = {
  rows: PinnedThreadRow[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  systemProxyEnabled?: boolean;
  systemProxyUrl?: string | null;
  showProviderLabels?: boolean;
  threadStatusById: ThreadStatusMap;
  moveFolderTargetsByWorkspaceId?: Record<string, ThreadMoveFolderTarget[]>;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  isThreadAutoNaming: (workspaceId: string, threadId: string) => boolean;
  onToggleThreadPin?: (workspaceId: string, threadId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
    sizeBytes?: number,
    moveFolderTargets?: ThreadMoveFolderTarget[],
    currentFolderId?: string | null,
    canArchive?: boolean,
    workspacePath?: string,
  ) => void;
  deleteConfirmThreadId?: string | null;
  deleteConfirmWorkspaceId?: string | null;
  deleteConfirmBusy?: boolean;
  onCancelDeleteConfirm?: () => void;
  onConfirmDeleteConfirm?: () => void;
  renameThreadId?: string | null;
  renameWorkspaceId?: string | null;
  renameName?: string;
  onRenameChange?: (value: string) => void;
  onRenameCancel?: () => void;
  onRenameConfirm?: () => void;
  onPinnedThreadRowRender?: (threadId: string) => void;
};

function groupPinnedThreadRows(rows: PinnedThreadRow[]): PinnedThreadRowGroup[] {
  const groups: PinnedThreadRowGroup[] = [];
  let current: PinnedThreadRowGroup | null = null;

  rows.forEach((row) => {
    if (
      !current ||
      current.workspaceId !== row.workspaceId ||
      current.workspacePath !== row.workspacePath
    ) {
      current = {
        key: `${row.workspaceId}:${row.thread.id}`,
        workspaceId: row.workspaceId,
        workspacePath: row.workspacePath,
        rootCount: 0,
        rows: [],
      };
      groups.push(current);
    }
    if (row.depth === 0) {
      current.rootCount += 1;
    }
    current.rows.push({
      thread: row.thread,
      depth: row.depth,
      hasChildren: row.hasChildren,
    });
  });

  return groups;
}

export function PinnedThreadList({
  rows,
  activeWorkspaceId,
  activeThreadId,
  systemProxyEnabled = false,
  systemProxyUrl = null,
  showProviderLabels = false,
  threadStatusById,
  moveFolderTargetsByWorkspaceId = {},
  getThreadTime,
  isThreadPinned,
  isThreadAutoNaming,
  onToggleThreadPin,
  onSelectThread,
  onShowThreadMenu,
  deleteConfirmThreadId = null,
  deleteConfirmWorkspaceId = null,
  deleteConfirmBusy = false,
  onCancelDeleteConfirm,
  onConfirmDeleteConfirm,
  renameThreadId = null,
  renameWorkspaceId = null,
  renameName = "",
  onRenameChange,
  onRenameCancel,
  onRenameConfirm,
  onPinnedThreadRowRender,
}: PinnedThreadListProps) {
  const groups = useMemo(() => groupPinnedThreadRows(rows), [rows]);

  return (
    <>
      {groups.map((group) => (
        <ThreadList
          key={group.key}
          workspaceId={group.workspaceId}
          workspacePath={group.workspacePath}
          pinnedRows={group.rows}
          unpinnedRows={[]}
          totalThreadRoots={group.rootCount}
          visibleThreadRootCount={group.rootCount}
          isExpanded
          nextCursor={null}
          isPaging={false}
          showLoadOlder={false}
          listClassName="pinned-thread-list"
          moveFolderTargets={moveFolderTargetsByWorkspaceId[group.workspaceId]}
          activeWorkspaceId={activeWorkspaceId}
          activeThreadId={activeThreadId}
          systemProxyEnabled={systemProxyEnabled}
          systemProxyUrl={systemProxyUrl}
          showProviderLabels={showProviderLabels}
          threadStatusById={threadStatusById}
          getThreadTime={getThreadTime}
          isThreadPinned={isThreadPinned}
          isThreadAutoNaming={isThreadAutoNaming}
          onToggleThreadPin={onToggleThreadPin}
          onToggleExpanded={() => undefined}
          onLoadOlderThreads={() => undefined}
          onSelectThread={onSelectThread}
          onShowThreadMenu={onShowThreadMenu}
          deleteConfirmThreadId={deleteConfirmThreadId}
          deleteConfirmWorkspaceId={deleteConfirmWorkspaceId}
          deleteConfirmBusy={deleteConfirmBusy}
          onCancelDeleteConfirm={onCancelDeleteConfirm}
          onConfirmDeleteConfirm={onConfirmDeleteConfirm}
          renameThreadId={renameThreadId}
          renameWorkspaceId={renameWorkspaceId}
          renameName={renameName}
          onRenameChange={onRenameChange}
          onRenameCancel={onRenameCancel}
          onRenameConfirm={onRenameConfirm}
          onThreadRowRender={onPinnedThreadRowRender}
        />
      ))}
    </>
  );
}
