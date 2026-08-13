// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

function createWorkspace(
  overrides: Partial<WorkspaceInfo> & Pick<WorkspaceInfo, "id">,
): WorkspaceInfo {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    path: overrides.path ?? `/tmp/${overrides.id}`,
    connected: overrides.connected ?? true,
    kind: overrides.kind ?? "main",
    parentId: overrides.parentId ?? null,
    worktree: overrides.worktree ?? null,
    settings: {
      sidebarCollapsed: false,
      ...(overrides.settings ?? {}),
    },
  };
}

describe("useWorkspaceRestore", () => {
  it("冷启只恢复 active workspace，不扫其他可见工作区", async () => {
    const activeWorkspace = createWorkspace({
      id: "ws-active",
      connected: false,
      settings: { sidebarCollapsed: true },
    });
    const visibleWorkspace = createWorkspace({ id: "ws-visible" });
    const collapsedWorkspace = createWorkspace({
      id: "ws-collapsed",
      settings: { sidebarCollapsed: true },
    });
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceRestore({
        workspaces: [visibleWorkspace, collapsedWorkspace, activeWorkspace],
        hasLoaded: true,
        activeWorkspaceId: activeWorkspace.id,
        restoreThreadsOnlyOnLaunch: false,
        listThreadsForWorkspace,
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledWith(activeWorkspace, {
      recoverySource: "workspace-restore",
      allowRuntimeReconnect: true,
      startupHydrationMode: "first-paint",
      preserveState: true,
    });
    expect(
      listThreadsForWorkspace.mock.calls.map((call) => call[0].id),
    ).toEqual(["ws-active"]);
  });

  it("已 hydrate 的 active workspace 不再二次 list", async () => {
    const activeWorkspace = createWorkspace({ id: "ws-active" });
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceRestore({
        workspaces: [activeWorkspace],
        hasLoaded: true,
        activeWorkspaceId: activeWorkspace.id,
        restoreThreadsOnlyOnLaunch: false,
        isWorkspaceHydrated: (workspaceId) => workspaceId === "ws-active",
        listThreadsForWorkspace,
      }),
    );

    await new Promise((resolve) => {
      window.setTimeout(resolve, 20);
    });
    expect(listThreadsForWorkspace).not.toHaveBeenCalled();
  });

  it("开启线程恢复模式时不会在启动阶段批量连接 runtime", async () => {
    const activeWorkspace = createWorkspace({
      id: "ws-active",
      connected: false,
    });
    const visibleWorkspace = createWorkspace({
      id: "ws-visible",
      connected: false,
    });
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useWorkspaceRestore({
        workspaces: [visibleWorkspace, activeWorkspace],
        hasLoaded: true,
        activeWorkspaceId: activeWorkspace.id,
        restoreThreadsOnlyOnLaunch: true,
        listThreadsForWorkspace,
      }),
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledWith(activeWorkspace, {
      recoverySource: "workspace-restore",
      allowRuntimeReconnect: false,
      startupHydrationMode: "first-paint",
      preserveState: true,
    });
  });

  it("active workspace 恢复失败时后续 render 会重试", async () => {
    const activeWorkspace = createWorkspace({
      id: "ws-active",
      connected: false,
    });
    const visibleWorkspace = createWorkspace({
      id: "ws-visible",
      connected: true,
    });
    const listThreadsForWorkspace = vi
      .fn()
      .mockRejectedValueOnce(new Error("connect failed"))
      .mockResolvedValue(undefined);

    const { rerender } = renderHook(
      (props: {
        workspaces: WorkspaceInfo[];
        activeWorkspaceId: string | null;
      }) =>
        useWorkspaceRestore({
          workspaces: props.workspaces,
          hasLoaded: true,
          activeWorkspaceId: props.activeWorkspaceId,
          restoreThreadsOnlyOnLaunch: false,
          listThreadsForWorkspace,
        }),
      {
        initialProps: {
          workspaces: [visibleWorkspace, activeWorkspace],
          activeWorkspaceId: activeWorkspace.id,
        },
      },
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledWith(activeWorkspace, {
        recoverySource: "workspace-restore",
        allowRuntimeReconnect: true,
        startupHydrationMode: "first-paint",
        preserveState: true,
      });
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    rerender({
      workspaces: [visibleWorkspace, activeWorkspace],
      activeWorkspaceId: activeWorkspace.id,
    });

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(2);
    });
    expect(
      listThreadsForWorkspace.mock.calls.every(
        (call) => call[0].id === "ws-active",
      ),
    ).toBe(true);
  });

  it("workspace refresh rerender does not restart a restore that already succeeded in flight", async () => {
    const activeWorkspace = createWorkspace({
      id: "ws-active",
      connected: true,
    });
    const deferredRestore = (() => {
      let resolve = () => {};
      const promise = new Promise<void>((nextResolve) => {
        resolve = nextResolve;
      });
      return { promise, resolve };
    })();
    const listThreadsForWorkspace = vi.fn().mockImplementation(
      () => deferredRestore.promise,
    );

    const { rerender } = renderHook(
      (props: { workspaces: WorkspaceInfo[] }) =>
        useWorkspaceRestore({
          workspaces: props.workspaces,
          hasLoaded: true,
          activeWorkspaceId: activeWorkspace.id,
          restoreThreadsOnlyOnLaunch: false,
          listThreadsForWorkspace,
        }),
      {
        initialProps: {
          workspaces: [activeWorkspace],
        },
      },
    );

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    rerender({
      workspaces: [{ ...activeWorkspace }],
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);

    deferredRestore.resolve();

    await waitFor(() => {
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    rerender({
      workspaces: [{ ...activeWorkspace, name: "workspace-renamed" }],
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
  });
});
