import { describe, expect, it } from "vitest";
import type { WorkspaceInfo } from "../../types";
import {
  resolveNextWorkspaceThreadListHydrationId,
  resolveWorkspaceProjectionOwnerIds,
  shouldSkipWorkspaceThreadListLoad,
} from "./workspaceThreadListLoadGuard";

const workspace = (id: string, connected = true): WorkspaceInfo => ({
  id,
  name: id,
  path: `/tmp/${id}`,
  connected,
  settings: { sidebarCollapsed: false },
});

describe("shouldSkipWorkspaceThreadListLoad", () => {
  it("skips auto reload after the workspace thread list has already hydrated", () => {
    expect(
      shouldSkipWorkspaceThreadListLoad({
        isLoading: false,
        hasHydratedThreadList: true,
      }),
    ).toBe(true);
  });

  it("still blocks duplicate in-flight loads", () => {
    expect(
      shouldSkipWorkspaceThreadListLoad({
        isLoading: true,
        hasHydratedThreadList: false,
      }),
    ).toBe(true);
  });

  it("allows force reload even after hydration", () => {
    expect(
      shouldSkipWorkspaceThreadListLoad({
        force: true,
        isLoading: false,
        hasHydratedThreadList: true,
      }),
    ).toBe(false);
  });

  it("skips duplicate loads while a tracked request is still in flight", () => {
    expect(
      shouldSkipWorkspaceThreadListLoad({
        isLoading: false,
        isHydratingThreadList: true,
        hasHydratedThreadList: false,
      }),
    ).toBe(true);
  });
});

describe("resolveNextWorkspaceThreadListHydrationId", () => {
  it("returns the next connected workspace that still needs full hydration", () => {
    expect(
      resolveNextWorkspaceThreadListHydrationId({
        workspaces: [workspace("ws-active"), workspace("ws-side-1"), workspace("ws-side-2")],
        hydratedWorkspaceIds: new Set(["ws-side-1"]),
        hydratingWorkspaceIds: new Set(),
        loadingByWorkspace: {},
      }),
    ).toBe("ws-active");
  });

  it("skips active projection owners because they are handled by the projection effect", () => {
    expect(
      resolveNextWorkspaceThreadListHydrationId({
        workspaces: [
          workspace("ws-main"),
          workspace("ws-worktree-1"),
          workspace("ws-worktree-2"),
          workspace("ws-other"),
        ],
        activeWorkspaceProjectionOwnerIds: ["ws-main", "ws-worktree-1", "ws-worktree-2"],
        hydratedWorkspaceIds: new Set(),
        hydratingWorkspaceIds: new Set(),
        loadingByWorkspace: {},
      }),
    ).toBe("ws-other");
  });

  it("skips disconnected, loading, and already hydrating workspaces", () => {
    expect(
      resolveNextWorkspaceThreadListHydrationId({
        workspaces: [
          workspace("ws-active"),
          workspace("ws-disconnected", false),
          workspace("ws-loading"),
          workspace("ws-hydrating"),
          workspace("ws-ready"),
        ],
        hydratedWorkspaceIds: new Set(),
        hydratingWorkspaceIds: new Set(["ws-active", "ws-hydrating"]),
        loadingByWorkspace: { "ws-loading": true },
      }),
    ).toBe("ws-ready");
  });
});

describe("resolveWorkspaceProjectionOwnerIds", () => {
  it("returns no owners without an active workspace", () => {
    expect(resolveWorkspaceProjectionOwnerIds([workspace("ws-main")], null)).toEqual([]);
  });

  it("projects a main workspace with its direct children in backend order", () => {
    const main = workspace("ws-main");
    const worktreeB = {
      ...workspace("ws-worktree-b"),
      path: "/tmp/z-worktree",
      kind: "worktree" as const,
      parentId: main.id,
    };
    const worktreeA = {
      ...workspace("ws-worktree-a"),
      path: "/tmp/a-worktree",
      kind: "worktree" as const,
      parentId: main.id,
    };
    const nestedWorktree = {
      ...workspace("ws-nested"),
      kind: "worktree" as const,
      parentId: worktreeA.id,
    };
    const legacyWorktree = {
      ...workspace("ws-worktree-legacy"),
      path: "/tmp/m-worktree",
      parentId: main.id,
    };

    expect(
      resolveWorkspaceProjectionOwnerIds(
        [
          worktreeB,
          nestedWorktree,
          main,
          workspace("ws-other"),
          legacyWorktree,
          worktreeA,
        ],
        main.id,
      ),
    ).toEqual([main.id, worktreeA.id, legacyWorktree.id, worktreeB.id]);
  });

  it("keeps an active worktree isolated from its parent and siblings", () => {
    const main = workspace("ws-main");
    const activeWorktree = {
      ...workspace("ws-worktree-active"),
      kind: "worktree" as const,
      parentId: main.id,
    };
    const sibling = {
      ...workspace("ws-worktree-sibling"),
      kind: "worktree" as const,
      parentId: main.id,
    };

    expect(
      resolveWorkspaceProjectionOwnerIds(
        [main, activeWorktree, sibling],
        activeWorktree.id,
      ),
    ).toEqual([activeWorktree.id]);
  });

  it("preserves the active id while the workspace registry is still hydrating", () => {
    expect(resolveWorkspaceProjectionOwnerIds([], "ws-pending")).toEqual([
      "ws-pending",
    ]);
  });
});
