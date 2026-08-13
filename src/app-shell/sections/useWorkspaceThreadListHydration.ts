import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRenderScheduler } from "../../hooks/useRenderScheduler";
import type { MutableRefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import type { WorkspaceInfo } from "../../types";
import {
  startupOrchestrator,
  type StartupTaskDescriptor,
} from "../../features/startup-orchestration/utils/startupOrchestrator";
import {
  getStartupTraceSnapshot,
  recordStartupMilestone,
  type StartupMilestoneName,
} from "../../features/startup-orchestration/utils/startupTrace";
import {
  isStartupForceEntered,
  registerStartupIdleHydrationCancel,
  subscribeStartupForceEnter,
} from "../../features/startup-orchestration/utils/startupForceEnter";
import {
  clearFullCatalogAutoRetryCooldown,
  isFullCatalogAutoRetryBlocked,
  markFullCatalogAutoRetryCooldown,
} from "../../features/startup-orchestration/utils/fullCatalogAutoRetry";
import {
  clearFullCatalogFresh,
  isFullCatalogFresh,
  markFullCatalogFresh,
} from "../../features/startup-orchestration/utils/fullCatalogFreshness";
import { stampStartupGateReady } from "../../features/startup-orchestration/utils/startupGateReady";
import { shouldSkipWorkspaceThreadListLoad } from "./workspaceThreadListLoadGuard";
import {
  ensureInteractiveInputHooks,
  hadRecentInteractiveInput,
  scheduleWhenInteractiveQuiet,
} from "../../utils/interactiveMainThread";

function hasStartupGateReady(): boolean {
  return Boolean(getStartupTraceSnapshot().milestones["startup-gate-ready"]);
}

/**
 * Cold-start list guard until gate-ready / force-enter:
 * - only the current active workspace may hydrate (first-paint or full)
 * - no active yet → block all (wait for active assignment)
 * After active first-paint, a quiet idle full-catalog is scheduled once so the
 * sidebar converges beyond snapshot / Codex-only first-paint (multi-engine).
 * Background workspaces stay cold until explicit expand / Session Management.
 */
function isColdStartListGuardActive(): boolean {
  return !hasStartupGateReady() && !isStartupForceEntered();
}

function shouldSkipWorkspaceDuringColdStart(
  workspaceId: string,
  activeWorkspaceId: string | null,
): boolean {
  if (!isColdStartListGuardActive()) {
    return false;
  }
  // Home has no active-list cold-start owner. Explicit on-demand/session-radar
  // requests remain allowed; background auto full-catalog is still gated.
  if (!activeWorkspaceId) {
    return false;
  }
  return workspaceId !== activeWorkspaceId;
}

type ListThreadsForWorkspace = (
  workspace: WorkspaceInfo,
  options?: {
    preserveState?: boolean;
    includeOpenCodeSessions?: boolean;
    deletedThreadIds?: string[];
    startupHydrationMode?: "full-catalog" | "first-paint";
    allowRuntimeReconnect?: boolean;
    /**
     * Soft recovery callers (focus-refresh) must not re-run multi-engine
     * full-catalog while the catalog is still fresh after a successful settle.
     */
    recoverySource?: string;
    /** Quiet post-first-paint index re-scan (writers), not cold first paint. */
    forceSessionIndexSync?: boolean;
    /** Expand/reload: allow Claude/Gemini/Grok/Kimi/OpenCode disk lists. */
    includeEngineDiskLists?: boolean;
    /** When true mid-flight, list apply must no-op (workspace cancelled/switched). */
    isStale?: () => boolean;
  },
) => Promise<void | { applied?: boolean; stale?: boolean }>;

type UseWorkspaceThreadListHydrationOptions = {
  activeWorkspaceId: string | null;
  activeWorkspaceProjectionOwnerIds: readonly string[];
  listThreadsForWorkspace: ListThreadsForWorkspace;
  threadListLoadingByWorkspace: Record<string, boolean>;
  workspaces: WorkspaceInfo[];
  workspacesById: Map<string, WorkspaceInfo>;
};

type UseWorkspaceThreadListHydrationResult = {
  ensureWorkspaceThreadListLoaded: (
    workspaceId: string,
    options?: {
      preserveState?: boolean;
      force?: boolean;
      deletedThreadIds?: string[];
    },
  ) => void;
  /** Immutable snapshot identity for UI (memo-safe). Prefer this over the ref for render props. */
  hydratedThreadListWorkspaceIds: ReadonlySet<string>;
  hydratedThreadListWorkspaceIdsRef: MutableRefObject<Set<string>>;
  listThreadsForWorkspaceTracked: ListThreadsForWorkspace;
  prewarmSessionRadarForWorkspace: (workspaceId: string) => void;
};

type ThreadHydrationPhase = "active-workspace" | "idle-prewarm" | "on-demand";
type ThreadHydrationKind = "full-catalog" | "session-radar" | "first-paint";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_VITEST =
  typeof import.meta !== "undefined" && (import.meta as any).env?.MODE === "test";

/**
 * Cold-start / first bind / Cmd+R: do not start first-paint until the user has
 * been quiet. Rapid click after reload freezes WebView when list IPC + setThreads
 * overlap hit-test (field repro).
 * @internal exported for tests
 */
/**
 * Cold start used to wait 1.5s before any list work so clicks wouldn't race
 * setThreads. That left stale sidebarSnapshot visible far too long.
 * Session Index early-paint is cheap; start almost immediately when we already
 * have a cached list that needs correcting.
 */
export const COLD_START_IDLE_MIN_DELAY_MS = IS_VITEST ? 0 : 120;
/** Must stay quiet this long before auto first-paint may start. */
export const COLD_START_INPUT_QUIET_MS = IS_VITEST ? 0 : 80;
/** Absolute ceiling so list still converges if the user never stops clicking. */
export const COLD_START_IDLE_TIMEOUT_MS = IS_VITEST ? 0 : 15_000;
/**
 * User switched workspace (A→B): short intent delay, still quiet-gated slightly.
 * @internal exported for tests
 */
export const WORKSPACE_SWITCH_INTENT_DELAY_MS = IS_VITEST ? 0 : 100;
export const WORKSPACE_SWITCH_INPUT_QUIET_MS = IS_VITEST ? 0 : 300;

/**
 * After active first-paint: quiet-gated multi-engine full-catalog so sidebar
 * leaves stale snapshot / Codex-only rows without competing with first clicks.
 * @internal exported for tests
 */
export const POST_FIRST_PAINT_FULL_CATALOG_MIN_DELAY_MS = IS_VITEST ? 0 : 160;
export const POST_FIRST_PAINT_FULL_CATALOG_QUIET_MS = IS_VITEST ? 0 : 600;
export const POST_FIRST_PAINT_FULL_CATALOG_MAX_WAIT_MS = IS_VITEST ? 0 : 8_000;

/** @deprecated Prefer COLD_START_IDLE_* / WORKSPACE_SWITCH_INTENT_DELAY_MS */
export const COLD_START_FIRST_PAINT_DELAY_MS = COLD_START_IDLE_MIN_DELAY_MS;

function isDiscardedStaleHydrationResult(
  result: ThreadListHydrationResult,
): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    result.applied === false &&
    result.stale === true
  );
}

