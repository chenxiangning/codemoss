// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppShellViewStateSection } from "./useAppShellViewStateSection";

function createParams(
  overrides: Partial<Parameters<typeof useAppShellViewStateSection>[0]> = {},
) {
  return {
    activePlan: null,
    activeTab: "codex",
    activeThreadId: null,
    activeWorkspace: null,
    activeWorkspaceId: null,
    appMode: "chat",
    expandRightPanel: vi.fn(),
    homeOpen: true,
    homeWorkspaceDefaultId: "workspace-default",
    isCompact: false,
    isTablet: false,
    selectedCollaborationMode: null,
    setActiveThreadId: vi.fn(),
    setActiveWorkspaceId: vi.fn(),
    setHomeOpen: vi.fn(),
    tabletTab: "codex",
    ...overrides,
  };
}

describe("useAppShellViewStateSection", () => {
  it("keeps the bottom status panel collapsed by default and re-collapses on thread switch", () => {
    const view = renderHook((params) => useAppShellViewStateSection(params), {
      initialProps: createParams(),
    });

    expect(view.result.current.isPlanPanelDismissed).toBe(true);

    act(() => {
      view.result.current.openPlanPanel();
    });
    expect(view.result.current.isPlanPanelDismissed).toBe(false);

    view.rerender(createParams({ activeThreadId: "thread-2" }));
    expect(view.result.current.isPlanPanelDismissed).toBe(true);
  });

  it("does not repeatedly dispatch default workspace activation while state is still pending", () => {
    const setActiveThreadId = vi.fn();
    const setActiveWorkspaceId = vi.fn();
    const view = renderHook((params) => useAppShellViewStateSection(params), {
      initialProps: createParams({
        setActiveThreadId,
        setActiveWorkspaceId,
      }),
    });

    view.rerender(createParams({
      setActiveThreadId: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
    }));
    view.rerender(createParams({
      setActiveThreadId: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
    }));

    expect(setActiveWorkspaceId).toHaveBeenCalledTimes(1);
    expect(setActiveWorkspaceId).toHaveBeenCalledWith("workspace-default");
    expect(setActiveThreadId).toHaveBeenCalledTimes(1);
    expect(setActiveThreadId).toHaveBeenCalledWith(null, "workspace-default");
  });

  it("allows a later default workspace activation after active workspace state settles", () => {
    const firstSetActiveThreadId = vi.fn();
    const firstSetActiveWorkspaceId = vi.fn();
    const nextSetActiveThreadId = vi.fn();
    const nextSetActiveWorkspaceId = vi.fn();
    const view = renderHook((params) => useAppShellViewStateSection(params), {
      initialProps: createParams({
        setActiveThreadId: firstSetActiveThreadId,
        setActiveWorkspaceId: firstSetActiveWorkspaceId,
      }),
    });

    view.rerender(createParams({
      activeWorkspaceId: "workspace-default",
      setActiveThreadId: vi.fn(),
      setActiveWorkspaceId: vi.fn(),
    }));
    view.rerender(createParams({
      setActiveThreadId: nextSetActiveThreadId,
      setActiveWorkspaceId: nextSetActiveWorkspaceId,
    }));

    expect(firstSetActiveWorkspaceId).toHaveBeenCalledTimes(1);
    expect(firstSetActiveThreadId).toHaveBeenCalledTimes(1);
    expect(nextSetActiveWorkspaceId).toHaveBeenCalledTimes(1);
    expect(nextSetActiveWorkspaceId).toHaveBeenCalledWith("workspace-default");
    expect(nextSetActiveThreadId).toHaveBeenCalledTimes(1);
    expect(nextSetActiveThreadId).toHaveBeenCalledWith(null, "workspace-default");
  });

  it("shows workspace home inside the active workspace instead of global home", () => {
    const activeWorkspace = { id: "ws-1" };
    const view = renderHook((params) => useAppShellViewStateSection(params), {
      initialProps: createParams({
        activeWorkspace,
        activeWorkspaceId: "ws-1",
        homeOpen: false,
      }),
    });

    act(() => {
      view.result.current.setWorkspaceHomeWorkspaceId("ws-1");
    });

    expect(view.result.current.showHome).toBe(false);
    expect(view.result.current.showWorkspaceHome).toBe(true);

    view.rerender(createParams({
      activeWorkspace,
      activeWorkspaceId: "ws-1",
      homeOpen: true,
    }));

    expect(view.result.current.showHome).toBe(true);
    expect(view.result.current.showWorkspaceHome).toBe(false);
  });
});
