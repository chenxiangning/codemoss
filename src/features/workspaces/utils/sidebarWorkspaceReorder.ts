/**
 * Sidebar project reorder helpers (within-group only).
 * Droppable ids and pure reorder math stay free of React so unit tests and
 * handleReorderWorkspaces can share the same contract.
 */

export const SIDEBAR_WORKSPACE_DROPPABLE_PREFIX = "sidebar-workspace-group:";

export function toSidebarWorkspaceDroppableId(groupId: string | null): string {
  return `${SIDEBAR_WORKSPACE_DROPPABLE_PREFIX}${groupId ?? "ungrouped"}`;
}

/**
 * @returns `null` for ungrouped, a group id string for named groups,
 *          `undefined` when the droppable id is not a sidebar workspace list.
 */
export function parseSidebarWorkspaceDroppableId(
  droppableId: string,
): string | null | undefined {
  if (!droppableId.startsWith(SIDEBAR_WORKSPACE_DROPPABLE_PREFIX)) {
    return undefined;
  }
  const raw = droppableId.slice(SIDEBAR_WORKSPACE_DROPPABLE_PREFIX.length);
  if (raw.length === 0) {
    return undefined;
  }
  return raw === "ungrouped" ? null : raw;
}

export function applyWorkspaceReorder(params: {
  orderedIds: string[];
  sourceIndex: number;
  destinationIndex: number;
}): string[] | null {
  const { orderedIds, sourceIndex, destinationIndex } = params;
  if (
    sourceIndex === destinationIndex ||
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    sourceIndex >= orderedIds.length ||
    destinationIndex >= orderedIds.length
  ) {
    return null;
  }
  const next = orderedIds.slice();
  const [moved] = next.splice(sourceIndex, 1);
  if (!moved) {
    return null;
  }
  next.splice(destinationIndex, 0, moved);
  return next;
}

export type SidebarWorkspaceReorderRequest = {
  groupId: string | null;
  orderedWorkspaceIds: string[];
};
