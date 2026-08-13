import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";
import {
  scheduleWhenInteractiveQuiet,
  ensureInteractiveInputHooks,
} from "../../../utils/interactiveMainThread";

// Align with useWorkspaceThreadListHydration cold schedule (test mode = 0).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_VITEST =
  typeof import.meta !== "undefined" && (import.meta as any).env?.MODE === "test";

const RESTORE_MIN_DELAY_MS = IS_VITEST ? 0 : 1_500;
const RESTORE_QUIET_MS = IS_VITEST ? 0 : 1_000;
const RESTORE_MAX_WAIT_MS = IS_VITEST ? 0 : 15_000;

type WorkspaceRestoreOptions = {
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  activeWorkspaceId: string | null;
  restoreThreadsOnlyOnLaunch: boolean;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: {
      preserveState?: boolean;
      includeOpenCodeSessions?: boolean;
      recoverySource?: "workspace-restore";
      allowRuntimeReconnect?: boolean;
      startupHydrationMode?: "full-catalog" | "first-paint";
    },
  ) => Promise<unknown>;
};

/**
 * Launch restore of the active workspace thread list.
 *
 * MUST NOT fire list IPC in the same tick as shell bind / Cmd+R reload.
 * Field: immediate restore + auto first-paint dual-fired list and froze on
 * rapid click. Quiet-gated schedule matches hydration cold path.
 */
export function useWorkspaceRestore({
  workspaces,
  hasLoaded,
  activeWorkspaceId,
  restoreThreadsOnlyOnLaunch,
  listThreadsForWorkspace,
}: WorkspaceRestoreOptions) {
  const restoredWorkspaces = useRef(new Set<string>());
  const restoringWorkspaces = useRef(new Set<string>());

  useEffect(() => {
    ensureInteractiveInputHooks();
    if (!hasLoaded) {
      return;
    }
    // Cold-start: only restore the active workspace thread list.
    // Expanding every non-collapsed workspace here dual-scanned first-paint
    // (mossx + 内容分析) and blocked the active path for multi-seconds.
    // Non-active workspaces hydrate after startup-gate via idle prewarm / focus.
    const pending = workspaces.filter((workspace) => {
      if (restoredWorkspaces.current.has(workspace.id)) {
        return false;
      }
      if (restoringWorkspaces.current.has(workspace.id)) {
        return false;
      }
      if (!activeWorkspaceId) {
        return false;
      }
      return workspace.id === activeWorkspaceId;
    });
    if (pending.length === 0) {
      return;
    }

    let cancelled = false;
    const active = pending.find((w) => w.id === activeWorkspaceId);
    const rest = pending.filter((w) => w.id !== activeWorkspaceId);

    const restoreOne = async (workspace: WorkspaceInfo) => {
      if (cancelled) {
        return;
      }
      restoringWorkspaces.current.add(workspace.id);
      try {
        await listThreadsForWorkspace(workspace, {
          recoverySource: "workspace-restore",
          allowRuntimeReconnect: !restoreThreadsOnlyOnLaunch,
          // Bound load: same first-paint contract as cold hydration.
          startupHydrationMode: "first-paint",
          preserveState: true,
        });
        // A rerender may cancel the current effect while the in-flight restore
        // still succeeds. Keep the success marker so we do not restart the same
        // workspace restore loop on every workspace refresh.
        restoredWorkspaces.current.add(workspace.id);
      } finally {
        restoringWorkspaces.current.delete(workspace.id);
      }
    };

    const runRestore = () => {
      if (cancelled) {
        return;
      }
      void (async () => {
        if (active) {
          await restoreOne(active).catch(() => {
            // Silent: connection errors show in debug panel.
          });
        }
        if (cancelled) {
          return;
        }
        await Promise.allSettled(
          rest.map((workspace) =>
            restoreOne(workspace).catch(() => {
              // Silent: connection errors show in debug panel.
            }),
          ),
        );
      })();
    };

    // Critical: do not list on the same tick as reload / first paint of shell.
    const disposeSchedule = scheduleWhenInteractiveQuiet(runRestore, {
      minDelayMs: RESTORE_MIN_DELAY_MS,
      quietMs: RESTORE_QUIET_MS,
      maxWaitMs: RESTORE_MAX_WAIT_MS,
    });

    return () => {
      cancelled = true;
      disposeSchedule();
    };
  }, [
    activeWorkspaceId,
    hasLoaded,
    listThreadsForWorkspace,
    restoreThreadsOnlyOnLaunch,
    workspaces,
  ]);
}
