// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryPickGateStoreForTests,
  cancelMemoryPickGate,
  confirmMemoryPickGate,
  dismissMemoryPickGate,
  getMemoryPickGateSnapshot,
  openMemoryPickGate,
  setMemoryPickGateMode,
  setMemoryPickGateSelectedIds,
  skipMemoryPickGate,
} from "./memoryPickGateStore";
import type { MemoryPickCandidate } from "./memoryPickTypes";

function candidate(
  id: string,
  score: number,
  updatedAt = 1,
): MemoryPickCandidate {
  return {
    id,
    title: id,
    summary: `summary-${id}`,
    score,
    updatedAt,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  __resetMemoryPickGateStoreForTests();
  vi.useRealTimers();
});

describe("memoryPickGateStore", () => {
  it("opens retrieving then awaiting with candidates", async () => {
    const promise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th",
      queryText: "q",
      mode: "pick",
      firstPick: true,
      retrieve: async () => ({
        candidates: [candidate("a", 0.9), candidate("b", 0.5)],
        error: null,
      }),
    });

    expect(getMemoryPickGateSnapshot("ws", "th")?.phase).toBe("retrieving");
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th")?.phase).toBe(
        "awaiting-choice",
      );
    });
    expect(getMemoryPickGateSnapshot("ws", "th")?.candidates).toHaveLength(2);
    expect(getMemoryPickGateSnapshot("ws", "th")?.selectedIds).toEqual([]);

    confirmMemoryPickGate("ws", "th");
    await expect(promise).resolves.toEqual({
      action: "confirm",
      selectedIds: [],
      mode: "pick",
    });
    expect(getMemoryPickGateSnapshot("ws", "th")).toBeNull();
  });

  it("keeps retrieving for min match display even when retrieve is instant", async () => {
    const promise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-min",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("a", 1)],
        error: null,
      }),
    });
    expect(getMemoryPickGateSnapshot("ws", "th-min")?.phase).toBe("retrieving");
    await vi.advanceTimersByTimeAsync(400);
    expect(getMemoryPickGateSnapshot("ws", "th-min")?.phase).toBe("retrieving");
    await vi.advanceTimersByTimeAsync(700);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-min")?.phase).toBe(
        "awaiting-choice",
      );
    });
    cancelMemoryPickGate("ws", "th-min");
    await promise;
  });

  it("empty retrieve auto-skips (no pick UI)", async () => {
    const promise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-empty",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({ candidates: [], error: null }),
    });

    await vi.advanceTimersByTimeAsync(1100);
    await expect(promise).resolves.toEqual({
      action: "skip",
      mode: "pick",
      emptyReason: "no_match",
    });
    expect(getMemoryPickGateSnapshot("ws", "th-empty")).toBeNull();
  });

  it("pick mode tracks selected ids on confirm", async () => {
    const promise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-sel",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("a", 0.8), candidate("b", 0.7)],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-sel")?.phase).toBe(
        "awaiting-choice",
      );
    });
    setMemoryPickGateSelectedIds("ws", "th-sel", ["b"]);
    confirmMemoryPickGate("ws", "th-sel");
    await expect(promise).resolves.toEqual({
      action: "confirm",
      selectedIds: ["b"],
      mode: "pick",
    });
  });

  it("always mode prefills Top3 by score and allows free selection on confirm", async () => {
    const promise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-always",
      queryText: "q",
      mode: "always",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.5, 1),
          candidate("b", 0.9, 1),
          candidate("c", 0.8, 1),
          candidate("d", 0.7, 1),
        ],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-always")?.phase).toBe(
        "awaiting-choice",
      );
    });
    const snap = getMemoryPickGateSnapshot("ws", "th-always");
    expect(snap?.selectedIds).toEqual(["b", "c", "d"]);

    // 用户可改数量：只留 2 条
    setMemoryPickGateSelectedIds("ws", "th-always", ["b", "c"]);
    confirmMemoryPickGate("ws", "th-always");
    await expect(promise).resolves.toEqual({
      action: "confirm",
      selectedIds: ["b", "c"],
      mode: "always",
    });
  });

  it("always next open uses last confirmed preferred count", async () => {
    const first = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-pref",
      queryText: "q1",
      mode: "always",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
          candidate("d", 0.6),
        ],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-pref")?.phase).toBe(
        "awaiting-choice",
      );
    });
    setMemoryPickGateSelectedIds("ws", "th-pref", ["a", "b"]);
    confirmMemoryPickGate("ws", "th-pref");
    await first;

    const second = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-pref",
      queryText: "q2",
      mode: "always",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("w", 0.95),
          candidate("x", 0.9),
          candidate("y", 0.85),
          candidate("z", 0.5),
        ],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-pref")?.phase).toBe(
        "awaiting-choice",
      );
    });
    // 上次确认 2 条 → 本轮预勾相关分 Top2
    expect(getMemoryPickGateSnapshot("ws", "th-pref")?.selectedIds).toEqual([
      "w",
      "x",
    ]);
    cancelMemoryPickGate("ws", "th-pref");
    await second;
  });

  it("switching mode pick↔always resets selection semantics", async () => {
    void openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-mode",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [
          candidate("a", 0.9),
          candidate("b", 0.8),
          candidate("c", 0.7),
        ],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-mode")?.phase).toBe(
        "awaiting-choice",
      );
    });
    setMemoryPickGateSelectedIds("ws", "th-mode", ["a"]);
    setMemoryPickGateMode("ws", "th-mode", "always");
    expect(getMemoryPickGateSnapshot("ws", "th-mode")?.selectedIds).toEqual([
      "a",
      "b",
      "c",
    ]);
    setMemoryPickGateMode("ws", "th-mode", "pick");
    expect(getMemoryPickGateSnapshot("ws", "th-mode")?.selectedIds).toEqual([]);
    cancelMemoryPickGate("ws", "th-mode");
  });

  it("skip and dismiss resolve correctly", async () => {
    const skipPromise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-skip",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("a", 1)],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-skip")?.phase).toBe(
        "awaiting-choice",
      );
    });
    skipMemoryPickGate("ws", "th-skip");
    await expect(skipPromise).resolves.toEqual({
      action: "skip",
      mode: "pick",
    });

    const dismissPromise = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-dismiss",
      queryText: "q",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("a", 1)],
        error: null,
      }),
    });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-dismiss")?.phase).toBe(
        "awaiting-choice",
      );
    });
    dismissMemoryPickGate("ws", "th-dismiss");
    await expect(dismissPromise).resolves.toEqual({ action: "dismiss" });
  });

  it("replacing open cancels the previous promise", async () => {
    const first = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-replace",
      queryText: "q1",
      mode: "pick",
      firstPick: false,
      retrieve: () =>
        new Promise(() => {
          /* hang */
        }),
    });
    const second = openMemoryPickGate({
      workspaceId: "ws",
      threadId: "th-replace",
      queryText: "q2",
      mode: "pick",
      firstPick: false,
      retrieve: async () => ({
        candidates: [candidate("z", 1)],
        error: null,
      }),
    });
    await expect(first).resolves.toEqual({ action: "cancel" });
    await vi.advanceTimersByTimeAsync(1100);
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot("ws", "th-replace")?.queryText).toBe(
        "q2",
      );
      expect(getMemoryPickGateSnapshot("ws", "th-replace")?.phase).toBe(
        "awaiting-choice",
      );
    });
    cancelMemoryPickGate("ws", "th-replace");
    await expect(second).resolves.toEqual({ action: "cancel" });
  });
});
