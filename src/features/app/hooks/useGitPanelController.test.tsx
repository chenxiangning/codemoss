// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { GIT_GRAPH_TAB_ID, getFileHistoryTabId } from "../../git-history/types";
import { useGitPanelController } from "./useGitPanelController";

const useGitDiffsMock = vi.fn();
const useGitStatusMock = vi.fn();
const useGitLogMock = vi.fn();
const useGitCommitDiffsMock = vi.fn();

vi.mock("../../git/hooks/useGitDiffs", () => ({
  useGitDiffs: (...args: unknown[]) => useGitDiffsMock(...args),
}));

vi.mock("../../git/hooks/useGitStatus", () => ({
  useGitStatus: (...args: unknown[]) => useGitStatusMock(...args),
}));

vi.mock("../../git/hooks/useGitLog", () => ({
  useGitLog: (...args: unknown[]) => useGitLogMock(...args),
}));

vi.mock("../../git/hooks/useGitCommitDiffs", () => ({
  useGitCommitDiffs: (...args: unknown[]) => useGitCommitDiffsMock(...args),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "ccgui",
  path: "/tmp/mossx",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const secondaryWorkspace: WorkspaceInfo = {
  id: "workspace-2",
  name: "docs",
  path: "/tmp/docs",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function makeProps(overrides?: Partial<Parameters<typeof useGitPanelController>[0]>) {
  return {
    activeWorkspace: workspace,
    gitDiffPreloadEnabled: false,
    isCompact: false,
    isTablet: false,
    rightPanelCollapsed: false,
    activeTab: "codex" as const,
    tabletTab: "codex" as const,
    setActiveTab: vi.fn(),
    prDiffs: [],
    prDiffsLoading: false,
    prDiffsError: null,
    ...overrides,
  };
}

function getLastEnabledArg() {
  const { calls } = useGitDiffsMock.mock;
  if (calls.length === 0) {
    return undefined;
  }
  return calls[calls.length - 1]?.[2];
}

function getLastGitStatusPollingMode() {
  const { calls } = useGitStatusMock.mock;
  if (calls.length === 0) {
    return undefined;
  }
  const options = calls[calls.length - 1]?.[1] as
    | { pollingMode?: "active" | "background" | "paused" }
    | undefined;
  return options?.pollingMode;
}

function makeGitStatusWithFiles(fileCount: number) {
  const files = Array.from({ length: fileCount }, (_, index) => ({
    path: `src/file-${index}.ts`,
    status: "M",
    additions: 1,
    deletions: 0,
  }));
  return {
    branchName: "main",
    files,
    stagedFiles: files,
    unstagedFiles: [],
    totalAdditions: fileCount,
    totalDeletions: 0,
  };
}

beforeEach(() => {
  useGitStatusMock.mockReturnValue({
    status: {
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    },
    refresh: vi.fn(),
  });
  useGitDiffsMock.mockReturnValue({
    diffs: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });
  useGitLogMock.mockReturnValue({
    entries: [],
    total: 0,
    ahead: 0,
    behind: 0,
    aheadEntries: [],
    behindEntries: [],
    upstream: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  });
  useGitCommitDiffsMock.mockReturnValue({
    diffs: [],
    isLoading: false,
    error: null,
  });
  useGitDiffsMock.mockClear();
  useGitStatusMock.mockClear();
  useGitLogMock.mockClear();
  useGitCommitDiffsMock.mockClear();
});

describe("useGitPanelController git status polling visibility", () => {
  it("uses active polling when file panel is visible", () => {
    renderHook(() => useGitPanelController(makeProps()));

    expect(getLastGitStatusPollingMode()).toBe("active");
  });

  it("uses background polling when right panel is collapsed", () => {
    renderHook(() =>
      useGitPanelController(
        makeProps({
          rightPanelCollapsed: true,
        }),
      ),
    );

    expect(getLastGitStatusPollingMode()).toBe("background");
  });

  it("switches to active polling when right panel expands", () => {
    const { rerender } = renderHook(
      (props: Parameters<typeof useGitPanelController>[0]) =>
        useGitPanelController(props),
      {
        initialProps: makeProps({
          rightPanelCollapsed: true,
        }),
      },
    );

    expect(getLastGitStatusPollingMode()).toBe("background");

    rerender(
      makeProps({
        rightPanelCollapsed: false,
      }),
    );
    expect(getLastGitStatusPollingMode()).toBe("active");
  });

  it("uses active polling in compact git tab", () => {
    renderHook(() =>
      useGitPanelController(
        makeProps({
          isCompact: true,
          activeTab: "git",
          tabletTab: "git",
        }),
      ),
    );

    expect(getLastGitStatusPollingMode()).toBe("active");
  });

  it("uses background polling in kanban appMode even when right panel is expanded", () => {
    renderHook(() =>
      useGitPanelController(
        makeProps({
          appMode: "kanban",
          rightPanelCollapsed: false,
        }),
      ),
    );

    expect(getLastGitStatusPollingMode()).toBe("background");
  });

  it("uses background polling in extensions appMode", () => {
    renderHook(() =>
      useGitPanelController(
        makeProps({
          appMode: "extensions",
        }),
      ),
    );

    expect(getLastGitStatusPollingMode()).toBe("background");
  });
});

describe("useGitPanelController preload behavior", () => {
  it("does not preload diffs when disabled and panel is hidden", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    const initialEnabled = getLastEnabledArg();
    expect(initialEnabled).toBe(true);

    act(() => {
      result.current.setGitPanelMode("issues");
    });

    const lastEnabled = getLastEnabledArg();
    expect(lastEnabled).toBe(false);
  });

  it("loads diffs when the panel becomes visible even if preload is disabled", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.setGitPanelMode("issues");
    });

    const hiddenEnabled = getLastEnabledArg();
    expect(hiddenEnabled).toBe(false);

    act(() => {
      result.current.setGitPanelMode("diff");
    });

    const visibleEnabled = getLastEnabledArg();
    expect(visibleEnabled).toBe(true);
  });

  it("skips background preload when changed files are too many", () => {
    useGitStatusMock.mockReturnValue({
      status: makeGitStatusWithFiles(120),
      refresh: vi.fn(),
    });
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          gitDiffPreloadEnabled: true,
        }),
      ),
    );

    act(() => {
      result.current.setGitPanelMode("issues");
    });

    const lastEnabled = getLastEnabledArg();
    expect(lastEnabled).toBe(false);
  });
});

