import { afterEach, describe, expect, it } from "vitest";
import {
  __resetMemoryPickSessionStoreForTests,
  clearMemoryPickSessionDismissed,
  forceMemoryPickComposerModeFromMenu,
  getMemoryPickSessionPolicy,
  markMemoryPickFirstPickDone,
  markMemoryPickSessionDismissed,
  resetMemoryPickSessionPolicy,
  setMemoryPickAlwaysPreferredCount,
  setMemoryPickComposerMode,
} from "./memoryPickSessionStore";

afterEach(() => {
  __resetMemoryPickSessionStoreForTests();
});

describe("memoryPickSessionStore", () => {
  it("defaults firstPickRequired true and dismissed false", () => {
    const policy = getMemoryPickSessionPolicy("ws", "th");
    expect(policy.firstPickRequired).toBe(true);
    expect(policy.dismissed).toBe(false);
    expect(policy.composerMode).toBe("off");
    expect(policy.alwaysPreferredCount).toBe(3);
  });

  it("does not clear dismissed when composer mode is written unchanged", () => {
    setMemoryPickComposerMode("ws", "th", "pick");
    markMemoryPickSessionDismissed("ws", "th");
    expect(getMemoryPickSessionPolicy("ws", "th").dismissed).toBe(true);

    // 模拟每轮 send 同步同一 mode
    setMemoryPickComposerMode("ws", "th", "pick");
    expect(getMemoryPickSessionPolicy("ws", "th").dismissed).toBe(true);
  });

  it("clears dismissed when composer mode actually changes", () => {
    setMemoryPickComposerMode("ws", "th", "pick");
    markMemoryPickSessionDismissed("ws", "th");
    setMemoryPickComposerMode("ws", "th", "always");
    const policy = getMemoryPickSessionPolicy("ws", "th");
    expect(policy.dismissed).toBe(false);
    expect(policy.composerMode).toBe("always");
  });

  it("marks first pick done independently of dismiss", () => {
    markMemoryPickFirstPickDone("ws", "th");
    expect(getMemoryPickSessionPolicy("ws", "th").firstPickRequired).toBe(
      false,
    );
  });

  it("reset restores firstPick and clears dismiss", () => {
    setMemoryPickComposerMode("ws", "th", "always");
    markMemoryPickSessionDismissed("ws", "th");
    markMemoryPickFirstPickDone("ws", "th");
    resetMemoryPickSessionPolicy("ws", "th", "always");
    const policy = getMemoryPickSessionPolicy("ws", "th");
    expect(policy).toEqual({
      composerMode: "always",
      firstPickRequired: true,
      dismissed: false,
      alwaysPreferredCount: 3,
    });
  });

  it("remembers always preferred count for next prefill", () => {
    setMemoryPickAlwaysPreferredCount("ws", "th", 5);
    expect(getMemoryPickSessionPolicy("ws", "th").alwaysPreferredCount).toBe(5);
    setMemoryPickAlwaysPreferredCount("ws", "th", 0);
    expect(getMemoryPickSessionPolicy("ws", "th").alwaysPreferredCount).toBe(0);
  });

  it("clearMemoryPickSessionDismissed restores prompts", () => {
    markMemoryPickSessionDismissed("ws", "th");
    clearMemoryPickSessionDismissed("ws", "th");
    expect(getMemoryPickSessionPolicy("ws", "th").dismissed).toBe(false);
  });

  it("restoreMemoryPickFromDismiss sets pick and never always", async () => {
    const { restoreMemoryPickFromDismiss } = await import("./memoryPickSessionStore");
    setMemoryPickComposerMode("ws", "th", "always");
    markMemoryPickSessionDismissed("ws", "th");
    restoreMemoryPickFromDismiss("ws", "th");
    const policy = getMemoryPickSessionPolicy("ws", "th");
    expect(policy.composerMode).toBe("pick");
    expect(policy.dismissed).toBe(false);
    expect(policy.firstPickRequired).toBe(false);
  });

  it("menu force off clears firstPick and closes feature (opt-in)", () => {
    setMemoryPickComposerMode("ws", "th", "pick");
    forceMemoryPickComposerModeFromMenu("ws", "th", "off");
    const policy = getMemoryPickSessionPolicy("ws", "th");
    expect(policy.composerMode).toBe("off");
    expect(policy.firstPickRequired).toBe(false);
    expect(policy.dismissed).toBe(false);
  });
});
