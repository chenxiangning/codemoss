/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileTreeRootActions } from "./FileTreeRootActions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("FileTreeRootActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(performance.now());
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("replays spin animation when clicking the same action repeatedly", () => {
    const onOpenNewFile = vi.fn();

    render(
      <FileTreeRootActions
        canTrashSelectedNode={false}
        selectedParentFolder={null}
        onOpenNewFile={onOpenNewFile}
        onOpenNewFolder={() => undefined}
        onTrashSelected={() => undefined}
      />,
    );

    const button = screen.getByRole("button", { name: "files.newFile" });

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(button.className).toContain("is-spinning");
    expect(onOpenNewFile).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(button.className).toContain("is-spinning");
    expect(onOpenNewFile).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(button.className).not.toContain("is-spinning");
  });
});