describe("useGitPanelController editor tabs", () => {
  it("opens a search result in its explicit target workspace tab state", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }) =>
        useGitPanelController(makeProps({ activeWorkspace })),
      { initialProps: { activeWorkspace: workspace } },
    );

    act(() => {
      result.current.handleOpenFile("src/ApiController.ts", undefined, {
        targetWorkspace: secondaryWorkspace,
      });
    });

    expect(result.current.openFileTabs).toEqual([]);
    rerender({ activeWorkspace: secondaryWorkspace });
    expect(result.current.openFileTabs).toEqual(["src/ApiController.ts"]);
    expect(result.current.activeEditorFilePath).toBe("src/ApiController.ts");
  });

  it("opens multiple files as tabs instead of replacing current file", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");
    expect(result.current.centerMode).toBe("editor");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("requests the desktop editor layout when opening a file", () => {
    const onOpenEditorLayoutRequest = vi.fn();
    const { result } = renderHook(() =>
      useGitPanelController(makeProps({ onOpenEditorLayoutRequest })),
    );

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
    });

    expect(onOpenEditorLayoutRequest).toHaveBeenCalledTimes(1);
    expect(result.current.centerMode).toBe("editor");
  });

  it("does not request desktop editor layout in compact mode", () => {
    const onOpenEditorLayoutRequest = vi.fn();
    const setActiveTab = vi.fn();
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          isCompact: true,
          onOpenEditorLayoutRequest,
          setActiveTab,
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
    });

    expect(onOpenEditorLayoutRequest).not.toHaveBeenCalled();
    expect(setActiveTab).toHaveBeenCalledWith("codex");
    expect(result.current.centerMode).toBe("editor");
  });

  it("re-activates existing tab without creating duplicates", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
      result.current.handleOpenFile("src/App.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/App.tsx");
  });

  it("closes active tab and falls back to adjacent tab", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
      result.current.handleOpenFile("src/types.ts");
    });

    act(() => {
      result.current.handleCloseFileTab("src/main.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/types.ts"]);
    expect(result.current.activeEditorFilePath).toBe("src/types.ts");
  });

  it("closes other tabs atomically and activates the retained target", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
      result.current.handleOpenFile("src/types.ts");
    });

    act(() => {
      result.current.handleCloseOtherFileTabs("src/main.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");
    expect(result.current.centerMode).toBe("editor");
  });

  it("ignores close-other for an unknown tab", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
    });

    act(() => {
      result.current.handleCloseOtherFileTabs("src/unknown.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");
  });

  it("reorders tabs without changing the active file", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
      result.current.handleOpenFile("src/types.ts");
    });

    act(() => {
      result.current.handleReorderFileTabs([
        "src/types.ts",
        "src/App.tsx",
        "src/main.tsx",
      ]);
    });

    expect(result.current.openFileTabs).toEqual([
      "src/types.ts",
      "src/App.tsx",
      "src/main.tsx",
    ]);
    expect(result.current.activeEditorFilePath).toBe("src/types.ts");
  });

  it("ignores reorder input that is not a permutation of the open tabs", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
    });

    act(() => {
      // Missing a tab / introduces an unknown path — must be rejected.
      result.current.handleReorderFileTabs(["src/App.tsx", "src/unknown.ts"]);
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
  });

  it("returns to chat mode after closing the last tab", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
    });

    act(() => {
      result.current.handleCloseFileTab("src/App.tsx");
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("chat");
  });

  it("returns to Project Map after closing the last Project Map evidence file", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("docs/readme.md", { line: 5, column: 1 }, {
        editorSplitCompanion: "projectMap",
      });
    });

    act(() => {
      result.current.handleCloseFileTab("docs/readme.md");
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("projectMap");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("returns to Project Map after closing all Project Map evidence files", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("docs/readme.md", undefined, {
        editorSplitCompanion: "projectMap",
      });
      result.current.handleOpenFile("docs/spec.md", undefined, {
        editorSplitCompanion: "projectMap",
      });
    });

    act(() => {
      result.current.handleCloseAllFileTabs();
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("projectMap");
  });

  it("returns to notes after closing the last source-origin file", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile(
        "src/App.tsx",
        { line: 21, endLine: 37, column: 1, scrollPosition: "center" },
        { editorSplitCompanion: "notes" },
      );
    });

    expect(result.current.centerMode).toBe("editor");
    expect(result.current.editorSplitCompanion).toBe("notes");
    expect(result.current.editorNavigationTarget).toMatchObject({
      path: "src/App.tsx",
      line: 21,
      endLine: 37,
      column: 1,
      scrollPosition: "center",
    });

    act(() => {
      result.current.handleCloseFileTab("src/App.tsx");
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("notes");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("returns to notes when exiting a source-origin editor", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx", undefined, {
        editorSplitCompanion: "notes",
      });
    });

    act(() => {
      result.current.handleExitEditor();
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("notes");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("keeps ordinary file navigation on the chat companion", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/FromNote.tsx", undefined, {
        editorSplitCompanion: "notes",
      });
      result.current.handleOpenFile("src/FromTree.tsx");
    });

    expect(result.current.centerMode).toBe("editor");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("stores temporary change highlights when opening a file from activity", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile(
        "src/App.tsx",
        { line: 12, column: 1 },
        {
          highlightMarkers: {
            added: [12],
            modified: [14, 15],
          },
        },
      );
    });

    expect(result.current.activeEditorFilePath).toBe("src/App.tsx");
    expect(result.current.editorNavigationTarget).toMatchObject({
      path: "src/App.tsx",
      line: 12,
      column: 1,
    });
    expect(result.current.editorHighlightTarget).toEqual({
      path: "src/App.tsx",
      markers: {
        added: [12],
        modified: [14, 15],
      },
    });
  });

  it("tracks Project Map as the editor companion for evidence file navigation", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("docs/readme.md", { line: 3, column: 1 }, {
        editorSplitCompanion: "projectMap",
      });
    });

    expect(result.current.centerMode).toBe("editor");
    expect(result.current.editorSplitCompanion).toBe("projectMap");

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
    });

    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("normalizes absolute workspace file paths when opening from activity", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile(
        "/tmp/mossx/src/test/java/com/example/demo/LogControllerTest.java",
        { line: 8, column: 1 },
        {
          highlightMarkers: {
            added: [8],
            modified: [10],
          },
        },
      );
    });

    expect(result.current.openFileTabs).toEqual([
      "src/test/java/com/example/demo/LogControllerTest.java",
    ]);
    expect(result.current.activeEditorFilePath).toBe(
      "src/test/java/com/example/demo/LogControllerTest.java",
    );
    expect(result.current.editorNavigationTarget).toMatchObject({
      path: "src/test/java/com/example/demo/LogControllerTest.java",
      line: 8,
      column: 1,
    });
    expect(result.current.editorHighlightTarget).toEqual({
      path: "src/test/java/com/example/demo/LogControllerTest.java",
      markers: {
        added: [8],
        modified: [10],
      },
    });
  });

  it("normalizes Windows workspace file paths case-insensitively", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            path: "C:/Users/Chen/Project",
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("c:/users/chen/project/src/App.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/App.tsx");
  });

  it("keeps workspace-relative file tree paths unchanged when a nested git root is configured", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            path: "/tmp/ER-QI",
            settings: {
              ...workspace.settings,
              gitRoot: "ftrd-docs",
            },
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("ftrd-docs/二期文档/接口文档.md");
    });

    expect(result.current.openFileTabs).toEqual([
      "ftrd-docs/二期文档/接口文档.md",
    ]);
    expect(result.current.activeEditorFilePath).toBe(
      "ftrd-docs/二期文档/接口文档.md",
    );
  });

  it("maps repo-relative git paths to workspace-relative paths for nested git roots", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            path: "/tmp/ER-QI",
            settings: {
              ...workspace.settings,
              gitRoot: "ftrd-docs",
            },
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("二期文档/接口文档.md", undefined, {
        pathDomain: "git",
      });
    });

    expect(result.current.openFileTabs).toEqual([
      "ftrd-docs/二期文档/接口文档.md",
    ]);
    expect(result.current.activeEditorFilePath).toBe(
      "ftrd-docs/二期文档/接口文档.md",
    );
  });

  it("uses an explicit repository root for same-named multi-repository files", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            path: "/tmp/ER-QI",
            settings: {
              ...workspace.settings,
              gitRoot: "repo-a",
            },
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("pom.xml", undefined, {
        pathDomain: "git",
        repositoryRoot: "repo-a",
      });
      result.current.handleOpenFile("pom.xml", undefined, {
        pathDomain: "git",
        repositoryRoot: "repo-b",
      });
    });

    expect(result.current.openFileTabs).toEqual([
      "repo-a/pom.xml",
      "repo-b/pom.xml",
    ]);
    expect(result.current.activeEditorFilePath).toBe("repo-b/pom.xml");
  });

  it("preserves an explicit workspace-root repository over configured nested git root", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            path: "/tmp/ER-QI",
            settings: {
              ...workspace.settings,
              gitRoot: "repo-a",
            },
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile("pom.xml", undefined, {
        pathDomain: "git",
        repositoryRoot: "",
      });
    });

    expect(result.current.openFileTabs).toEqual(["pom.xml"]);
    expect(result.current.activeEditorFilePath).toBe("pom.xml");
  });

  it("does not prefix git paths when the workspace is the repository root", () => {
    const { result } = renderHook(() =>
      useGitPanelController(
        makeProps({
          activeWorkspace: {
            ...workspace,
            name: "springboot-demo",
            path: "/tmp/springboot-demo",
            settings: {
              ...workspace.settings,
              gitRoot: "/tmp/springboot-demo",
            },
          },
        }),
      ),
    );

    act(() => {
      result.current.handleOpenFile(
        "src/main/java/com/example/demo/logging/Field.java",
        undefined,
        { pathDomain: "git" },
      );
    });

    expect(result.current.openFileTabs).toEqual([
      "src/main/java/com/example/demo/logging/Field.java",
    ]);
    expect(result.current.activeEditorFilePath).toBe(
      "src/main/java/com/example/demo/logging/Field.java",
    );
  });

  it("restores open file tabs when switching back to a workspace", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitPanelController(makeProps({ activeWorkspace })),
      { initialProps: { activeWorkspace: workspace } },
    );

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");

    act(() => {
      rerender({ activeWorkspace: secondaryWorkspace });
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();
    expect(result.current.centerMode).toBe("chat");

    act(() => {
      result.current.handleOpenFile("README.md");
    });

    expect(result.current.openFileTabs).toEqual(["README.md"]);
    expect(result.current.activeEditorFilePath).toBe("README.md");

    act(() => {
      rerender({ activeWorkspace: workspace });
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");
    expect(result.current.centerMode).toBe("editor");
  });

  it("does not leak a note companion into another workspace", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitPanelController(makeProps({ activeWorkspace })),
      { initialProps: { activeWorkspace: workspace } },
    );

    act(() => {
      result.current.handleOpenFile("src/App.tsx", undefined, {
        editorSplitCompanion: "notes",
      });
    });

    expect(result.current.editorSplitCompanion).toBe("notes");

    act(() => {
      rerender({ activeWorkspace: secondaryWorkspace });
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.centerMode).toBe("chat");
    expect(result.current.editorSplitCompanion).toBe("chat");
  });

  it("clears only the active workspace tabs when closing all files", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitPanelController(makeProps({ activeWorkspace })),
      { initialProps: { activeWorkspace: workspace } },
    );

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
      result.current.handleOpenFile("src/main.tsx");
    });

    act(() => {
      rerender({ activeWorkspace: secondaryWorkspace });
    });

    act(() => {
      result.current.handleOpenFile("README.md");
      result.current.handleCloseAllFileTabs();
    });

    expect(result.current.openFileTabs).toEqual([]);
    expect(result.current.activeEditorFilePath).toBeNull();

    act(() => {
      rerender({ activeWorkspace: workspace });
    });

    expect(result.current.openFileTabs).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/main.tsx");
  });
});

