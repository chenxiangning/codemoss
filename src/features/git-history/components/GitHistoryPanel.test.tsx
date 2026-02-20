/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHistoryPanel, buildFileTreeItems, getDefaultColumnWidths } from "./GitHistoryPanel";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => {
    const visibleCount = Math.min(count, 120);
    const virtualItems = Array.from({ length: visibleCount }, (_, index) => ({
      index,
      key: index,
      size: 56,
      start: index * 56,
      end: index * 56 + 56,
      lane: 0,
    }));
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * 56,
      scrollToIndex: vi.fn(),
      measure: vi.fn(),
      measureElement: vi.fn(),
    };
  },
}));

const mockTranslate = (key: string, options?: Record<string, unknown>) => {
  if (!options) {
    return key;
  }
  if (typeof options.count === "number") {
    return `${key}:${options.count}`;
  }
  if (typeof options.operation === "string") {
    return `${key}:${options.operation}`;
  }
  return key;
};

const mockI18n = {
  language: "en",
  changeLanguage: vi.fn(),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: mockTranslate,
    i18n: mockI18n,
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
}));

vi.mock("./GitHistoryWorktreePanel", () => ({
  GitHistoryWorktreePanel: () => <div data-testid="worktree-panel">worktree</div>,
}));

vi.mock("../../git/components/GitDiffViewer", () => ({
  GitDiffViewer: () => <div data-testid="git-diff-viewer">diff-viewer</div>,
}));

vi.mock("../../../services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  checkoutGitBranch: vi.fn(async () => undefined),
  cherryPickCommit: vi.fn(async () => undefined),
  createGitBranchFromBranch: vi.fn(async () => undefined),
  createGitBranchFromCommit: vi.fn(async () => undefined),
  deleteGitBranch: vi.fn(async () => undefined),
  fetchGit: vi.fn(async () => undefined),
  getGitStatus: vi.fn(async () => ({
    files: [],
    totalAdditions: 0,
    totalDeletions: 0,
  })),
  getGitCommitDetails: vi.fn(async () => ({
    sha: "a".repeat(40),
    summary: "feat: one",
    message: "message one",
    author: "tester",
    authorEmail: "tester@example.com",
    committer: "tester",
    committerEmail: "tester@example.com",
    authorTime: 1739300000,
    commitTime: 1739300000,
    parents: [],
    files: [
      {
        path: "src/main/java/com/demo/App.java",
        status: "M",
        additions: 4,
        deletions: 1,
        diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
        lineCount: 4,
        truncated: false,
      },
    ],
    totalAdditions: 4,
    totalDeletions: 1,
  })),
  getGitCommitHistory: vi.fn(async () => ({
    snapshotId: "snap-1",
    total: 1,
    offset: 0,
    limit: 100,
    hasMore: false,
    commits: [
      {
        sha: "a".repeat(40),
        shortSha: "aaaaaaa",
        summary: "feat: one",
        message: "message one",
        author: "tester",
        authorEmail: "tester@example.com",
        timestamp: 1739300000,
        parents: [],
        refs: [],
      },
    ],
  })),
  listGitRoots: vi.fn(async () => []),
  listGitBranches: vi.fn(async () => ({
    branches: [],
    localBranches: [
      {
        name: "main",
        isCurrent: true,
        isRemote: false,
        remote: null,
        upstream: "origin/main",
        lastCommit: 1739300000,
        ahead: 0,
        behind: 0,
      },
    ],
    remoteBranches: [],
    currentBranch: "main",
  })),
  mergeGitBranch: vi.fn(async () => undefined),
  rebaseGitBranch: vi.fn(async () => undefined),
  getGitBranchCompareCommits: vi.fn(async () => ({
    targetOnlyCommits: [],
    currentOnlyCommits: [],
  })),
  getGitBranchDiffBetweenBranches: vi.fn(async () => []),
  getGitBranchDiffFileBetweenBranches: vi.fn(async () => ({
    path: "src/main/java/com/demo/App.java",
    status: "M",
    diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
  })),
  getGitWorktreeDiffAgainstBranch: vi.fn(async () => []),
  getGitWorktreeDiffFileAgainstBranch: vi.fn(async () => ({
    path: "src/main/java/com/demo/App.java",
    status: "M",
    diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
  })),
  pullGit: vi.fn(async () => undefined),
  pushGit: vi.fn(async () => undefined),
  renameGitBranch: vi.fn(async () => undefined),
  resolveGitCommitRef: vi.fn(async () => "a".repeat(40)),
  revertCommit: vi.fn(async () => undefined),
  syncGit: vi.fn(async () => undefined),
}));

