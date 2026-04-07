/* @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentWindow: vi.fn(),
  isWindowsPlatform: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: mocks.getCurrentWindow,
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
}));

import { useWindowDrag } from "./useWindowDrag";

function flushMicrotasks() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

describe("useWindowDrag", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const titlebar = document.createElement("div");
    titlebar.id = "titlebar";
    document.body.appendChild(titlebar);

    mocks.getCurrentWindow.mockReset();
    mocks.isWindowsPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
  });

  it("swallows non-Windows startDragging failures", async () => {
    const isFullscreen = vi.fn().mockResolvedValue(false);
    const startDragging = vi.fn().mockRejectedValue(new Error("drag failed"));
    mocks.getCurrentWindow.mockReturnValue({
      isFullscreen,
      startDragging,
    });

    renderHook(() => useWindowDrag("titlebar"));

    const titlebar = document.getElementById("titlebar");
    if (!titlebar) {
      throw new Error("titlebar missing");
    }

    titlebar.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        detail: 1,
      }),
    );

    await flushMicrotasks();

    expect(isFullscreen).toHaveBeenCalledTimes(1);
    expect(startDragging).toHaveBeenCalledTimes(1);
  });

  it("skips dragging when non-Windows window is fullscreen", async () => {
    const isFullscreen = vi.fn().mockResolvedValue(true);
    const startDragging = vi.fn().mockResolvedValue(undefined);
    mocks.getCurrentWindow.mockReturnValue({
      isFullscreen,
      startDragging,
    });

    renderHook(() => useWindowDrag("titlebar"));

    const titlebar = document.getElementById("titlebar");
    if (!titlebar) {
      throw new Error("titlebar missing");
    }

    titlebar.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        button: 0,
        buttons: 1,
        detail: 1,
      }),
    );

    await flushMicrotasks();

    expect(isFullscreen).toHaveBeenCalledTimes(1);
    expect(startDragging).not.toHaveBeenCalled();
  });
});