describe("useGitPanelController file compare", () => {
  it("opens workspace compare without changing editor tabs", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenFile("src/App.tsx");
    });

    let opened = false;
    act(() => {
      opened = result.current.handleOpenWorkspaceFileCompare([
        "/tmp/mossx/src/a.ts",
        "src/b.ts",
      ]);
    });

    expect(opened).toBe(true);
    expect(result.current.centerMode).toBe("fileCompare");
    expect(result.current.fileCompareSession).toEqual({
      kind: "workspace",
      workspaceId: "workspace-1",
      paths: ["src/a.ts", "src/b.ts"],
    });
    expect(result.current.openFileTabs).toEqual(["src/App.tsx"]);
    expect(result.current.activeEditorFilePath).toBe("src/App.tsx");
  });

  it("opens scratch compare as a fresh center surface", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    act(() => {
      result.current.handleOpenScratchFileCompare();
    });

    expect(result.current.centerMode).toBe("fileCompare");
    expect(result.current.fileCompareSession).toEqual({
      kind: "scratch",
      requestId: 1,
    });
  });

  it("clears compare session when switching to a workspace with editor tabs", () => {
    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitPanelController(makeProps({ activeWorkspace })),
      { initialProps: { activeWorkspace: workspace } },
    );

    act(() => {
      rerender({ activeWorkspace: secondaryWorkspace });
    });

    act(() => {
      result.current.handleOpenFile("README.md");
    });

    act(() => {
      rerender({ activeWorkspace: workspace });
    });

    act(() => {
      result.current.handleOpenWorkspaceFileCompare(["src/a.ts", "src/b.ts"]);
    });

    expect(result.current.centerMode).toBe("fileCompare");
    expect(result.current.fileCompareSession).not.toBeNull();

    act(() => {
      rerender({ activeWorkspace: secondaryWorkspace });
    });

    expect(result.current.centerMode).toBe("editor");
    expect(result.current.fileCompareSession).toBeNull();
    expect(result.current.activeEditorFilePath).toBe("README.md");
  });

  it("rejects unsupported workspace compare path counts", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));

    expect(result.current.handleOpenWorkspaceFileCompare(["a.ts"])).toBe(false);
    expect(
      result.current.handleOpenWorkspaceFileCompare([
        "a.ts",
        "b.ts",
        "c.ts",
        "d.ts",
        "e.ts",
      ]),
    ).toBe(false);
    expect(result.current.centerMode).toBe("chat");
    expect(result.current.fileCompareSession).toBeNull();
  });
});