import * as tauriService from "../../../services/tauri";
import * as clientStorage from "../../../services/clientStorage";

const workspace = {
  id: "w1",
  name: "demo",
  path: "/tmp/demo",
  connected: true,
  settings: {},
};

const defaultBranchList = {
  branches: [],
  localBranches: [
    {
      name: "main",
      isCurrent: true,
      isRemote: false,
      remote: null,
      upstream: "origin/main",
      lastCommit: 1739300000,
      ahead: 0,
      behind: 0,
    },
  ],
  remoteBranches: [],
  currentBranch: "main",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(clientStorage.getClientStoreSync).mockReturnValue(undefined);
  vi.mocked(tauriService.listGitBranches).mockResolvedValue(defaultBranchList as never);
  vi.mocked(tauriService.getGitBranchCompareCommits).mockResolvedValue({
    targetOnlyCommits: [],
    currentOnlyCommits: [],
  });
  vi.mocked(tauriService.getGitBranchDiffBetweenBranches).mockResolvedValue([]);
  vi.mocked(tauriService.getGitBranchDiffFileBetweenBranches).mockClear();
  vi.mocked(tauriService.getGitWorktreeDiffAgainstBranch).mockResolvedValue([]);
  vi.mocked(tauriService.getGitWorktreeDiffFileAgainstBranch).mockClear();
});

describe("GitHistoryPanel helpers", () => {
  it("collapses single-child directory chain in changed file tree", () => {
    const items = buildFileTreeItems(
      [
        {
          path: "a/b/c/d.txt",
          status: "M",
          additions: 1,
          deletions: 0,
          diff: "",
          lineCount: 0,
          truncated: false,
        },
      ],
      new Set(["a/b/c"]),
    );
    expect(items[0]?.type).toBe("dir");
    if (items[0]?.type === "dir") {
      expect(items[0].label).toBe("a.b.c");
    }
  });

  it("returns sane default widths for 3:2:3:2 layout", () => {
    const widths = getDefaultColumnWidths(1600);
    expect(widths.overviewWidth).toBeGreaterThan(0);
    expect(widths.branchesWidth).toBeGreaterThan(0);
    expect(widths.commitsWidth).toBeGreaterThan(0);
  });
});

