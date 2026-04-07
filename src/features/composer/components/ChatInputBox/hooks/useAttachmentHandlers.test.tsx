/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAttachmentHandlers } from "./useAttachmentHandlers";
import { pickFiles } from "../../../../../services/tauri";

vi.mock("../../../../../services/tauri", () => ({
  pickFiles: vi.fn(async () => []),
}));

type HookResult = ReturnType<typeof useAttachmentHandlers>;

function renderHook(options: {
  externalAttachments: undefined;
  onAddAttachment?: (files?: FileList | null) => void;
  onRemoveAttachment?: (id: string) => void;
  onAttachPaths?: (paths: string[]) => boolean;
}) {
  let result: HookResult | undefined;
  const setInternalAttachments = vi.fn();

  function Test() {
    result = useAttachmentHandlers({
      ...options,
      setInternalAttachments,
    });
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Test));
  });

  return {
    get result() {
      if (!result) {
        throw new Error("Hook not rendered");
      }
      return result;
    },
    setInternalAttachments,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useAttachmentHandlers pickFiles bridge", () => {
  const mockPickFiles = vi.mocked(pickFiles);

  beforeEach(() => {
    mockPickFiles.mockReset();
  });

  it("uses pickFiles and forwards mac-style paths to shared path handler", async () => {
    mockPickFiles.mockResolvedValueOnce(["/Users/demo/project/README.md"]);
    const onAttachPaths = vi.fn(() => true);
    const onAddAttachment = vi.fn();
    const hook = renderHook({
      externalAttachments: undefined,
      onAttachPaths,
      onAddAttachment,
    });

    await act(async () => {
      hook.result.handleAddAttachment(undefined);
      await Promise.resolve();
    });

    expect(onAttachPaths).toHaveBeenCalledWith(["/Users/demo/project/README.md"]);
    expect(onAddAttachment).not.toHaveBeenCalled();
    hook.unmount();
  });

  it("uses pickFiles and forwards windows-style paths to shared path handler", async () => {
    mockPickFiles.mockResolvedValueOnce(["C:\\repo\\docs\\guide.md"]);
    const onAttachPaths = vi.fn(() => true);
    const hook = renderHook({
      externalAttachments: undefined,
      onAttachPaths,
    });

    await act(async () => {
      hook.result.handleAddAttachment(undefined);
      await Promise.resolve();
    });

    expect(onAttachPaths).toHaveBeenCalledWith(["C:\\repo\\docs\\guide.md"]);
    hook.unmount();
  });

  it("falls back to legacy add callback when path handler does not consume picked files", async () => {
    mockPickFiles.mockResolvedValueOnce(["/Users/demo/project/README.md"]);
    const onAttachPaths = vi.fn(() => false);
    const onAddAttachment = vi.fn();
    const hook = renderHook({
      externalAttachments: undefined,
      onAttachPaths,
      onAddAttachment,
    });

    await act(async () => {
      hook.result.handleAddAttachment(undefined);
      await Promise.resolve();
    });

    expect(onAttachPaths).toHaveBeenCalledWith(["/Users/demo/project/README.md"]);
    expect(onAddAttachment).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});

