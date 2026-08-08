// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import type { GitRepositorySummary } from "../../../types";
import type { FileTreeNode } from "./fileTreePanelInternals";
import {
  FileTreeNodeBranch,
  type FileTreeRowHandlers,
  type FileTreeRowRefs,
  type FileTreeRowState,
} from "./FileTreeRows";

const repository: GitRepositorySummary = {
  repositoryRoot: "services/api",
  displayName: "api",
  currentBranch: "main",
  headState: "branch",
  upstream: "origin/main",
  ahead: 1,
  behind: 0,
  stagedCount: 0,
  modifiedCount: 2,
  untrackedCount: 0,
  conflictedCount: 0,
  fileStatuses: [],
  isClean: false,
  error: null,
};

function folderNode(name: string, path: string): FileTreeNode {
  return { name, path, type: "folder", children: [] };
}

function fileNode(name: string, path: string): FileTreeNode {
  return { name, path, type: "file", children: [] };
}

function emptyState(
  overrides?: Partial<FileTreeRowState>,
): FileTreeRowState {
  return {
    expandedFolders: new Set(),
    loadingLazyDirectories: new Set(),
    lazyDirectoryLoadErrors: new Map(),
    folderGitStatusMap: new Map(),
    gitStatusMap: new Map(),
    mergedGitignoredDirectories: new Set(),
    mergedGitignoredFiles: new Set(),
    gitignoredTreeNodeMap: new Map(),
    selectedNodePaths: new Set(),
    selectedNodePath: null,
    orderedSelectedNodePaths: [],
    repositorySummaryMap: new Map(),
    ...overrides,
  };
}

function baseHandlers(
  overrides?: Partial<FileTreeRowHandlers>,
): FileTreeRowHandlers {
  return {
    setRangeSelection: vi.fn(),
    togglePathSelection: vi.fn(),
    setSingleSelection: vi.fn(),
    setSelectedNodePath: vi.fn(),
    setSelectedNodeType: vi.fn(),
    toggleFolderExpandedState: vi.fn(),
    loadLazyDirectoryChildren: vi.fn(),
    openPreview: vi.fn(),
    showContextMenu: vi.fn(),
    resolvePath: (path) => `/repo/${path}`,
    broadcastCrossWindowTreeDrag: vi.fn(),
    rebroadcastCrossWindowTreeDrag: vi.fn(),
    ...overrides,
  };
}

const emptyRefs: FileTreeRowRefs = {
  activeCrossWindowDragPathsRef: { current: [] },
  lastCrossWindowDragBroadcastRef: { current: 0 },
  dragImageCleanupRef: { current: null },
};

describe("FileTreeRows repository decoration", () => {
  it("decorates only the exact nested repository folder", () => {
    const state = emptyState({
      repositorySummaryMap: new Map([[repository.repositoryRoot, repository]]),
    });
    const handlers = baseHandlers();
    const { container } = render(
      <>
        <FileTreeNodeBranch
          node={folderNode("services", "services")}
          depth={1}
          state={state}
          handlers={handlers}
          refs={emptyRefs}
          t={((key: string) => key) as TFunction}
        />
        <FileTreeNodeBranch
          node={folderNode("api", "services/api")}
          depth={2}
          state={state}
          handlers={handlers}
          refs={emptyRefs}
          t={((key: string) => key) as TFunction}
        />
      </>,
    );

    expect(container.querySelectorAll(".file-tree-row.is-git-repository")).toHaveLength(1);
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getByText("M2")).toBeTruthy();
  });
});

describe("FileTreeRows open in browser action", () => {
  it("shows browser action for HTML files and invokes handler", () => {
    const onOpenInBrowser = vi.fn();
    const handlers = baseHandlers({ onOpenInBrowser });
    const { container } = render(
      <FileTreeNodeBranch
        node={fileNode("demo.html", "docs/demo.html")}
        depth={1}
        state={emptyState()}
        handlers={handlers}
        refs={emptyRefs}
        t={((key: string) => key) as TFunction}
      />,
    );

    const browserButton = container.querySelector(
      ".file-tree-action--browser",
    ) as HTMLButtonElement | null;
    expect(browserButton).toBeTruthy();
    fireEvent.click(browserButton!);
    expect(onOpenInBrowser).toHaveBeenCalledWith("docs/demo.html");
  });

  it("hides browser action for non-html files", () => {
    const handlers = baseHandlers({ onOpenInBrowser: vi.fn() });
    const { container } = render(
      <FileTreeNodeBranch
        node={fileNode("main.ts", "src/main.ts")}
        depth={1}
        state={emptyState()}
        handlers={handlers}
        refs={emptyRefs}
        t={((key: string) => key) as TFunction}
      />,
    );

    expect(container.querySelector(".file-tree-action--browser")).toBeNull();
    expect(container.querySelector(".file-tree-action--mention")).toBeTruthy();
  });
});
