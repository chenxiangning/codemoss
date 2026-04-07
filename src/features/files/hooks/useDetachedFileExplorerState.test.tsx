/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDetachedFileExplorerState } from "./useDetachedFileExplorerState";

type DetachedStateHookProps = {
  workspaceId: string;
  initialFilePath: string | null;
  sessionUpdatedAt: number;
};

type DetachedStateHookResult = ReturnType<typeof useDetachedFileExplorerState>;

describe("useDetachedFileExplorerState", () => {
  it("keeps independent state per hook instance", () => {
    const primary = renderHook(() =>
      useDetachedFileExplorerState("ws-1", "src/main.ts"),
    );
    const secondary = renderHook(() =>
      useDetachedFileExplorerState("ws-1", null),
    );

    act(() => {
      primary.result.current.openFile("README.md");
    });

    expect(primary.result.current.openTabs).toEqual(["src/main.ts", "README.md"]);
    expect(primary.result.current.activeFilePath).toBe("README.md");
    expect(secondary.result.current.openTabs).toEqual([]);
    expect(secondary.result.current.activeFilePath).toBeNull();
  });

  it("resets session state when the detached workspace retargets", () => {
    const { result, rerender } = renderHook<DetachedStateHookResult, DetachedStateHookProps>(
      ({ workspaceId, initialFilePath, sessionUpdatedAt }) =>
        useDetachedFileExplorerState(workspaceId, initialFilePath, sessionUpdatedAt),
      {
        initialProps: {
          workspaceId: "ws-1",
          initialFilePath: "src/first.ts",
          sessionUpdatedAt: 1,
        } satisfies DetachedStateHookProps,
      },
    );

    act(() => {
      result.current.openFile("src/second.ts", { line: 8, column: 3 });
    });

    rerender({
      workspaceId: "ws-2",
      initialFilePath: "docs/spec.md",
      sessionUpdatedAt: 2,
    });

    expect(result.current.openTabs).toEqual(["docs/spec.md"]);
    expect(result.current.activeFilePath).toBe("docs/spec.md");
    expect(result.current.navigationTarget).toBeNull();
  });

  it("keeps existing tabs when the same workspace retargets to another file", () => {
    const { result, rerender } = renderHook<DetachedStateHookResult, DetachedStateHookProps>(
      ({ workspaceId, initialFilePath, sessionUpdatedAt }) =>
        useDetachedFileExplorerState(workspaceId, initialFilePath, sessionUpdatedAt),
      {
        initialProps: {
          workspaceId: "ws-1",
          initialFilePath: "src/first.ts",
          sessionUpdatedAt: 1,
        } satisfies DetachedStateHookProps,
      },
    );

    act(() => {
      result.current.openFile("src/second.ts");
    });

    rerender({
      workspaceId: "ws-1",
      initialFilePath: "docs/spec.md",
      sessionUpdatedAt: 2,
    });

    expect(result.current.openTabs).toEqual([
      "src/first.ts",
      "src/second.ts",
      "docs/spec.md",
    ]);
    expect(result.current.activeFilePath).toBe("docs/spec.md");
  });

  it("does not clear tabs when the same workspace is focused without a target file", () => {
    const { result, rerender } = renderHook<DetachedStateHookResult, DetachedStateHookProps>(
      ({ workspaceId, initialFilePath, sessionUpdatedAt }) =>
        useDetachedFileExplorerState(workspaceId, initialFilePath, sessionUpdatedAt),
      {
        initialProps: {
          workspaceId: "ws-1",
          initialFilePath: "src/first.ts",
          sessionUpdatedAt: 1,
        } satisfies DetachedStateHookProps,
      },
    );

    act(() => {
      result.current.openFile("src/second.ts");
    });

    rerender({
      workspaceId: "ws-1",
      initialFilePath: null,
      sessionUpdatedAt: 2,
    });

    expect(result.current.openTabs).toEqual(["src/first.ts", "src/second.ts"]);
    expect(result.current.activeFilePath).toBe("src/second.ts");
  });
});
