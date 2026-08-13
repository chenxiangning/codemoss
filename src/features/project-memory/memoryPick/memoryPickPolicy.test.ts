import { describe, expect, it } from "vitest";
import {
  applyComposerMode,
  applyFirstPickCompleted,
  applySessionDismissed,
  createDefaultSessionPolicy,
  decideMemoryPickGateEntry,
  selectTopKIds,
} from "./memoryPickPolicy";

describe("decideMemoryPickGateEntry", () => {
  const basePolicy = createDefaultSessionPolicy("off", {
    firstPickRequired: false,
  });

  it("skips when dismissed", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "pick",
      policy: { ...basePolicy, dismissed: true },
      queryText: "hello",
      hasRetrievableText: true,
    });
    expect(decision).toEqual({ kind: "skip", reason: "session-dismissed" });
  });

  it("skips when composer is off even if firstPickRequired (opt-in)", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "off",
      policy: { ...basePolicy, firstPickRequired: true },
      queryText: "hello",
      hasRetrievableText: true,
    });
    expect(decision).toEqual({ kind: "skip", reason: "mode-off" });
  });

  it("shows UI for pick mode", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "pick",
      policy: basePolicy,
      queryText: "hello",
      hasRetrievableText: true,
    });
    expect(decision).toEqual({ kind: "show-ui", reason: "pick-mode" });
  });

  it("always mode shows UI every turn (matching + Top3 preview)", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "always",
      policy: basePolicy,
      queryText: "hello",
      hasRetrievableText: true,
    });
    expect(decision).toEqual({ kind: "show-ui", reason: "always-mode" });
  });

  it("skips empty query", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "pick",
      policy: basePolicy,
      queryText: "   ",
      hasRetrievableText: false,
    });
    expect(decision.kind).toBe("skip");
  });

  it("first-pick wins over always preference (hand pick once)", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "always",
      policy: { firstPickRequired: true, dismissed: false },
      queryText: "hello",
      hasRetrievableText: true,
    });
    expect(decision).toEqual({ kind: "show-ui", reason: "first-pick" });
  });

  it("skips first-pick when workspace has no memories", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "pick",
      policy: { firstPickRequired: true, dismissed: false },
      queryText: "hello",
      hasRetrievableText: true,
      workspaceMayHaveMemories: false,
    });
    // 无记忆时不走 first-pick，回落到 pick-mode
    expect(decision).toEqual({ kind: "show-ui", reason: "pick-mode" });
  });

  it("skips first-pick for pick mode when workspace has no memories and firstPick not required", () => {
    const decision = decideMemoryPickGateEntry({
      composerMode: "pick",
      policy: { firstPickRequired: false, dismissed: false },
      queryText: "hello",
      hasRetrievableText: true,
      workspaceMayHaveMemories: false,
    });
    expect(decision).toEqual({ kind: "show-ui", reason: "pick-mode" });
  });
});

describe("session policy helpers", () => {
  it("clears dismissed when composer mode changes", () => {
    const dismissed = applySessionDismissed(
      createDefaultSessionPolicy("pick"),
    );
    const next = applyComposerMode(dismissed, "always");
    expect(next.dismissed).toBe(false);
    expect(next.composerMode).toBe("always");
  });

  it("marks first pick done", () => {
    const policy = createDefaultSessionPolicy("off", {
      firstPickRequired: true,
    });
    expect(applyFirstPickCompleted(policy).firstPickRequired).toBe(false);
  });
});

describe("selectTopKIds", () => {
  it("orders by score then updatedAt", () => {
    const ids = selectTopKIds(
      [
        { id: "a", score: 0.5, updatedAt: 10 },
        { id: "b", score: 0.9, updatedAt: 1 },
        { id: "c", score: 0.9, updatedAt: 5 },
        { id: "d", score: 0.2, updatedAt: 99 },
      ],
      2,
    );
    expect(ids).toEqual(["c", "b"]);
  });
});

describe("resolveAlwaysPrefillCount", () => {
  it("clamps preferred count to candidate length", async () => {
    const { resolveAlwaysPrefillCount } = await import("./memoryPickPolicy");
    expect(resolveAlwaysPrefillCount(5, 3)).toBe(3);
    expect(resolveAlwaysPrefillCount(2, 10)).toBe(2);
    expect(resolveAlwaysPrefillCount(undefined, 10)).toBe(3);
    expect(resolveAlwaysPrefillCount(0, 10)).toBe(0);
  });
});