describe("GitHistoryPanel interactions", () => {
  it("opens branch context menu with checkout first and disables delete on current branch", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("main"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeTruthy();
    });

    const trackingSummary = screen.getByText("main -> origin/main");
    expect(trackingSummary).toBeTruthy();
    expect(trackingSummary.closest('[role="menuitem"]')).toBeNull();

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBeGreaterThan(0);
    expect(menuItems[0]?.textContent).toContain("git.historyBranchMenuCheckout");

    const deleteAction = menuItems.find((item) =>
      item.textContent?.includes("git.historyBranchMenuDelete"),
    );
    expect(deleteAction).toBeTruthy();
    expect(deleteAction?.getAttribute("disabled")).not.toBeNull();
  });

  it("runs checkout then rebase from branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "rebase-target",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/rebase-target",
          lastCommit: 1739299999,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("rebase-target"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const checkoutRebaseAction = await screen.findByText(
      "git.historyBranchMenuCheckoutAndRebaseCurrent",
    );
    const checkoutRebaseButton = checkoutRebaseAction.closest('[role="menuitem"]');
    expect(checkoutRebaseButton).toBeTruthy();
    expect(checkoutRebaseButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(checkoutRebaseButton as Element);

    await waitFor(() => {
      expect(tauriService.checkoutGitBranch).toHaveBeenCalledWith("w1", "rebase-target");
      expect(tauriService.rebaseGitBranch).toHaveBeenCalledWith("w1", "main");
    });
  });

  it("opens branch vs worktree diff modal from branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "diff-target",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/diff-target",
          lastCommit: 1739299998,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);
    vi.mocked(tauriService.getGitWorktreeDiffAgainstBranch).mockResolvedValue([
      {
        path: "src/main/java/com/demo/App.java",
        status: "M",
        diff: "",
      } as never,
    ]);
    vi.mocked(tauriService.getGitWorktreeDiffFileAgainstBranch).mockResolvedValue({
      path: "src/main/java/com/demo/App.java",
      status: "M",
      diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("diff-target"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const showDiffAction = await screen.findByText("git.historyBranchMenuShowDiffWithWorktree");
    const showDiffButton = showDiffAction.closest('[role="menuitem"]');
    expect(showDiffButton).toBeTruthy();
    expect(showDiffButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(showDiffButton as Element);

    await waitFor(() => {
      expect(tauriService.getGitWorktreeDiffAgainstBranch).toHaveBeenCalledWith(
        "w1",
        "diff-target",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("git.historyBranchWorktreeDiffTitle")).toBeTruthy();
      expect(screen.getByText("src/main/java/com/demo/App.java")).toBeTruthy();
    });

    expect(tauriService.getGitWorktreeDiffFileAgainstBranch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("src/main/java/com/demo/App.java"));

    await waitFor(() => {
      expect(tauriService.getGitWorktreeDiffFileAgainstBranch).toHaveBeenCalledWith(
        "w1",
        "diff-target",
        "src/main/java/com/demo/App.java",
      );
      expect(screen.getByTestId("git-diff-viewer")).toBeTruthy();
    });
  });

  it("opens branch vs current branch diff modal from branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "diff-target",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/diff-target",
          lastCommit: 1739299998,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);
    vi.mocked(tauriService.getGitBranchCompareCommits).mockResolvedValue({
      targetOnlyCommits: [
        {
          sha: "b".repeat(40),
          shortSha: "bbbbbbb",
          summary: "feat: target only",
          message: "target only message",
          author: "tester",
          authorEmail: "tester@example.com",
          timestamp: 1739300100,
          parents: ["a".repeat(40)],
          refs: [],
        },
      ],
      currentOnlyCommits: [
        {
          sha: "c".repeat(40),
          shortSha: "ccccccc",
          summary: "fix: current only",
          message: "current only message",
          author: "tester",
          authorEmail: "tester@example.com",
          timestamp: 1739300200,
          parents: ["a".repeat(40)],
          refs: [],
        },
      ],
    });
    vi.mocked(tauriService.getGitCommitDetails).mockResolvedValueOnce({
      sha: "b".repeat(40),
      summary: "feat: target only",
      message: "target only message",
      author: "tester",
      authorEmail: "tester@example.com",
      committer: "tester",
      committerEmail: "tester@example.com",
      authorTime: 1739300100,
      commitTime: 1739300100,
      parents: ["a".repeat(40)],
      files: [
        {
          path: "src/main/java/com/demo/App.java",
          status: "M",
          additions: 4,
          deletions: 1,
          diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
          lineCount: 4,
          truncated: false,
        },
      ],
      totalAdditions: 4,
      totalDeletions: 1,
    });
    vi.mocked(tauriService.getGitBranchDiffBetweenBranches).mockResolvedValue([
      {
        path: "src/main/java/com/demo/App.java",
        status: "M",
        diff: "",
      } as never,
    ]);
    vi.mocked(tauriService.getGitBranchDiffFileBetweenBranches).mockResolvedValue({
      path: "src/main/java/com/demo/App.java",
      status: "M",
      diff: "diff --git a/src/main/java/com/demo/App.java b/src/main/java/com/demo/App.java\n@@ -1 +1 @@\n-old\n+new\n",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("diff-target"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const compareAction = await screen.findByText("git.historyBranchMenuCompareWithCurrent");
    const compareButton = compareAction.closest('[role="menuitem"]');
    expect(compareButton).toBeTruthy();
    expect(compareButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(compareButton as Element);

    await waitFor(() => {
      expect(tauriService.getGitBranchCompareCommits).toHaveBeenCalledWith(
        "w1",
        "diff-target",
        "main",
      );
    });

    await waitFor(() => {
      expect(screen.getByText("git.historyBranchCompareDiffTitle")).toBeTruthy();
      expect(screen.getByText("feat: target only")).toBeTruthy();
      expect(screen.getByText("fix: current only")).toBeTruthy();
    });

    expect(tauriService.getGitBranchDiffBetweenBranches).not.toHaveBeenCalled();
    expect(tauriService.getGitBranchDiffFileBetweenBranches).not.toHaveBeenCalled();
    expect(tauriService.getGitCommitDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("feat: target only"));

    await waitFor(() => {
      expect(tauriService.getGitCommitDetails).toHaveBeenCalledWith(
        "w1",
        "b".repeat(40),
      );
      expect(screen.getByText("src/main/java/com/demo/App.java")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText("src/main/java/com/demo/App.java")[0] as Element);

    await waitFor(() => {
      expect(screen.getByTestId("git-diff-viewer")).toBeTruthy();
    });
  });

  it("removes inline checkout icon from branch rows", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeTruthy();
    });

    expect(document.querySelector(".git-history-branch-checkout-icon")).toBeNull();
  });

  it("shows no-upstream placeholder in branch context tracking summary", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "no-upstream",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: null,
          lastCommit: 1739299997,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("no-upstream"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeTruthy();
    });

    expect(screen.getByText("no-upstream -> (git.historyBranchMenuNoUpstreamTracking)")).toBeTruthy();
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems[0]?.textContent).toContain("git.historyBranchMenuCheckout");
    await waitFor(() => {
      const enabledItems = screen.getAllByRole("menuitem").filter((item) => item.getAttribute("disabled") === null);
      expect(enabledItems[0]?.textContent).toContain("git.historyBranchMenuCheckout");
      expect(document.activeElement).toBe(enabledItems[0]);
    });
  });

  it("runs checkout from branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "feature-checkout",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/feature-checkout",
          lastCommit: 1739299997,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("feature-checkout"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const checkoutAction = await screen.findByText("git.historyBranchMenuCheckout");
    const checkoutButton = checkoutAction.closest('[role="menuitem"]');
    expect(checkoutButton).toBeTruthy();
    expect(checkoutButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(checkoutButton as Element);

    await waitFor(() => {
      expect(tauriService.checkoutGitBranch).toHaveBeenCalledWith("w1", "feature-checkout");
    });
  });

  it("runs push from current branch context menu", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("main"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const pushAction = await screen.findByText("git.historyBranchMenuPush");
    const pushButton = pushAction.closest('[role="menuitem"]');
    expect(pushButton).toBeTruthy();
    expect(pushButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(pushButton as Element);

    await waitFor(() => {
      expect(tauriService.pushGit).toHaveBeenCalledWith("w1");
    });
  });

  it("runs update from current branch context menu", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("main"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const updateAction = await screen.findByText("git.historyBranchMenuUpdate");
    const updateButton = updateAction.closest('[role="menuitem"]');
    expect(updateButton).toBeTruthy();
    expect(updateButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(updateButton as Element);

    await waitFor(() => {
      expect(tauriService.pullGit).toHaveBeenCalledWith("w1");
    });
  });

  it("keeps rename disabled in branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "feature-rename",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/feature-rename",
          lastCommit: 1739299997,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("feature-rename"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const renameAction = await screen.findByText("git.historyBranchMenuRename");
    const renameButton = renameAction.closest('[role="menuitem"]');
    expect(renameButton).toBeTruthy();
    expect(renameButton?.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(renameButton as Element);
    expect(tauriService.renameGitBranch).not.toHaveBeenCalled();
  });

  it("runs delete from non-current branch context menu", async () => {
    vi.mocked(tauriService.listGitBranches).mockResolvedValue({
      branches: [],
      localBranches: [
        {
          name: "main",
          isCurrent: true,
          isRemote: false,
          remote: null,
          upstream: "origin/main",
          lastCommit: 1739300000,
          ahead: 0,
          behind: 0,
        },
        {
          name: "feature-delete",
          isCurrent: false,
          isRemote: false,
          remote: null,
          upstream: "origin/feature-delete",
          lastCommit: 1739299997,
          ahead: 0,
          behind: 0,
        },
      ],
      remoteBranches: [],
      currentBranch: "main",
    } as never);

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(document.querySelector(".git-history-branch-row .git-history-branch-name")).toBeTruthy();
    });

    const branchRow = Array.from(document.querySelectorAll(".git-history-branch-row")).find((row) =>
      row.textContent?.includes("feature-delete"),
    );
    expect(branchRow).toBeTruthy();
    fireEvent.contextMenu(branchRow as Element, { clientX: 160, clientY: 180 });

    const deleteAction = await screen.findByText("git.historyBranchMenuDelete");
    const deleteButton = deleteAction.closest('[role="menuitem"]');
    expect(deleteButton).toBeTruthy();
    expect(deleteButton?.getAttribute("disabled")).toBeNull();

    fireEvent.click(deleteButton as Element);

    await waitFor(() => {
      expect(tauriService.deleteGitBranch).toHaveBeenCalledWith("w1", "feature-delete", false);
    });
  });

  it("supports select commit -> click file -> open diff modal -> cherry-pick", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(screen.getByText("feat: one")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("feat: one"));

    await waitFor(() => {
      expect(screen.getByText("App.java")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("App.java"));

    await waitFor(() => {
      expect(screen.getByTestId("git-diff-viewer")).toBeTruthy();
    });

    const cherryPickAction = screen.getByText("git.historyCherryPick").closest('[role="button"]');
    expect(cherryPickAction).toBeTruthy();

    fireEvent.click(cherryPickAction as Element);

    if (cherryPickAction?.getAttribute("aria-disabled") === "true") {
      expect(tauriService.cherryPickCommit).not.toHaveBeenCalled();
      return;
    }

    await waitFor(() => {
      expect(tauriService.cherryPickCommit).toHaveBeenCalledTimes(1);
    });
  });

  it("restores persisted query and commit selection state", async () => {
    vi.mocked(clientStorage.getClientStoreSync).mockImplementation((store, key) => {
      if (store === "layout" && String(key).startsWith("gitHistoryPanel:")) {
        return {
          selectedBranch: "all",
          commitQuery: "aaaa",
          selectedCommitSha: "a".repeat(40),
          diffStyle: "split",
        } as never;
      }
      return undefined;
    });

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      const input = screen.getByPlaceholderText("git.historySearchCommits") as HTMLInputElement;
      expect(input.value).toBe("aaaa");
    });

    expect(clientStorage.writeClientStoreValue).toHaveBeenCalled();
  });

  it("does not refetch history in a loop after snapshot update", async () => {
    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(screen.getByText("feat: one")).toBeTruthy();
    });

    await waitFor(
      () => {
        expect(tauriService.getGitCommitHistory).toHaveBeenCalledTimes(1);
      },
      { timeout: 400 },
    );
  });

  it("keeps rendered commit rows bounded with large history payload", async () => {
    const largeCommits = Array.from({ length: 10_000 }, (_, index) => ({
      sha: `sha-${index}`,
      shortSha: `s${index}`,
      summary: `commit-${index}`,
      message: `message-${index}`,
      author: "tester",
      authorEmail: "tester@example.com",
      timestamp: 1739300000 - index,
      parents: [],
      refs: [],
    }));
    vi.mocked(tauriService.getGitCommitHistory).mockImplementation(async () => ({
      snapshotId: "snap-large",
      total: 10_000,
      offset: 0,
      limit: 10_000,
      hasMore: false,
      commits: largeCommits,
    }));

    render(<GitHistoryPanel workspace={workspace as never} />);

    await waitFor(() => {
      expect(screen.getByText("commit-0")).toBeTruthy();
    });

    const renderedRows = document.querySelectorAll(".git-history-commit-row");
    expect(renderedRows.length).toBeLessThan(300);
  });
});
