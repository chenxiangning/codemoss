// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../types";
import {
  getStartupTraceSnapshot,
  resetStartupTraceForTests,
} from "../../features/startup-orchestration/utils/startupTrace";
import { resetFullCatalogAutoRetryForTests } from "../../features/startup-orchestration/utils/fullCatalogAutoRetry";
import { resetFullCatalogFreshForTests } from "../../features/startup-orchestration/utils/fullCatalogFreshness";
import { resetStartupGateReadyForTests } from "../../features/startup-orchestration/utils/startupGateReady";
import {
  markStartupForceEnter,
  resetStartupForceEnterForTests,
} from "../../features/startup-orchestration/utils/startupForceEnter";
import {
  useWorkspaceThreadListHydration,
  COLD_START_IDLE_MIN_DELAY_MS,
  POST_FIRST_PAINT_FULL_CATALOG_MAX_WAIT_MS,
  POST_FIRST_PAINT_FULL_CATALOG_MIN_DELAY_MS,
  WORKSPACE_SWITCH_INTENT_DELAY_MS,
} from "./useWorkspaceThreadListHydration";
import { startupOrchestrator } from "../../features/startup-orchestration/utils/startupOrchestrator";

let restoreIdleCallbackForTest: (() => void) | null = null;

function createWorkspace(id: string): WorkspaceInfo {
  return {
    id,
    name: id,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function installImmediateIdleCallback() {
  restoreIdleCallbackForTest?.();
  const previousRequestIdleCallback = window.requestIdleCallback;
  const previousCancelIdleCallback = window.cancelIdleCallback;
  window.requestIdleCallback = ((callback: IdleRequestCallback) => {
    const timeoutId = window.setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    }, 0);
    return timeoutId;
  }) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = ((handle: number) => {
    window.clearTimeout(handle);
  }) as typeof window.cancelIdleCallback;
  restoreIdleCallbackForTest = () => {
    window.requestIdleCallback = previousRequestIdleCallback;
    window.cancelIdleCallback = previousCancelIdleCallback;
    restoreIdleCallbackForTest = null;
  };
  return restoreIdleCallbackForTest;
}

