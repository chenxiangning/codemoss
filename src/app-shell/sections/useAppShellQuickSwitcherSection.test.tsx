// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushErrorToast } from "../../services/toasts";
import { useAppShellQuickSwitcherSection } from "./useAppShellQuickSwitcherSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

vi.mock("../../features/quick-switcher/hooks/useRecordRecentFilesFromActivity", () => ({
  useRecordRecentFilesFromActivity: vi.fn(),
}));

function createInput() {
  return {
    activeWorkspaceId: "workspace-a",
    threadsByWorkspace: {
      "workspace-a": [
        { id: "thread-old", name: "Old", updatedAt: 1 },
        { id: "thread-new", name: "New", updatedAt: 2 },
      ],
    },
    workspaces: [
      {
        id: "workspace-a",
        name: "Alpha",
        path: "/alpha",
        connected: true,
        settings: {},
      },
      {
        id: "workspace-b",
        name: "Beta",
        path: "/beta",
        connected: true,
        settings: {},
      },
    ] as any,
    activityTimeline: [],
    runningSessions: [],
    isCompact: false,
    isSearchPaletteOpen: false,
    setIsSearchPaletteOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setActiveThreadId: vi.fn(),
    setAppMode: vi.fn(),
    setCenterMode: vi.fn(),
    setFilePanelMode: vi.fn(),
    setGitPanelMode: vi.fn(),
    setHomeOpen: vi.fn(),
    setWorkspaceHomeWorkspaceId: vi.fn(),
    selectWorkspace: vi.fn(),
    expandRightPanel: vi.fn(),
    handleOpenFile: vi.fn(),
    handleToggleTerminalPanel: vi.fn(),
    openSettings: vi.fn(),
  };
}

afterEach(cleanup);