function isTimeoutHydrationResult(result: ThreadListHydrationResult): boolean {
  return (
    typeof result === "object" &&
    result !== null &&
    "timeout" in result &&
    (result as { timeout?: boolean }).timeout === true
  );
}

function hasRecordedActiveWorkspaceReady() {
  return Boolean(
    getStartupTraceSnapshot().milestones[ACTIVE_WORKSPACE_READY_MILESTONE],
  );
}

function createThreadHydrationTask(
  workspace: WorkspaceInfo,
  phase: ThreadHydrationPhase,
  kind: ThreadHydrationKind,
  run: (
    context: Parameters<
      StartupTaskDescriptor<ThreadListHydrationResult>["run"]
    >[0],
  ) => Promise<ThreadListHydrationResult>,
): StartupTaskDescriptor<ThreadListHydrationResult> {
  const dedupeKey = `thread-list:${kind}:${workspace.id}`;
  return {
    id: `thread-list:${kind}:${workspace.id}`,
    phase,
    priority:
      kind === "first-paint"
        ? 95
        : phase === "active-workspace"
          ? 90
          : phase === "on-demand"
            ? 85
            : kind === "session-radar"
              ? 30
              : 20,
    dedupeKey,
    concurrencyKey: "thread-session-scan",
    timeoutMs:
      kind === "first-paint"
        ? 8_000
        : phase === "active-workspace"
          ? 12_000
          : 20_000,
    workspaceScope: { workspaceId: workspace.id },
    // soft-ignore: timeout/cancel settle UI without hard-aborting native IPC,
    // but run() + list apply must honor isStale so late setThreads do not
    // storm the main thread after the user already moved on.
    cancelPolicy: "soft-ignore",
    traceLabel:
      kind === "session-radar"
        ? "session-radar workspace prewarm"
        : kind === "first-paint"
          ? "thread/list first-paint hydration"
          : `thread/list ${kind} hydration`,
    commandLabel: "list_threads",
    run,
    fallback: (reason) => {
      // cancelAllTasks / cancelWorkspaceTasks / abort: all must look "stale"
      // so finally skips publish-hydrate + full-catalog re-schedule.
      if (reason === "stale" || reason === "cancelled") {
        return { applied: false, stale: true };
      }
      // timeout/failure: distinguish from successful void so cooldown can apply
      // without treating every successful list (void) as timeout.
      if (reason === "timeout") {
        return { applied: false, stale: false, timeout: true };
      }
      return { applied: false, stale: false, timeout: false };
    },
  };
}

