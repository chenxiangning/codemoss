// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOpenPaths } from "../../features/workspaces/hooks/useOpenPaths";
import { useWorkspaceDropZone } from "../../features/workspaces/hooks/useWorkspaceDropZone";
import { useWorkspacePathsIntake } from "./useWorkspacePathsIntake";

vi.mock("../../features/workspaces/hooks/useOpenPaths", () => ({
  useOpenPaths: vi.fn(),
}));

vi.mock("../../features/workspaces/hooks/useWorkspaceDropZone", () => ({
  useWorkspaceDropZone: vi.fn(() => ({
    dropTargetRef: { current: null },
    isDragOver: false,
    handleDragOver: vi.fn(),
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
  })),
}));

describe("useWorkspacePathsIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deduplicates non-empty paths from open-path events", async () => {
    const handleAddWorkspaceFromPath = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useWorkspacePathsIntake({ handleAddWorkspaceFromPath }));
    const onOpenPaths = vi.mocked(useOpenPaths).mock.calls[0]?.[0].onOpenPaths;

    await act(async () => {
      await onOpenPaths?.(["/tmp/a", "", "/tmp/a", "/tmp/b"]);
    });

    expect(handleAddWorkspaceFromPath).toHaveBeenCalledTimes(2);
    expect(handleAddWorkspaceFromPath).toHaveBeenNthCalledWith(1, "/tmp/a");
    expect(handleAddWorkspaceFromPath).toHaveBeenNthCalledWith(2, "/tmp/b");
  });

  it("wires the same path handler into the workspace drop zone", () => {
    const handleAddWorkspaceFromPath = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkspacePathsIntake({ handleAddWorkspaceFromPath }),
    );

    const openPathsHandler = vi.mocked(useOpenPaths).mock.calls[0]?.[0].onOpenPaths;
    const dropPathsHandler = vi.mocked(useWorkspaceDropZone).mock.calls[0]?.[0].onDropPaths;

    expect(dropPathsHandler).toBe(openPathsHandler);
    expect(result.current.isWorkspaceDropActive).toBe(false);
    expect(result.current.handleWorkspaceDrop).toBeTypeOf("function");
  });
});
