import type {
  QuickSwitcherRecentFileGroup,
  QuickSwitcherSessionGroup,
} from "@mossx/plugin-quick-switcher/runtime";
import type { RecentSearchAction } from "../ranking/recentActions";
import { compareSearchResults } from "../ranking/score";
import type { SearchResult, SearchScope } from "../types";
import type { SearchActionDescriptor } from "./actionsProvider";

type RecentDiscoveryOptions = {
  actions: SearchActionDescriptor[];
  recentActions: RecentSearchAction[];
  recentFileGroups: QuickSwitcherRecentFileGroup[];
  sessionGroups: QuickSwitcherSessionGroup[];
  scope: SearchScope;
  activeWorkspaceId: string | null;
  maxResults?: number;
};

function includesWorkspace(
  workspaceId: string,
  scope: SearchScope,
  activeWorkspaceId: string | null,
): boolean {
  return scope === "global" || workspaceId === activeWorkspaceId;
}

export function projectRecentDiscoveryResults({
  actions,
  recentActions,
  recentFileGroups,
  sessionGroups,
  scope,
  activeWorkspaceId,
  maxResults = 30,
}: RecentDiscoveryOptions): SearchResult[] {
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const actionResults = recentActions.flatMap((entry) => {
    const action = actionById.get(entry.actionId);
    return action
      ? [{
          id: `action:${action.id}`,
          kind: "action" as const,
          title: action.title,
          subtitle: action.subtitle,
          score: 0,
          actionId: action.id,
          sourceKind: "actions" as const,
          updatedAt: entry.executedAt,
        }]
      : [];
  });
  const fileResults = recentFileGroups.flatMap((group) =>
    group.files
      .filter((file) => includesWorkspace(file.workspaceId, scope, activeWorkspaceId))
      .map((file): SearchResult => ({
        id: `file:${file.workspaceId}:${file.path}`,
        kind: "file",
        title: file.path.split(/[\\/]/).filter(Boolean).pop() ?? file.path,
        score: 0,
        workspaceId: file.workspaceId,
        workspaceName: group.workspaceName,
        filePath: file.path,
        sourceKind: "files",
        locationLabel: file.path,
        updatedAt: file.touchedAt,
      })),
  );
  const sessionResults = sessionGroups.flatMap((group) =>
    group.sessions
      .filter((session) => includesWorkspace(session.workspaceId, scope, activeWorkspaceId))
      .map((session): SearchResult => ({
        id: `thread:${session.workspaceId}:${session.id}`,
        kind: "thread",
        title: session.title,
        score: 0,
        workspaceId: session.workspaceId,
        workspaceName: group.workspaceName,
        threadId: session.id,
        sourceKind: "threads",
        updatedAt: session.updatedAt,
      })),
  );

  return [...actionResults, ...fileResults, ...sessionResults]
    .sort((left, right) => compareSearchResults(left, right, {}))
    .slice(0, maxResults);
}