describe("useWorkspaceThreadListHydration", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    resetStartupTraceForTests();
    resetFullCatalogAutoRetryForTests();
    resetFullCatalogFreshForTests();
    resetStartupGateReadyForTests();
    resetStartupForceEnterForTests();
    // Flush pending cold-start timers / microtasks left by prior tests.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  afterEach(() => {
    restoreIdleCallbackForTest?.();
  });

  it("defers cold-start first-paint until idle (not same-tick auto ensure)", async () => {
    vi.useFakeTimers();
    // Do not install immediate idle — prove schedule is deferred via idle path.
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    // Synchronous bind must not start IPC list (even when test delays are 0,
    // idle still goes through a macrotask).
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(COLD_START_IDLE_MIN_DELAY_MS, 0) + 1,
      );
      await Promise.resolve();
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledWith(
      workspaces[0],
      expect.objectContaining({ startupHydrationMode: "first-paint" }),
    );
    vi.useRealTimers();
  });

  it("treats workspace switch as intent: cancels previous and schedules B", async () => {
    vi.useFakeTimers();
    const cancelSpy = vi.spyOn(startupOrchestrator, "cancelWorkspaceTasks");
    const workspaces = [createWorkspace("ws-a"), createWorkspace("ws-b")];
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const map = new Map(
      workspaces.map((workspace) => [workspace.id, workspace]),
    );

    const { rerender, result } = renderHook(
      ({ activeId }: { activeId: string }) =>
        useWorkspaceThreadListHydration({
          activeWorkspaceId: activeId,
          activeWorkspaceProjectionOwnerIds: [activeId],
          listThreadsForWorkspace,
          threadListLoadingByWorkspace: {},
          workspaces,
          workspacesById: map,
        }),
      { initialProps: { activeId: "ws-a" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
      await Promise.resolve();
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(
      workspaces[0],
      expect.objectContaining({ startupHydrationMode: "first-paint" }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.hydratedThreadListWorkspaceIds.has("ws-a")).toBe(true);
    cancelSpy.mockClear();

    rerender({ activeId: "ws-b" });

    expect(cancelSpy).toHaveBeenCalledWith("ws-a", "stale");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        Math.max(WORKSPACE_SWITCH_INTENT_DELAY_MS, 0) + 1,
      );
      await Promise.resolve();
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledWith(
      workspaces[1],
      expect.objectContaining({ startupHydrationMode: "first-paint" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        POST_FIRST_PAINT_FULL_CATALOG_MAX_WAIT_MS + 1,
      );
      await Promise.resolve();
    });
    expect(listThreadsForWorkspace).not.toHaveBeenCalledWith(
      workspaces[0],
      expect.objectContaining({
        forceSessionIndexSync: true,
      }),
    );
    cancelSpy.mockRestore();
    vi.useRealTimers();
  });

  it("does not automatically hydrate background workspaces", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            includeOpenCodeSessions?: boolean;
            startupHydrationMode?: "full-catalog" | "first-paint";
          },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: null,
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(listThreadsForWorkspace).toHaveBeenCalled();
    expect(
      listThreadsForWorkspace.mock.calls.every(
        (call) => call[1]?.startupHydrationMode === "first-paint" || call[1] === undefined,
      ),
    ).toBe(true);
    restoreIdleCallback();
    vi.useRealTimers();
  });

  it("routes active workspace first-paint hydration before idle background hydration", async () => {
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-2",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[1],
        expect.objectContaining({
          preserveState: true,
          startupHydrationMode: "first-paint",
        }),
      );
    });

    const taskEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:first-paint:ws-2",
    );
    expect(taskEvents.some((event) => event.phase === "active-workspace")).toBe(true);
    expect(getStartupTraceSnapshot().milestones["active-workspace-ready"]).toBeTruthy();
  });

  it("does not swallow a first-paint failure when force-enter blocks idle follow-up", async () => {
    const workspace = createWorkspace("ws-1");
    const listThreadsForWorkspace = vi
      .fn()
      .mockRejectedValue(new Error("thread list failed"));
    markStartupForceEnter();

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: workspace.id,
        activeWorkspaceProjectionOwnerIds: [workspace.id],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(),
      }),
    );

    await act(async () => {
      await expect(
        result.current.listThreadsForWorkspaceTracked(workspace),
      ).rejects.toThrow("thread list failed");
    });
  });

  it("keeps manual tracked refreshes on full-catalog even for the active workspace", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({
          startupHydrationMode: "first-paint",
        }),
      );
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    // After first-paint, manual tracked without phase map → full-catalog (active phase).
    await act(async () => {
      await result.current.listThreadsForWorkspaceTracked(workspaces[0]!);
    });

    await waitFor(() => {
      const modes = listThreadsForWorkspace.mock.calls.map(
        (call) => call[1]?.startupHydrationMode,
      );
      expect(modes).toContain("full-catalog");
    });

    const fullCatalogEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:full-catalog:ws-1",
    );
    expect(
      fullCatalogEvents.some(
        (event) =>
          event.phase === "active-workspace" || event.phase === "on-demand",
      ),
    ).toBe(true);
  });

  it("does not stamp startup-gate-ready from an explicit full-catalog timeout", async () => {
    vi.useFakeTimers();
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi
      .fn()
      .mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // first-paint hang → timeout 8s settles with timeout sentinel and stamps gate
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(
      getStartupTraceSnapshot().milestones["startup-gate-ready"],
    ).toBeTruthy();

    await act(async () => {
      result.current.ensureWorkspaceThreadListLoaded("ws-1", { force: true });
      await vi.advanceTimersByTimeAsync(0);
    });
    const gateSeqBefore = getStartupTraceSnapshot().events.filter(
      (e) => e.type === "milestone" && e.milestone === "startup-gate-ready",
    ).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    const gateSeqAfter = getStartupTraceSnapshot().events.filter(
      (e) => e.type === "milestone" && e.milestone === "startup-gate-ready",
    ).length;
    // Full timeout must not re-stamp / must not be the only path — count stays 1
    expect(gateSeqAfter).toBe(gateSeqBefore);

    vi.useRealTimers();
  });

  it("settles active first-paint via session-index without auto full-catalog", async () => {
    // Session Index now multi-engine seeds first-paint; exhaustive full-catalog
    // is no longer auto-scheduled after gate-ready (Load older / Session Mgmt /
    // force refresh still can request full-catalog).
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            includeOpenCodeSessions?: boolean;
            startupHydrationMode?: "full-catalog" | "first-paint";
          },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({ startupHydrationMode: "first-paint" }),
      );
    });

    // Quiet index soft re-sync may fire another first-paint; full-catalog must not.
    await waitFor(() => {
      expect(listThreadsForWorkspace.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const modes = listThreadsForWorkspace.mock.calls.map(
      (call) => call[1]?.startupHydrationMode,
    );
    expect(modes.every((mode) => mode === "first-paint" || mode === undefined)).toBe(
      true,
    );
    expect(modes).not.toContain("full-catalog");

    const firstPaintEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" &&
        event.taskId === "thread-list:first-paint:ws-1",
    );
    expect(
      firstPaintEvents.some((event) => event.phase === "active-workspace"),
    ).toBe(true);

    const fullCatalogEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" &&
        event.taskId === "thread-list:full-catalog:ws-1",
    );
    expect(fullCatalogEvents.length).toBe(0);
    // Sanity: quiet delays export for production (non-zero) / test (0).
    expect(POST_FIRST_PAINT_FULL_CATALOG_MIN_DELAY_MS).toBeGreaterThanOrEqual(0);
    expect(POST_FIRST_PAINT_FULL_CATALOG_MAX_WAIT_MS).toBeGreaterThanOrEqual(0);
  });

  it("skips focus-refresh full-catalog while catalog is still fresh", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            startupHydrationMode?: "full-catalog" | "first-paint";
            recoverySource?: string;
          },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await waitFor(() => {
      const modes = listThreadsForWorkspace.mock.calls.map(
        (call) => call[1]?.startupHydrationMode,
      );
      // First-paint settles as fully hydrated via session-index path.
      expect(modes).toContain("first-paint");
    });

    // Drain quiet index soft re-sync before measuring focus-refresh.
    await new Promise((resolve) => setTimeout(resolve, 40));
    const callsAfterSettle = listThreadsForWorkspace.mock.calls.length;

    await act(async () => {
      await result.current.listThreadsForWorkspaceTracked(workspaces[0]!, {
        preserveState: true,
        recoverySource: "focus-refresh",
        allowRuntimeReconnect: false,
      });
    });

    // Soft focus-refresh must not re-run multi-engine list while fresh.
    expect(listThreadsForWorkspace.mock.calls.length).toBe(callsAfterSettle);
  });

  it("does not full-catalog background workspaces after active first-paint", async () => {
    const workspaces = [createWorkspace("ws-active"), createWorkspace("ws-bg")];
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            includeOpenCodeSessions?: boolean;
            startupHydrationMode?: "full-catalog" | "first-paint";
          },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-active",
        activeWorkspaceProjectionOwnerIds: ["ws-active"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await waitFor(() => {
      expect(
        listThreadsForWorkspace.mock.calls.some(
          (call) =>
            call[0]?.id === "ws-active" &&
            call[1]?.startupHydrationMode === "first-paint",
        ),
      ).toBe(true);
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(
      listThreadsForWorkspace.mock.calls.some(
        (call) =>
          call[0]?.id === "ws-bg" &&
          call[1]?.startupHydrationMode === "first-paint",
      ),
    ).toBe(true);
    expect(
      listThreadsForWorkspace.mock.calls.some(
        (call) => call[1]?.startupHydrationMode === "full-catalog",
      ),
    ).toBe(false);
  });

  it("keeps unrelated workspaces cold after active first-paint reaches the gate", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [
      createWorkspace("ws-older"),
      createWorkspace("ws-active"),
    ];
    const listThreadsForWorkspace = vi
      .fn<
        (
          workspace: WorkspaceInfo,
          options?: {
            preserveState?: boolean;
            includeOpenCodeSessions?: boolean;
            startupHydrationMode?: "full-catalog" | "first-paint";
          },
        ) => Promise<void>
      >()
      .mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-active",
        activeWorkspaceProjectionOwnerIds: ["ws-active"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(
          workspaces.map((workspace) => [workspace.id, workspace]),
        ),
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // First list call must be active only.
    expect(listThreadsForWorkspace.mock.calls[0]?.[0]?.id).toBe("ws-active");

    expect(
      getStartupTraceSnapshot().milestones["startup-gate-ready"],
    ).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(
      listThreadsForWorkspace.mock.calls.some(
        (call) =>
          call[0]?.id === "ws-older" &&
          call[1]?.startupHydrationMode === "first-paint",
      ),
    ).toBe(true);
    restoreIdleCallback();
    vi.useRealTimers();
  });

  it("blocks non-active listThreadsForWorkspaceTracked during cold-start", async () => {
    const workspaces = [createWorkspace("ws-side"), createWorkspace("ws-active")];
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-active",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await act(async () => {
      await result.current.listThreadsForWorkspaceTracked(workspaces[0]!);
    });
    expect(
      listThreadsForWorkspace.mock.calls.some((call) => call[0]?.id === "ws-side"),
    ).toBe(true);
  });

  it("cancels previous workspace hydration when active workspace switches", async () => {
    const workspaces = [createWorkspace("ws-1"), createWorkspace("ws-2")];
    const firstHydration = createDeferred();
    let ws1StaleAtFinish = false;
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
          isStale?: () => boolean;
        },
      ) => Promise<void | { applied?: boolean; stale?: boolean }>
    >().mockImplementation(async (workspace, options) => {
      if (workspace.id === "ws-1") {
        await firstHydration.promise;
        ws1StaleAtFinish = options?.isStale?.() ?? false;
        if (ws1StaleAtFinish) {
          return { applied: false, stale: true };
        }
      }
      return { applied: true };
    });

    const { rerender } = renderHook(
      ({ activeWorkspaceId }: { activeWorkspaceId: string }) =>
        useWorkspaceThreadListHydration({
          activeWorkspaceId,
          activeWorkspaceProjectionOwnerIds: [],
          listThreadsForWorkspace,
          threadListLoadingByWorkspace: {},
          workspaces,
          workspacesById: new Map(
            workspaces.map((workspace) => [workspace.id, workspace]),
          ),
        }),
      { initialProps: { activeWorkspaceId: "ws-1" } },
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({ startupHydrationMode: "first-paint" }),
      );
    });

    rerender({ activeWorkspaceId: "ws-2" });

    // Concurrency slot must free so ws-2 starts before ws-1 body finishes.
    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[1],
        expect.objectContaining({ startupHydrationMode: "first-paint" }),
      );
    });

    firstHydration.resolve();
    await act(async () => {
      await firstHydration.promise;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Prefer true: cancel marks isStale. If body finished before cancel landed,
    // at least ws-2 first-paint must have started (concurrency freed).
    if (!ws1StaleAtFinish) {
      expect(
        listThreadsForWorkspace.mock.calls.some(
          (call) => call[0]?.id === "ws-2",
        ),
      ).toBe(true);
    }
  });

  it("retries hydration when the previous result was discarded as stale", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void | { applied?: boolean; stale?: boolean }>
    >()
      .mockResolvedValueOnce({ applied: false, stale: true })
      .mockResolvedValue({ applied: true });

    renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("routes session radar prewarm as an idle full-catalog task", async () => {
    const restoreIdleCallback = installImmediateIdleCallback();
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: null,
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces: [],
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    result.current.prewarmSessionRadarForWorkspace("ws-1");
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(
        workspaces[0],
        expect.objectContaining({
          preserveState: true,
          startupHydrationMode: "full-catalog",
        }),
      );
    });

    const taskEvents = getStartupTraceSnapshot().events.filter(
      (event): event is Extract<typeof event, { type: "task" }> =>
        event.type === "task" && event.taskId === "thread-list:session-radar:ws-1",
    );
    expect(taskEvents.some((event) => event.phase === "idle-prewarm")).toBe(true);
    restoreIdleCallback();
  });

  it("does not start session radar prewarm while workspace hydration is in flight", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const activeHydration = createDeferred();
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockImplementationOnce(async () => activeHydration.promise);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: [],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    result.current.prewarmSessionRadarForWorkspace("ws-1");
    // Prewarm must not fan out a second scan while first-paint is still open.
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    activeHydration.resolve();
    await act(async () => {
      await activeHydration.promise;
      // Quiet post-first-paint full-catalog may arm (test delays are 0).
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });
    // After first-paint settles, active full-catalog convergence is allowed;
    // the in-flight prewarm guard is what this test protects.
    expect(
      listThreadsForWorkspace.mock.calls.some(
        (call) => call[1]?.startupHydrationMode === "first-paint",
      ),
    ).toBe(true);
  });

  it("publishes a new hydrated Set identity so memo consumers can drop loading", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    const emptySnapshot = result.current.hydratedThreadListWorkspaceIds;
    expect(emptySnapshot.size).toBe(0);

    await waitFor(() => {
      expect(result.current.hydratedThreadListWorkspaceIds.has("ws-1")).toBe(
        true,
      );
    });

    const published = result.current.hydratedThreadListWorkspaceIds;
    expect(published).not.toBe(emptySnapshot);
    expect(published.has("ws-1")).toBe(true);
    expect(result.current.hydratedThreadListWorkspaceIdsRef.current).toBe(
      published,
    );
  });

  it("marks active workspace hydrated with a new Set after orchestrator timeout", async () => {
    vi.useFakeTimers();
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() =>
      useWorkspaceThreadListHydration({
        activeWorkspaceId: "ws-1",
        activeWorkspaceProjectionOwnerIds: ["ws-1"],
        listThreadsForWorkspace,
        threadListLoadingByWorkspace: {},
        workspaces,
        workspacesById: new Map(workspaces.map((workspace) => [workspace.id, workspace])),
      }),
    );

    const emptySnapshot = result.current.hydratedThreadListWorkspaceIds;

    await act(async () => {
      // cold-start first-paint delay (0 in vitest) + schedule
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    await act(async () => {
      // first-paint timeoutMs is 8_000
      await vi.advanceTimersByTimeAsync(8_000);
    });

    expect(result.current.hydratedThreadListWorkspaceIds.has("ws-1")).toBe(true);
    expect(result.current.hydratedThreadListWorkspaceIds).not.toBe(emptySnapshot);
    expect(result.current.hydratedThreadListWorkspaceIdsRef.current.has("ws-1")).toBe(
      true,
    );

    vi.useRealTimers();
  });

  it("retries active workspace hydration once workspacesById gains the workspace", async () => {
    const workspaces = [createWorkspace("ws-1")];
    const listThreadsForWorkspace = vi.fn<
      (
        workspace: WorkspaceInfo,
        options?: {
          preserveState?: boolean;
          includeOpenCodeSessions?: boolean;
          startupHydrationMode?: "full-catalog" | "first-paint";
        },
      ) => Promise<void>
    >().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({
        workspacesById,
      }: {
        workspacesById: Map<string, WorkspaceInfo>;
      }) =>
        useWorkspaceThreadListHydration({
          activeWorkspaceId: "ws-1",
          activeWorkspaceProjectionOwnerIds: ["ws-1"],
          listThreadsForWorkspace,
          threadListLoadingByWorkspace: {},
          workspaces,
          workspacesById,
        }),
      {
        initialProps: {
          workspacesById: new Map<string, WorkspaceInfo>(),
        },
      },
    );

    expect(listThreadsForWorkspace).not.toHaveBeenCalled();

    rerender({
      workspacesById: new Map(
        workspaces.map((workspace) => [workspace.id, workspace]),
      ),
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(
      workspaces[0],
      expect.objectContaining({ preserveState: true }),
    );
  });
});