describe("useAppShellQuickSwitcherSection", () => {
  it("opens with Ctrl+E on non-macOS and projects sessions newest first", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    fireEvent.keyDown(window, { key: "e", ctrlKey: true });

    expect(result.current.isQuickSwitcherOpen).toBe(true);
    expect(
      result.current.quickSwitcherSessionGroups.flatMap((group) =>
        group.sessions.map((session) => session.id),
      ),
    ).toEqual(["thread-new", "thread-old"]);
    expect(input.setIsSearchPaletteOpen).toHaveBeenCalledWith(false);
  });

  it("switches sessions without forcing the editor back to chat", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectSession(
        "workspace-a",
        "thread-new",
      ),
    );

    expect(input.setActiveThreadId).toHaveBeenCalledWith(
      "thread-new",
      "workspace-a",
    );
    expect(input.setCenterMode).not.toHaveBeenCalled();
    expect(input.setAppMode).toHaveBeenCalledWith("chat");
  });

  it("jumps to a session in another workspace by selecting the workspace first", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() => result.current.handleOpenQuickSwitcher());
    act(() =>
      result.current.handleQuickSwitcherSelectSession(
        "workspace-b",
        "thread-x",
      ),
    );

    expect(input.selectWorkspace).toHaveBeenCalledWith("workspace-b");
    expect(input.setActiveThreadId).toHaveBeenCalledWith(
      "thread-x",
      "workspace-b",
    );
    expect(input.setAppMode).toHaveBeenCalledWith("chat");
    expect(input.setActiveTab).toHaveBeenCalledWith("codex");
    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });

  it("closes the home surface before activating a session", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectSession(
        "workspace-a",
        "thread-new",
      ),
    );

    // 与 file 激活路径对齐：首页表面必须先关闭，否则选中反馈被 home 遮罩挡住。
    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);
    const threadOrder = input.setActiveThreadId.mock.invocationCallOrder[0];
    expect(input.setHomeOpen.mock.invocationCallOrder[0]).toBeLessThan(
      threadOrder,
    );
    expect(
      input.setWorkspaceHomeWorkspaceId.mock.invocationCallOrder[0],
    ).toBeLessThan(threadOrder);
  });

  it("closes the home surface on every navigation activation including toggle-off and hint branches", () => {
    const input = { ...createInput(), activeWorkspaceId: null };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    // 普通 open action 分支。
    act(() => result.current.handleQuickSwitcherNavigate("chat"));
    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);

    // 提示分支（无 workspace 的 terminal toast）统一在入口处覆盖。
    act(() => result.current.handleQuickSwitcherNavigate("terminal"));
    expect(input.setHomeOpen).toHaveBeenCalledTimes(2);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledTimes(2);

    // wrapper 委托兜底分支（空 case）同样经入口处关闭 home。
    act(() => result.current.handleQuickSwitcherNavigate("spec"));
    expect(input.setHomeOpen).toHaveBeenCalledTimes(3);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledTimes(3);
  });

  it("opens a file against its owning workspace and routes to the main codex area", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectFile(
        "workspace-b",
        "src/Beta.ts",
      ),
    );

    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);
    expect(input.setAppMode).toHaveBeenCalledWith("chat");
    expect(input.setActiveTab).toHaveBeenCalledWith("codex");
    expect(input.selectWorkspace).toHaveBeenCalledWith("workspace-b");
    expect(input.handleOpenFile).toHaveBeenCalledWith("src/Beta.ts", undefined, {
      targetWorkspace: input.workspaces[1],
    });
  });

  it("closes the home surface before opening the file from the bootstrap shell state", () => {
    const input = { ...createInput(), activeWorkspaceId: null };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() =>
      result.current.handleQuickSwitcherSelectFile(
        "workspace-a",
        "src/Alpha.ts",
      ),
    );

    // All visibility prerequisites must settle before delegating to handleOpenFile,
    // otherwise the freshly-written file tab can remain behind the previous surface.
    const handleOpenOrder =
      input.handleOpenFile.mock.invocationCallOrder[0];
    expect(input.setHomeOpen).toHaveBeenCalledWith(false);
    expect(input.setWorkspaceHomeWorkspaceId).toHaveBeenCalledWith(null);
    expect(input.setHomeOpen.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(
      input.setWorkspaceHomeWorkspaceId.mock.invocationCallOrder[0],
    ).toBeLessThan(handleOpenOrder);
    expect(input.setAppMode.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(input.setActiveTab.mock.invocationCallOrder[0]).toBeLessThan(
      handleOpenOrder,
    );
    expect(input.selectWorkspace).toHaveBeenCalledWith("workspace-a");
    expect(input.handleOpenFile).toHaveBeenCalledWith("src/Alpha.ts", undefined, {
      targetWorkspace: input.workspaces[0],
    });
  });

  it("does not intercept Ctrl+E in compact layouts", () => {
    const input = { ...createInput(), isCompact: true };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    fireEvent.keyDown(window, { key: "e", ctrlKey: true });

    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });

  it("routes wired navigation targets to shell actions and closes the switcher", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() => result.current.handleOpenQuickSwitcher());
    act(() => result.current.handleQuickSwitcherNavigate("chat"));
    expect(input.setAppMode).toHaveBeenLastCalledWith("chat");
    expect(input.setActiveTab).toHaveBeenLastCalledWith("codex");
    expect(input.setCenterMode).toHaveBeenLastCalledWith("chat");
    expect(result.current.isQuickSwitcherOpen).toBe(false);

    act(() => result.current.handleQuickSwitcherNavigate("files"));
    expect(input.setCenterMode).toHaveBeenLastCalledWith("chat");
    expect(input.setFilePanelMode).toHaveBeenLastCalledWith("files");
    expect(input.expandRightPanel).toHaveBeenCalled();

    act(() => result.current.handleQuickSwitcherNavigate("git"));
    expect(input.setFilePanelMode).toHaveBeenLastCalledWith("git");
    expect(input.setGitPanelMode).toHaveBeenLastCalledWith("diff");

    act(() => result.current.handleQuickSwitcherNavigate("history"));
    expect(input.setAppMode).toHaveBeenLastCalledWith("gitHistory");

    act(() => result.current.handleQuickSwitcherNavigate("kanban"));
    expect(input.setAppMode).toHaveBeenLastCalledWith("kanban");

    act(() => result.current.handleQuickSwitcherNavigate("terminal"));
    expect(input.handleToggleTerminalPanel).toHaveBeenCalledTimes(1);

    act(() => result.current.handleQuickSwitcherNavigate("settings"));
    expect(input.openSettings).toHaveBeenCalledTimes(1);
  });

  it("hints with an info toast and skips the terminal toggle without an active workspace", () => {
    const input = { ...createInput(), activeWorkspaceId: null };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() => result.current.handleOpenQuickSwitcher());
    act(() => result.current.handleQuickSwitcherNavigate("terminal"));

    // D2：info toast 代替静默 no-op，且 MUST NOT 执行 toggle。
    expect(pushErrorToast).toHaveBeenCalledWith({
      variant: "info",
      title: "quickSwitcher.nav.terminal",
      message: "quickSwitcher.hints.selectWorkspaceFirst",
    });
    expect(input.handleToggleTerminalPanel).not.toHaveBeenCalled();
    // Quick Switcher 仍然关闭。
    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });

  it("delegates visual-tool targets to the downstream canonical open actions", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() => result.current.handleOpenQuickSwitcher());
    for (const target of ["spec", "intentCanvas", "projectMap"] as const) {
      act(() => result.current.handleQuickSwitcherNavigate(target));
    }

    // The base section intentionally owns no local action for these targets:
    // useAppShellLayoutNodesSection intercepts them with handleOpenSpecHub /
    // handleOpenIntentCanvas / handleOpenProjectMap ahead of this handler.
    expect(input.setAppMode).not.toHaveBeenCalled();
    expect(input.setCenterMode).not.toHaveBeenCalled();
    expect(input.setActiveTab).not.toHaveBeenCalled();
    // The switcher still closes so the composed handler only needs to fire the
    // canonical open action.
    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });

  it("delegates discovery targets to the downstream canonical open actions", () => {
    const input = createInput();
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    act(() => result.current.handleOpenQuickSwitcher());
    for (const target of ["globalSearch", "notes", "memory"] as const) {
      act(() => result.current.handleQuickSwitcherNavigate(target));
    }

    // The base section intentionally owns no local action for these targets:
    // useAppShellLayoutNodesSection intercepts them with handleOpenSearchPalette /
    // handleOpenNotes / handleOpenProjectMemory ahead of this handler.
    expect(input.setAppMode).not.toHaveBeenCalled();
    expect(input.setCenterMode).not.toHaveBeenCalled();
    expect(input.setActiveTab).not.toHaveBeenCalled();
    expect(result.current.isQuickSwitcherOpen).toBe(false);
  });

  it("maps radar running sessions into quick switcher running sessions", () => {
    const input = {
      ...createInput(),
      runningSessions: [
        {
          id: "workspace-a:thread-run",
          workspaceId: "workspace-a",
          workspaceName: "Alpha",
          threadId: "thread-run",
          threadName: "Running thread",
          engine: "codex",
          preview: "working…",
          updatedAt: 200,
          isProcessing: true,
          startedAt: 100,
        },
        {
          id: "workspace-b:thread-pending",
          workspaceId: "workspace-b",
          workspaceName: "Beta",
          threadId: "thread-pending",
          threadName: "Pending start",
          engine: "kimi",
          preview: "queued…",
          updatedAt: 300,
          isProcessing: true,
          startedAt: null,
        },
      ] as any,
    };
    const { result } = renderHook(() => useAppShellQuickSwitcherSection(input));

    expect(result.current.quickSwitcherRunningSessions).toEqual([
      {
        workspaceId: "workspace-a",
        workspaceName: "Alpha",
        threadId: "thread-run",
        threadName: "Running thread",
        engine: "codex",
        startedAt: 100,
      },
      {
        workspaceId: "workspace-b",
        workspaceName: "Beta",
        threadId: "thread-pending",
        threadName: "Pending start",
        engine: "kimi",
        // startedAt stays null when the radar entry has no start timestamp
        // yet: falling back to updatedAt would mislabel last activity as the
        // session start time.
        startedAt: null,
      },
    ]);
  });
});