function publishHydrationUiState(
  setHydrated: (next: Set<string>) => void,
  nextHydrated: Set<string>,
): void {
  // Background lane — clicks stay urgent.
  startTransition(() => {
    setHydrated(nextHydrated);
  });
}

type ThreadListHydrationResult = void | {
  applied?: boolean;
  stale?: boolean;
  timeout?: boolean;
};
const ACTIVE_WORKSPACE_READY_MILESTONE: StartupMilestoneName =
  "active-workspace-ready";
const IDLE_PREWARM_DELAY_MS = 120;

/**
 * Publish a new Set identity so memo(Sidebar) can see hydration progress.
 * Mutating a shared Set in place is not enough:
 * layout passes the same Set reference into a memoized Sidebar and the
 * "加载中…" placeholder never leaves even after orchestrator timeout.
 */
function publishHydratedWorkspaceId(
  targetRef: MutableRefObject<Set<string>>,
  workspaceId: string,
): Set<string> {
  if (targetRef.current.has(workspaceId)) {
    return targetRef.current;
  }
  const next = new Set(targetRef.current);
  next.add(workspaceId);
  targetRef.current = next;
  return next;
}

export function useWorkspaceThreadListHydration({
  activeWorkspaceId,
  activeWorkspaceProjectionOwnerIds,
  listThreadsForWorkspace,
  threadListLoadingByWorkspace,
  workspaces,
  workspacesById,
}: UseWorkspaceThreadListHydrationOptions): UseWorkspaceThreadListHydrationResult {
  const hydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const fullyHydratedThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydratingThreadListWorkspaceIdsRef = useRef(new Set<string>());
  const hydrationPhaseByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationPhase>(),
  );
  const hydrationKindByWorkspaceIdRef = useRef(
    new Map<string, ThreadHydrationKind>(),
  );
  const autoHydratedActiveWorkspaceIdRef = useRef<string | null>(null);
  const previousActiveWorkspaceIdRef = useRef<string | null>(null);
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  /** Pending cold-idle or intent-timer for auto first-paint (not session-radar). */
  const pendingAutoFirstPaintCleanupRef = useRef<(() => void) | null>(null);
  /** Re-arm quiet first-paint after pointer soft-cancel during cold window. */
  const rescheduleAutoFirstPaintRef = useRef<(() => void) | null>(null);
  const ensureWorkspaceThreadListLoadedRef = useRef<
    | ((
        workspaceId: string,
        options?: {
          preserveState?: boolean;
          force?: boolean;
          deletedThreadIds?: string[];
        },
      ) => void)
    | null
  >(null);
  /** Quiet Index forceSync after each workspace first-paint (not exclusive). */
  const pendingIndexSyncCleanupByWorkspaceIdRef = useRef(
    new Map<string, () => void>(),
  );
  /** Workspaces that already had a post-first-paint index sync scheduled. */
  const postFirstPaintFullCatalogArmedIdsRef = useRef(new Set<string>());
  const idleHydrationCleanupByWorkspaceIdRef = useRef(
    new Map<string, () => void>(),
  );
  // State carries the published Set identity for consumers (Sidebar via layout).
  // Ref stays the sync source of truth for in-flight guards.
  const [hydratedThreadListWorkspaceIds, setHydratedThreadListWorkspaceIds] =
    useState<ReadonlySet<string>>(
      () => hydratedThreadListWorkspaceIdsRef.current,
    );
  const renderScheduler = useRenderScheduler({
    budgetMs: 0,
    idleTimeoutMs: IDLE_PREWARM_DELAY_MS,
  });
  const scheduleIdleHydration = useCallback(
    (callback: () => void): (() => void) => {
      let cancelled = false;
      renderScheduler.scheduleChunk(() => {
        if (cancelled) {
          return false;
        }
        callback();
        return false;
      });
      return () => {
        cancelled = true;
      };
    },
    [renderScheduler],
  );

  const cancelPendingIndexSync = useCallback((workspaceId?: string) => {
    if (workspaceId) {
      pendingIndexSyncCleanupByWorkspaceIdRef.current.get(workspaceId)?.();
      pendingIndexSyncCleanupByWorkspaceIdRef.current.delete(workspaceId);
      return;
    }
    pendingIndexSyncCleanupByWorkspaceIdRef.current.forEach((cleanup) => cleanup());
    pendingIndexSyncCleanupByWorkspaceIdRef.current.clear();
  }, []);

  /**
   * Quiet soft re-sync of Session Index after first-paint (NOT exhaustive
   * full-catalog). Picks up CLI-created sessions for Gemini/Grok/OpenCode
   * without multi-GB inventory. Force refresh still uses full-catalog.
   */
  const schedulePostFirstPaintFullCatalog = useCallback(
    (workspaceId: string, options?: { allowRepeat?: boolean }) => {
      const id = workspaceId.trim();
      if (!id) {
        return;
      }
      if (
        !options?.allowRepeat &&
        postFirstPaintFullCatalogArmedIdsRef.current.has(id)
      ) {
        return;
      }

      pendingIndexSyncCleanupByWorkspaceIdRef.current.get(id)?.();
      postFirstPaintFullCatalogArmedIdsRef.current.add(id);

      let unregisterForceCancel: (() => void) | null = null;
      const detachSchedule = () => {
        unregisterForceCancel?.();
        unregisterForceCancel = null;
        pendingIndexSyncCleanupByWorkspaceIdRef.current.delete(id);
      };

      const runIndexSoftRefresh = () => {
        detachSchedule();
        // Sidebar list is SQLite-only. Do not kick a disk writer pass after
        // first-paint; that second setThreads was wiping engines (Claude).
      };

      const quietCleanup = scheduleWhenInteractiveQuiet(runIndexSoftRefresh, {
        quietMs: POST_FIRST_PAINT_FULL_CATALOG_QUIET_MS,
        minDelayMs: POST_FIRST_PAINT_FULL_CATALOG_MIN_DELAY_MS,
        maxWaitMs: POST_FIRST_PAINT_FULL_CATALOG_MAX_WAIT_MS,
      });
      unregisterForceCancel = registerStartupIdleHydrationCancel(() => {
        quietCleanup();
        detachSchedule();
      });
      const combinedCleanup = () => {
        quietCleanup();
        detachSchedule();
      };
      pendingIndexSyncCleanupByWorkspaceIdRef.current.set(id, combinedCleanup);
    },
    [listThreadsForWorkspace, workspacesById],
  );

  const listThreadsForWorkspaceTracked = useCallback<ListThreadsForWorkspace>(
    async (workspace, options) => {
      // Cold-start: restore/focus/reload must not dual-scan non-active workspaces
      // (dump: two workspaces first-painted on-demand together at t≈1.7s).
      if (
        options?.startupHydrationMode === "full-catalog" &&
        shouldSkipWorkspaceDuringColdStart(
          workspace.id,
          activeWorkspaceIdRef.current,
        )
      ) {
        return { applied: false, stale: true };
      }

      // Default path for direct callers (reload / rename): never assume full-catalog
      // on a never-hydrated workspace — that was the cold-start "no first-paint" bug.
      const uiAlreadyHydrated = hydratedThreadListWorkspaceIdsRef.current.has(
        workspace.id,
      );
      const fullyHydrated = fullyHydratedThreadListWorkspaceIdsRef.current.has(
        workspace.id,
      );
      let kind: ThreadHydrationKind =
        hydrationKindByWorkspaceIdRef.current.get(workspace.id) ??
        (uiAlreadyHydrated ? "full-catalog" : "first-paint");

      // Focus-refresh historically forced full-catalog ~30s after first settle
      // (cold-start dump: second opencode_session_list + list_claude_sessions).
      // While full-catalog is still fresh, skip the multi-engine fan-out entirely.
      if (
        options?.recoverySource === "focus-refresh" &&
        fullyHydrated &&
        isFullCatalogFresh(workspace.id) &&
        options?.startupHydrationMode !== "first-paint"
      ) {
        return { applied: false, stale: false };
      }

      // Explicit first-paint from restore / soft paths wins over default full-catalog.
      if (options?.startupHydrationMode === "first-paint") {
        kind = "first-paint";
      } else if (options?.startupHydrationMode === "full-catalog") {
        kind = "full-catalog";
      }

      const phase: ThreadHydrationPhase =
        hydrationPhaseByWorkspaceIdRef.current.get(workspace.id) ??
        (workspace.id === activeWorkspaceIdRef.current
          ? "active-workspace"
          : "on-demand");

      hydratingThreadListWorkspaceIdsRef.current.add(workspace.id);
      // Keep maps aligned for concurrent ensure/skip guards.
      hydrationKindByWorkspaceIdRef.current.set(workspace.id, kind);
      hydrationPhaseByWorkspaceIdRef.current.set(workspace.id, phase);

      let hydrationResult: ThreadListHydrationResult = undefined;
      const finishedKind = kind;
      try {
        const mode = kind === "first-paint" ? "first-paint" : "full-catalog";
        hydrationResult = await startupOrchestrator.run(
          createThreadHydrationTask(workspace, phase, kind, async (context) => {
            if (context.isStale()) {
              return { applied: false, stale: true };
            }
            return listThreadsForWorkspace(workspace, {
              ...options,
              startupHydrationMode: mode,
              allowRuntimeReconnect: false,
              isStale: context.isStale,
            });
          }),
        );
      } finally {
        const discardedAsStale =
          isDiscardedStaleHydrationResult(hydrationResult);
        const settledAsTimeout =
          !discardedAsStale && isTimeoutHydrationResult(hydrationResult);
        const isStillActive = workspace.id === activeWorkspaceIdRef.current;

        if (
          !discardedAsStale &&
          isStillActive &&
          (phase === "active-workspace" || finishedKind === "first-paint") &&
          !hasRecordedActiveWorkspaceReady()
        ) {
          // Only the active workspace first-paint/list marks this notice milestone.
          recordStartupMilestone(ACTIVE_WORKSPACE_READY_MILESTONE);
        }
        hydratingThreadListWorkspaceIdsRef.current.delete(workspace.id);
        hydrationPhaseByWorkspaceIdRef.current.delete(workspace.id);
        hydrationKindByWorkspaceIdRef.current.delete(workspace.id);
        if (!discardedAsStale) {
          const nextHydrated = publishHydratedWorkspaceId(
            hydratedThreadListWorkspaceIdsRef,
            workspace.id,
          );
          if (finishedKind !== "first-paint") {
            // Mark full attempted so sidebar drops loading; cooldown on timeout.
            publishHydratedWorkspaceId(
              fullyHydratedThreadListWorkspaceIdsRef,
              workspace.id,
            );
            if (settledAsTimeout) {
              markFullCatalogAutoRetryCooldown(workspace.id, "timeout");
              clearFullCatalogFresh(workspace.id);
            } else {
              // Successful multi-engine settle — block soft re-scans (focus-refresh).
              markFullCatalogFresh(workspace.id);
            }
            // MUST NOT stamp startup-gate-ready from full-catalog settle.
          } else {
            if (isStillActive) {
              // Only active first-paint opens the click gate (not a side workspace).
              stampStartupGateReady("first-paint-complete");
            }
            // Every first-painted workspace gets one Index forceSync. Warm
            // SQLite can return a partial engine set; other projects used to
            // stay incomplete after the user left the first active workspace.
            publishHydratedWorkspaceId(
              fullyHydratedThreadListWorkspaceIdsRef,
              workspace.id,
            );
            markFullCatalogFresh(workspace.id);
            schedulePostFirstPaintFullCatalog(workspace.id);
          }
          publishHydrationUiState(
            setHydratedThreadListWorkspaceIds,
            nextHydrated,
          );
        } else {
          // Stale discard: re-ensure first-paint only for the still-active owner.
          if (finishedKind === "first-paint") {
            autoHydratedActiveWorkspaceIdRef.current = null;
            Promise.resolve().then(() => {
              // Do not re-ensure a workspace the user already left.
              if (activeWorkspaceIdRef.current !== workspace.id) {
                return;
              }
              ensureWorkspaceThreadListLoadedRef.current?.(workspace.id, {
                preserveState: true,
              });
            });
          }
        }
      }
    },
    [listThreadsForWorkspace, schedulePostFirstPaintFullCatalog],
  );

  const ensureWorkspaceThreadListLoaded = useCallback(
    (
      workspaceId: string,
      options?: {
        preserveState?: boolean;
        force?: boolean;
        deletedThreadIds?: string[];
        startupHydrationMode?: "first-paint" | "full-catalog";
      },
    ) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      const force = options?.force ?? false;
      const isLoading = threadListLoadingByWorkspace[workspaceId] ?? false;
      const uiHydrated =
        hydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      const fullyHydrated =
        fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId);
      const kind: ThreadHydrationKind =
        options?.startupHydrationMode ??
        (force ? "full-catalog" : !uiHydrated ? "first-paint" : "full-catalog");
      // Cold-start: only active workspace may hydrate until gate-ready.
      // User force refresh may target any workspace after gate; during cold-start
      // force still restricted to active to avoid dual-scan storms.
      if (
        !force &&
        kind !== "first-paint" &&
        shouldSkipWorkspaceDuringColdStart(workspaceId, activeWorkspaceId)
      ) {
        return;
      }
      if (
        force &&
        isColdStartListGuardActive() &&
        workspaceId !== activeWorkspaceId
      ) {
        return;
      }
      if (
        kind === "full-catalog" &&
        !force &&
        (isFullCatalogAutoRetryBlocked(workspaceId) || isStartupForceEntered())
      ) {
        return;
      }
      if (force && kind === "full-catalog") {
        clearFullCatalogAutoRetryCooldown(workspaceId);
        clearFullCatalogFresh(workspaceId);
      }
      // Soft ensure after a successful full-catalog: do not re-fan-out engines
      // until freshness expires (force / explicit user refresh still wins).
      if (
        !force &&
        kind === "full-catalog" &&
        fullyHydrated &&
        isFullCatalogFresh(workspaceId)
      ) {
        return;
      }
      const hasHydratedThreadList =
        options?.startupHydrationMode === "first-paint"
          ? false
          : kind === "first-paint"
            ? uiHydrated
            : fullyHydrated;
      const isHydratingThreadList =
        hydratingThreadListWorkspaceIdsRef.current.has(workspaceId);
      if (
        shouldSkipWorkspaceThreadListLoad({
          force,
          isLoading,
          isHydratingThreadList,
          hasHydratedThreadList,
        })
      ) {
        return;
      }
      const phase: ThreadHydrationPhase = force
        ? "on-demand"
        : workspaceId === activeWorkspaceId
          ? "active-workspace"
          : "idle-prewarm";
      hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, phase);
      hydrationKindByWorkspaceIdRef.current.set(workspaceId, kind);
      void listThreadsForWorkspaceTracked(workspace, {
        preserveState: options?.preserveState,
        deletedThreadIds: options?.deletedThreadIds,
        startupHydrationMode:
          kind === "first-paint" ? "first-paint" : "full-catalog",
        // After the first workspace is clickable, later projects must force
        // Index writers. Warm SQLite otherwise returns a partial engine set.
        forceSessionIndexSync: false,
      });
    },
    [
      activeWorkspaceId,
      listThreadsForWorkspaceTracked,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  ensureWorkspaceThreadListLoadedRef.current = ensureWorkspaceThreadListLoaded;

  const prewarmSessionRadarForWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesById.get(workspaceId);
      if (!workspace) {
        return;
      }
      if (threadListLoadingByWorkspace[workspaceId] ?? false) {
        return;
      }
      if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      if (idleHydrationCleanupByWorkspaceIdRef.current.has(workspaceId)) {
        return;
      }
      const cleanup = scheduleIdleHydration(() => {
        idleHydrationCleanupByWorkspaceIdRef.current.delete(workspaceId);
        if (threadListLoadingByWorkspace[workspaceId] ?? false) {
          return;
        }
        if (hydratingThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        if (fullyHydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
          return;
        }
        hydrationPhaseByWorkspaceIdRef.current.set(workspaceId, "idle-prewarm");
        hydrationKindByWorkspaceIdRef.current.set(workspaceId, "session-radar");
        void listThreadsForWorkspaceTracked(workspace, {
          preserveState: true,
        });
      });
      idleHydrationCleanupByWorkspaceIdRef.current.set(workspaceId, cleanup);
    },
    [
      listThreadsForWorkspaceTracked,
      scheduleIdleHydration,
      threadListLoadingByWorkspace,
      workspacesById,
    ],
  );

  useEffect(() => {
    ensureInteractiveInputHooks();
  }, []);

  useEffect(() => {
    const previousActiveWorkspaceId = previousActiveWorkspaceIdRef.current;
    const isIntentSwitch =
      previousActiveWorkspaceId != null &&
      previousActiveWorkspaceId !== activeWorkspaceId;

    if (isIntentSwitch && previousActiveWorkspaceId) {
      // Spec: stale workspace hydration is cancelled on switch. Soft-ignore
      // marks the generation stale so late list apply no-ops via isStale.
      startupOrchestrator.cancelWorkspaceTasks(
        previousActiveWorkspaceId,
        "stale",
      );
      const idleCleanup = idleHydrationCleanupByWorkspaceIdRef.current.get(
        previousActiveWorkspaceId,
      );
      if (idleCleanup) {
        idleCleanup();
        idleHydrationCleanupByWorkspaceIdRef.current.delete(
          previousActiveWorkspaceId,
        );
      }
      // Drop scheduled auto first-paint for the previous target.
      pendingAutoFirstPaintCleanupRef.current?.();
      pendingAutoFirstPaintCleanupRef.current = null;
      // Keep that workspace's Index forceSync armed — switching away used to
      // cancel it and leave other projects missing engines.
      if (autoHydratedActiveWorkspaceIdRef.current === previousActiveWorkspaceId) {
        autoHydratedActiveWorkspaceIdRef.current = null;
      }
    }

    previousActiveWorkspaceIdRef.current = activeWorkspaceId;

    if (!activeWorkspaceId) {
      autoHydratedActiveWorkspaceIdRef.current = null;
      pendingAutoFirstPaintCleanupRef.current?.();
      pendingAutoFirstPaintCleanupRef.current = null;
      return;
    }
    if (autoHydratedActiveWorkspaceIdRef.current === activeWorkspaceId) {
      return;
    }
    // Do not mark the active workspace as auto-hydrated until it exists in the
    // workspace map. On cold start activeWorkspaceId can land before workspacesById
    // is populated; marking early permanently skips ensure and leaves the sidebar
    // on "加载中…".
    if (!workspacesById.has(activeWorkspaceId)) {
      return;
    }

    // Cancel any prior pending schedule for a different bind of the same id
    // (e.g. map late-arrival re-entry) before rescheduling.
    pendingAutoFirstPaintCleanupRef.current?.();
    pendingAutoFirstPaintCleanupRef.current = null;

    const targetId = activeWorkspaceId;

    const startEnsure = () => {
      if (activeWorkspaceIdRef.current !== targetId) {
        return;
      }
      if (autoHydratedActiveWorkspaceIdRef.current === targetId) {
        return;
      }
      if (!workspacesById.has(targetId)) {
        return;
      }
      // Last-moment gate: if the user is still clicking, do not mark auto-done
      // and re-arm quiet schedule (Cmd+R press-test).
      if (
        hadRecentInteractiveInput(
          isIntentSwitch
            ? Math.max(WORKSPACE_SWITCH_INPUT_QUIET_MS, 48)
            : Math.max(COLD_START_INPUT_QUIET_MS, 48),
        )
      ) {
        pendingAutoFirstPaintCleanupRef.current = scheduleWhenInteractiveQuiet(
          startEnsure,
          {
            quietMs: isIntentSwitch
              ? WORKSPACE_SWITCH_INPUT_QUIET_MS
              : COLD_START_INPUT_QUIET_MS,
            minDelayMs: 0,
            maxWaitMs: COLD_START_IDLE_TIMEOUT_MS,
          },
        );
        return;
      }
      autoHydratedActiveWorkspaceIdRef.current = targetId;
      pendingAutoFirstPaintCleanupRef.current = null;
      ensureWorkspaceThreadListLoaded(targetId, { preserveState: true });
    };

    const armQuietSchedule = () => {
      pendingAutoFirstPaintCleanupRef.current?.();
      pendingAutoFirstPaintCleanupRef.current = scheduleWhenInteractiveQuiet(
        startEnsure,
        {
          quietMs: isIntentSwitch
            ? WORKSPACE_SWITCH_INPUT_QUIET_MS
            : COLD_START_INPUT_QUIET_MS,
          minDelayMs: isIntentSwitch
            ? WORKSPACE_SWITCH_INTENT_DELAY_MS
            : COLD_START_IDLE_MIN_DELAY_MS,
          maxWaitMs: COLD_START_IDLE_TIMEOUT_MS,
        },
      );
    };

    rescheduleAutoFirstPaintRef.current = () => {
      if (activeWorkspaceIdRef.current !== targetId) {
        return;
      }
      if (autoHydratedActiveWorkspaceIdRef.current === targetId) {
        return;
      }
      armQuietSchedule();
    };

    // Quiet-gated for both cold bind and workspace switch — switch still cancels
    // the previous workspace first (above).
    armQuietSchedule();

    return () => {
      pendingAutoFirstPaintCleanupRef.current?.();
      pendingAutoFirstPaintCleanupRef.current = null;
      if (rescheduleAutoFirstPaintRef.current) {
        rescheduleAutoFirstPaintRef.current = null;
      }
    };
  }, [
    activeWorkspaceId,
    ensureWorkspaceThreadListLoaded,
    workspacesById,
  ]);

  // Force-enter cancels pending idle full-catalog; re-arm once quiet so the
  // active sidebar still leaves stale snapshot after the user unmasks early.
  useEffect(() => {
    return subscribeStartupForceEnter(() => {
      const activeId = activeWorkspaceIdRef.current;
      if (!activeId) {
        return;
      }
      if (!hydratedThreadListWorkspaceIdsRef.current.has(activeId)) {
        return;
      }
      if (fullyHydratedThreadListWorkspaceIdsRef.current.has(activeId)) {
        return;
      }
      // Allow one re-arm after force-enter cancelled the first schedule.
      postFirstPaintFullCatalogArmedIdsRef.current.delete(activeId);
      schedulePostFirstPaintFullCatalog(activeId, { allowRepeat: true });
    });
  }, [schedulePostFirstPaintFullCatalog]);

  // While gate is not ready, any pointerdown soft-cancels in-flight list apply
  // so clicks never collide with setThreads (Cmd+R / reload stress).
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    ensureInteractiveInputHooks();
    const onPointerDown = () => {
      if (hasStartupGateReady() || isStartupForceEntered()) {
        return;
      }
      const activeId = activeWorkspaceIdRef.current;
      if (!activeId) {
        return;
      }
      startupOrchestrator.cancelWorkspaceTasks(activeId, "stale");
      // Allow quiet scheduler to retry after the user stops clicking.
      if (autoHydratedActiveWorkspaceIdRef.current === activeId) {
        autoHydratedActiveWorkspaceIdRef.current = null;
        rescheduleAutoFirstPaintRef.current?.();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: true,
    });
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      workspaces.forEach((workspace) => {
        if (workspace.settings.sidebarCollapsed) {
          return;
        }
        if (hydratedThreadListWorkspaceIdsRef.current.has(workspace.id)) {
          return;
        }
        ensureWorkspaceThreadListLoaded(workspace.id, { preserveState: true });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ensureWorkspaceThreadListLoaded, workspaces]);

  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceProjectionOwnerIds.length <= 1) {
      return;
    }
    // Projection owners: defer until gate-ready so cold-start does not dual-scan.
    if (isColdStartListGuardActive() && activeWorkspaceId) {
      return;
    }
    activeWorkspaceProjectionOwnerIds.forEach((workspaceId) => {
      if (workspaceId === activeWorkspaceId) {
        return;
      }
      if (!workspacesById.has(workspaceId)) {
        return;
      }
      if (hydratedThreadListWorkspaceIdsRef.current.has(workspaceId)) {
        return;
      }
      ensureWorkspaceThreadListLoaded(workspaceId, { preserveState: true });
    });
  }, [
    activeWorkspaceId,
    activeWorkspaceProjectionOwnerIds,
    ensureWorkspaceThreadListLoaded,
    workspacesById,
  ]);

  useEffect(() => {
    const cleanupByWorkspaceId = idleHydrationCleanupByWorkspaceIdRef.current;
    return () => {
      cleanupByWorkspaceId.forEach((cleanup) => cleanup());
      cleanupByWorkspaceId.clear();
      cancelPendingIndexSync();
    };
  }, [cancelPendingIndexSync]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ workspaceIds?: string[]; upserted?: number }>(
      "session-index-imported",
      (event) => {
        const ids = event.payload?.workspaceIds ?? [];
        ids.forEach((workspaceId) => {
          ensureWorkspaceThreadListLoaded(workspaceId, {
            preserveState: true,
            startupHydrationMode: "first-paint",
          });
        });
      },
    )
      .then((fn) => {
        if (disposed) {
          void fn();
          return;
        }
        unlisten = () => {
          void fn();
        };
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [ensureWorkspaceThreadListLoaded]);

  return {
    ensureWorkspaceThreadListLoaded,
    hydratedThreadListWorkspaceIds,
    hydratedThreadListWorkspaceIdsRef,
    listThreadsForWorkspaceTracked,
    prewarmSessionRadarForWorkspace,
  };
}
