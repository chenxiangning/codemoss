import type { ThreadSummary } from "../../types";
import { resolveIsSharedSession } from "@mossx/plugin-shared-session/runtime";
import {
  QUICK_SWITCHER_RECENT_LIMIT,
  type QuickSwitcherSession,
  type QuickSwitcherSessionGroup,
} from "./types";

type QuickSwitcherWorkspace = { id: string; name: string };

export function projectQuickSwitcherSessionGroups(
  workspaces: QuickSwitcherWorkspace[],
  threadsByWorkspace: Record<string, ThreadSummary[]>,
): QuickSwitcherSessionGroup[] {
  const workspaceNames = new Map(
    workspaces.map((workspace) => [workspace.id, workspace.name]),
  );
  const sessions = Object.entries(threadsByWorkspace)
    .flatMap(([workspaceId, threads]) =>
      workspaceNames.has(workspaceId)
        ? threads.map((thread) => ({ workspaceId, thread }))
        : [],
    )
    .sort((left, right) => right.thread.updatedAt - left.thread.updatedAt)
    .slice(0, QUICK_SWITCHER_RECENT_LIMIT)
    .map(({ workspaceId, thread }): QuickSwitcherSession => ({
      workspaceId,
      id: thread.id,
      title: thread.name,
      updatedAt: thread.updatedAt,
      engine: thread.selectedEngine ?? thread.engineSource ?? "codex",
      // id-first：与侧栏/Topbar 一致，避免 kind 投影丢失时显示成 CLI 图标
      isShared: resolveIsSharedSession(thread.id, thread),
    }));

  const groups = new Map<string, QuickSwitcherSessionGroup>();
  for (const session of sessions) {
    const group = groups.get(session.workspaceId);
    if (group) {
      group.sessions.push(session);
      continue;
    }
    groups.set(session.workspaceId, {
      workspaceId: session.workspaceId,
      workspaceName: workspaceNames.get(session.workspaceId) ?? session.workspaceId,
      latestAt: session.updatedAt,
      sessions: [session],
    });
  }
  return [...groups.values()];
}
