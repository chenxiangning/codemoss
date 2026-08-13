// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppShellEditorLayoutSection } from "./useAppShellEditorLayoutSection";

const useGitHistoryPanelResizeMock = vi.hoisted(() =>
  vi.fn(() => ({
    gitHistoryPanelHeight: 320,
    gitHistoryPanelHeightRef: { current: 320 },
    onGitHistoryPanelResizeStart: vi.fn(),
    setGitHistoryPanelHeight: vi.fn(),
  })),
);

vi.mock("../../features/app/hooks/useGitHistoryPanelResize", () => ({
  useGitHistoryPanelResize: useGitHistoryPanelResizeMock,
}));

function createParams(
  overrides: Partial<Parameters<typeof useAppShellEditorLayoutSection>[0]> = {},
) {
  return {
    collapseSidebar: vi.fn(),
    setAppMode: vi.fn(),
    setRightPanelWidth: vi.fn(),
    ...overrides,
  };
}

describe("useAppShellEditorLayoutSection", () => {
  it("prepares the desktop editor layout when a file is opened", () => {
    const collapseSidebar = vi.fn();
    const view = renderHook(() =>
      useAppShellEditorLayoutSection(createParams({ collapseSidebar })),
    );

    act(() => {
      view.result.current.setEditorSplitLayout("vertical");
      view.result.current.setIsEditorFileMaximized(true);
    });

    act(() => {
      view.result.current.requestEditorOpenLayout();
    });

    expect(collapseSidebar).toHaveBeenCalledTimes(1);
    expect(view.result.current.editorSplitLayout).toBe("horizontal");
    expect(view.result.current.isEditorFileMaximized).toBe(false);
  });

  it("resets solo split width to half of the main shell width", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const setRightPanelWidth = vi.fn();
    const view = renderHook(() =>
      useAppShellEditorLayoutSection(createParams({ setRightPanelWidth })),
    );
    const appRoot = document.createElement("div");
    const main = document.createElement("main");
    main.className = "main";
    Object.defineProperty(main, "clientWidth", {
      configurable: true,
      value: 900,
    });
    appRoot.appendChild(main);

    view.result.current.appRootRef.current = appRoot;

    act(() => {
      view.result.current.resetSoloSplitToHalf();
    });

    expect(setRightPanelWidth).toHaveBeenCalledWith(450);

    requestAnimationFrameSpy.mockRestore();
  });
});
