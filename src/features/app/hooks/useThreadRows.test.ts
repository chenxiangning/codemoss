// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../../types";
import { useThreadRows } from "./useThreadRows";

const getPinTimestamp = () => null;

describe("useThreadRows", () => {
  it("renders Codex subagent sessions under one parent root", () => {
    const parent: ThreadSummary = {
      id: "parent-session",
      name: "Parent",
      updatedAt: 100,
      engineSource: "codex",
    };
    const child: ThreadSummary = {
      id: "child-session",
      name: "Aristotle",
      parentThreadId: "parent-session",
      updatedAt: 200,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [parent, child],
      false,
      "ws-1",
      getPinTimestamp,
    );

    expect(rows.totalRoots).toBe(1);
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["parent-session", 0],
      ["child-session", 1],
    ]);
  });

  it("keeps a recent child session visible by sorting roots by subtree activity", () => {
    const parent: ThreadSummary = {
      id: "claude:parent",
      name: "Older parent",
      updatedAt: 100,
      engineSource: "claude",
    };
    const child: ThreadSummary = {
      id: "claude:child",
      name: "Recent child",
      parentThreadId: "claude:parent",
      updatedAt: 1_000,
      engineSource: "claude",
    };
    const unrelated: ThreadSummary = {
      id: "codex:unrelated",
      name: "Middle unrelated",
      updatedAt: 500,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [parent, child, unrelated],
      false,
      "ws-1",
      getPinTimestamp,
      1,
    );

    expect(rows.totalRoots).toBe(2);
    expect(rows.hasMoreRoots).toBe(true);
    expect(rows.unpinnedRows.map((row) => [row.thread.id, row.depth])).toEqual([
      ["claude:parent", 0],
      ["claude:child", 1],
    ]);
  });

  it("hides Shared-owned subagent pups from the sidebar tree without removing native trees", () => {
    const shared: ThreadSummary = {
      id: "shared:s1",
      name: "Shared Session",
      updatedAt: 300,
      engineSource: "codex",
      threadKind: "shared",
      nativeThreadIds: ["codex:hidden-owner"],
    };
    // parent 已 remap 到 shared: — 侧栏必须隐藏（不下崽）
    const remountedPup: ThreadSummary = {
      id: "child-archimedes",
      name: "Archimedes",
      parentThreadId: "shared:s1",
      updatedAt: 400,
      engineSource: "codex",
    };
    // parent 仍为 hidden owner raw — 同样隐藏
    const rawParentPup: ThreadSummary = {
      id: "child-aristotle",
      name: "Aristotle",
      parentThreadId: "hidden-owner",
      updatedAt: 350,
      engineSource: "codex",
    };
    // Native 父子：不受影响
    const nativeParent: ThreadSummary = {
      id: "codex:native-parent",
      name: "Native Parent",
      updatedAt: 100,
      engineSource: "codex",
    };
    const nativeChild: ThreadSummary = {
      id: "codex:native-child",
      name: "Native Child",
      parentThreadId: "codex:native-parent",
      updatedAt: 200,
      engineSource: "codex",
    };

    const { result } = renderHook(() => useThreadRows({}));
    const rows = result.current.getThreadRows(
      [shared, remountedPup, rawParentPup, nativeParent, nativeChild],
      true,
      "ws-1",
      getPinTimestamp,
    );

    const visibleIds = rows.unpinnedRows.map((row) => row.thread.id);
    expect(visibleIds).toContain("shared:s1");
    expect(visibleIds).toContain("codex:native-parent");
    expect(visibleIds).toContain("codex:native-child");
    expect(visibleIds).not.toContain("child-archimedes");
    expect(visibleIds).not.toContain("child-aristotle");
    // Shared 不展示 hasChildren（崽子已从树剔除）
    const sharedRow = rows.unpinnedRows.find((row) => row.thread.id === "shared:s1");
    expect(sharedRow?.hasChildren).toBe(false);
    expect(rows.totalRoots).toBe(2);
  });
});
