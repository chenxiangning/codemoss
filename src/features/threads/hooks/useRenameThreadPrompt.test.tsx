// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRenameThreadPrompt } from "./useRenameThreadPrompt";

describe("useRenameThreadPrompt", () => {
  it("opens with the current thread name and renames only when the value changes", () => {
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useRenameThreadPrompt({
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "Alpha", updatedAt: 1 }],
        },
        renameThread,
      }),
    );

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
    });
    expect(result.current.renamePrompt).toEqual({
      workspaceId: "ws-1",
      threadId: "thread-1",
      name: "Alpha",
      originalName: "Alpha",
    });

    act(() => {
      result.current.handleRenamePromptConfirm();
    });
    expect(renameThread).not.toHaveBeenCalled();
    expect(result.current.renamePrompt).toBeNull();

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
      result.current.handleRenamePromptChange("Beta");
    });
    act(() => {
      result.current.handleRenamePromptConfirm();
    });
    expect(renameThread).toHaveBeenCalledWith("ws-1", "thread-1", "Beta");
    expect(result.current.renamePrompt).toBeNull();
  });

  it("cancels without renaming", () => {
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useRenameThreadPrompt({
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "Alpha", updatedAt: 1 }],
        },
        renameThread,
      }),
    );

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
      result.current.handleRenamePromptChange("Beta");
      result.current.handleRenamePromptCancel();
    });
    expect(renameThread).not.toHaveBeenCalled();
    expect(result.current.renamePrompt).toBeNull();
  });
});
