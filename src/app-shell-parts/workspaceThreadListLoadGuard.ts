import type { WorkspaceInfo } from "../types";

type WorkspaceThreadListLoadGuardOptions = {
  force?: boolean;
  isLoading: boolean;
  hasHydratedThreadList: boolean;
  isHydratingThreadList?: boolean;
};

export function shouldSkipWorkspaceThreadListLoad({
  force = false,
  isLoading,
  hasHydratedThreadList,
  isHydratingThreadList = false,
}: WorkspaceThreadListLoadGuardOptions): boolean {
  if (force) {
    return false;
  }
  return isLoading || isHydratingThreadList || hasHydratedThreadList;
}

type ResolveNextWorkspaceThreadListHydrationIdOptions = {
  workspaces: WorkspaceInfo[];
  activeWorkspaceProjectionOwnerIds?: readonly string[];
  hydratedWorkspaceIds: ReadonlySet<string>;
  hydratingWorkspaceIds: ReadonlySet<string>;
  loadingByWorkspace: Record<string, boolean>;
};

export function resolveNextWorkspaceThreadListHydrationId({
  workspaces,
  activeWorkspaceProjectionOwnerIds = [],
  hydratedWorkspaceIds,
  hydratingWorkspaceIds,
  loadingByWorkspace,
}: ResolveNextWorkspaceThreadListHydrationIdOptions): string | null {
  const excludedWorkspaceIds = new Set<string>(activeWorkspaceProjectionOwnerIds);

  for (const workspace of workspaces) {
    if (!workspace.connected) {
      continue;
    }
    if (excludedWorkspaceIds.has(workspace.id)) {
      continue;
    }
    if (loadingByWorkspace[workspace.id]) {
      continue;
    }
    if (hydratingWorkspaceIds.has(workspace.id)) {
      continue;
    }
    if (hydratedWorkspaceIds.has(workspace.id)) {
      continue;
    }
    return workspace.id;
  }

  return null;
}

function compareWorkspaceIdentity(
  left: WorkspaceInfo,
  right: WorkspaceInfo,
): number {
  const leftIdentity = [left.path, left.name, left.id];
  const rightIdentity = [right.path, right.name, right.id];
  for (let index = 0; index < leftIdentity.length; index += 1) {
    if (leftIdentity[index] === rightIdentity[index]) {
      continue;
    }
    return leftIdentity[index] < rightIdentity[index] ? -1 : 1;
  }
  return 0;
}

export function resolveWorkspaceProjectionOwnerIds(
  workspaces: readonly WorkspaceInfo[],
  activeWorkspaceId: string | null,
): string[] {
  if (!activeWorkspaceId) {
    return [];
  }

  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  if (!activeWorkspace || (activeWorkspace.kind ?? "main") === "worktree") {
    return [activeWorkspaceId];
  }

  const childOwnerIds = workspaces
    .filter((workspace) => workspace.parentId === activeWorkspaceId)
    .sort(compareWorkspaceIdentity)
    .map((workspace) => workspace.id);

  return [activeWorkspaceId, ...childOwnerIds];
}
