// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGitStatusRefreshOnTurnSettle } from "./useGitStatusRefreshOnTurnSettle";

describe("useGitStatusRefreshOnTurnSettle", () => {
  it("queues one refresh when a processing turn settles", () => {
    const queueGitStatusRefresh = vi.fn();
    const view = renderHook(
      ({ threadStatusById }) =>
        useGitStatusRefreshOnTurnSettle({
          queueGitStatusRefresh,
          threadStatusById,
        }),
      {
        initialProps: {
          threadStatusById: { "thread-1": { isProcessing: true } },
        },
      },
    );

    expect(queueGitStatusRefresh).not.toHaveBeenCalled();

    view.rerender({
      threadStatusById: { "thread-1": { isProcessing: false } },
    });
    expect(queueGitStatusRefresh).toHaveBeenCalledTimes(1);

    view.rerender({
      threadStatusById: { "thread-1": { isProcessing: false } },
    });
    expect(queueGitStatusRefresh).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple settled turns into one refresh", () => {
    const queueGitStatusRefresh = vi.fn();
    const view = renderHook(
      ({ threadStatusById }) =>
        useGitStatusRefreshOnTurnSettle({
          queueGitStatusRefresh,
          threadStatusById,
        }),
      {
        initialProps: {
          threadStatusById: {
            "thread-1": { isProcessing: true },
            "thread-2": { isProcessing: true },
          },
        },
      },
    );

    view.rerender({
      threadStatusById: {
        "thread-1": { isProcessing: false },
        "thread-2": { isProcessing: false },
      },
    });

    expect(queueGitStatusRefresh).toHaveBeenCalledTimes(1);
  });
});