describe("useGitPanelController file history", () => {
  it("opens, deduplicates, switches, and closes Git Graph file history tabs", () => {
    const onOpenGitHistoryRequest = vi.fn();
    const { result } = renderHook(() => useGitPanelController(makeProps({
      onOpenGitHistoryRequest,
    })));
    const firstTarget = {
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      repositoryRoot: "",
      path: "src/a.ts",
      displayPath: "src/a.ts",
    };

    act(() => result.current.handleOpenFileHistory(firstTarget));
    expect(result.current.fileHistoryTabs).toEqual([firstTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(firstTarget));
    expect(onOpenGitHistoryRequest).toHaveBeenCalledTimes(1);

    act(() => result.current.handleOpenFileHistory(firstTarget));
    expect(result.current.fileHistoryTabs).toEqual([firstTarget]);

    const secondTarget = { ...firstTarget, path: "src/b.ts", displayPath: "src/b.ts" };
    act(() => result.current.handleOpenFileHistory(secondTarget));
    expect(result.current.fileHistoryTabs).toEqual([firstTarget, secondTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(secondTarget));

    act(() => result.current.handleCloseFileHistory(getFileHistoryTabId(secondTarget)));
    expect(result.current.fileHistoryTabs).toEqual([firstTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(firstTarget));

    act(() => result.current.handleCloseFileHistory(getFileHistoryTabId(firstTarget)));
    expect(result.current.fileHistoryTabs).toEqual([]);
    expect(result.current.activeGitHistoryTabId).toBe(GIT_GRAPH_TAB_ID);
  });

  it("keeps tabs when another center surface opens and supports inactive close", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));
    const firstTarget = {
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      repositoryRoot: "",
      path: "README.md",
      displayPath: "README.md",
    };
    const secondTarget = {
      ...firstTarget,
      repositoryRoot: "nested",
      path: "README.md",
      displayPath: "nested/README.md",
    };
    act(() => result.current.handleOpenFileHistory(firstTarget));
    act(() => result.current.handleOpenFileHistory(secondTarget));
    act(() => result.current.handleOpenFile("src/App.tsx"));

    expect(result.current.centerMode).toBe("editor");
    expect(result.current.fileHistoryTabs).toEqual([firstTarget, secondTarget]);

    act(() => result.current.handleCloseFileHistory(getFileHistoryTabId(firstTarget)));
    expect(result.current.fileHistoryTabs).toEqual([secondTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(secondTarget));
  });

  it("falls back to the right adjacent file tab when closing the first active tab", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));
    const firstTarget = {
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      repositoryRoot: "",
      path: "src/a.ts",
      displayPath: "src/a.ts",
    };
    const secondTarget = { ...firstTarget, path: "src/b.ts", displayPath: "src/b.ts" };

    act(() => result.current.handleOpenFileHistory(firstTarget));
    act(() => result.current.handleOpenFileHistory(secondTarget));
    act(() => result.current.handleActivateGitHistoryTab(getFileHistoryTabId(firstTarget)));
    act(() => result.current.handleCloseFileHistory(getFileHistoryTabId(firstTarget)));

    expect(result.current.fileHistoryTabs).toEqual([secondTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(secondTarget));
  });

  it("closes other or all file history tabs atomically", () => {
    const { result } = renderHook(() => useGitPanelController(makeProps()));
    const firstTarget = {
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      repositoryRoot: "",
      path: "src/a.ts",
      displayPath: "src/a.ts",
    };
    const secondTarget = { ...firstTarget, path: "src/b.ts", displayPath: "src/b.ts" };
    const thirdTarget = { ...firstTarget, path: "src/c.ts", displayPath: "src/c.ts" };

    act(() => result.current.handleOpenFileHistory(firstTarget));
    act(() => result.current.handleOpenFileHistory(secondTarget));
    act(() => result.current.handleOpenFileHistory(thirdTarget));
    act(() => result.current.handleCloseOtherFileHistories(getFileHistoryTabId(secondTarget)));

    expect(result.current.fileHistoryTabs).toEqual([secondTarget]);
    expect(result.current.activeGitHistoryTabId).toBe(getFileHistoryTabId(secondTarget));

    act(() => result.current.handleOpenFileHistory(firstTarget));
    act(() => result.current.handleCloseAllFileHistories());

    expect(result.current.fileHistoryTabs).toEqual([]);
    expect(result.current.activeGitHistoryTabId).toBe(GIT_GRAPH_TAB_ID);
  });
});
