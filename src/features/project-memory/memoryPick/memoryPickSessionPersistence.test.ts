// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  __flushMemoryPickSessionPersistForTests,
  __resetMemoryPickSessionStoreForTests,
  getMemoryPickSessionPolicy,
  markMemoryPickSessionDismissed,
  restoreMemoryPickFromDismiss,
  setMemoryPickAlwaysPreferredCount,
  setMemoryPickComposerMode,
} from "./memoryPickSessionStore";
import {
  clearMemoryPickSessionPersistence,
  loadMemoryPickSessionPolicy,
  memoryPickSessionStorageKey,
  normalizePersistedMemoryPickSessionPolicy,
  saveMemoryPickSessionPolicy,
} from "./memoryPickSessionPersistence";

afterEach(() => {
  __resetMemoryPickSessionStoreForTests();
  clearMemoryPickSessionPersistence("ws-a", "th-1");
  clearMemoryPickSessionPersistence("ws-b", "th-1");
  clearMemoryPickSessionPersistence("ws-a", "th-2");
});

describe("memoryPickSessionPersistence", () => {
  it("roundtrips always + dismissed + preferredCount", () => {
    setMemoryPickComposerMode("ws-a", "th-1", "always");
    markMemoryPickSessionDismissed("ws-a", "th-1");
    setMemoryPickAlwaysPreferredCount("ws-a", "th-1", 5);
    __flushMemoryPickSessionPersistForTests();

    const loaded = loadMemoryPickSessionPolicy("ws-a", "th-1");
    // dismiss 会同时清 firstPickRequired（applySessionDismissed 合同）
    expect(loaded).toEqual({
      composerMode: "always",
      dismissed: true,
      firstPickRequired: false,
      alwaysPreferredCount: 5,
    });
  });

  it("isolates workspace and thread keys", () => {
    setMemoryPickComposerMode("ws-a", "th-1", "pick");
    setMemoryPickComposerMode("ws-b", "th-1", "always");
    setMemoryPickComposerMode("ws-a", "th-2", "off");
    __flushMemoryPickSessionPersistForTests();

    expect(loadMemoryPickSessionPolicy("ws-a", "th-1")?.composerMode).toBe(
      "pick",
    );
    expect(loadMemoryPickSessionPolicy("ws-b", "th-1")?.composerMode).toBe(
      "always",
    );
    expect(loadMemoryPickSessionPolicy("ws-a", "th-2")?.composerMode).toBe(
      "off",
    );
    expect(memoryPickSessionStorageKey("ws-a", "th-1")).toContain("ws-a");
    expect(memoryPickSessionStorageKey("ws-a", "th-1")).toContain("th-1");
  });

  it("hydrates store from localStorage on cold miss", () => {
    saveMemoryPickSessionPolicy("ws-a", "th-1", {
      composerMode: "always",
      dismissed: false,
      firstPickRequired: false,
      alwaysPreferredCount: 4,
    });
    __resetMemoryPickSessionStoreForTests();

    const policy = getMemoryPickSessionPolicy("ws-a", "th-1");
    expect(policy.composerMode).toBe("always");
    expect(policy.firstPickRequired).toBe(false);
    expect(policy.alwaysPreferredCount).toBe(4);
  });

  it("restoreMemoryPickFromDismiss forces pick and clears dismiss", () => {
    setMemoryPickComposerMode("ws-a", "th-1", "always");
    markMemoryPickSessionDismissed("ws-a", "th-1");
    restoreMemoryPickFromDismiss("ws-a", "th-1");
    const policy = getMemoryPickSessionPolicy("ws-a", "th-1");
    expect(policy.dismissed).toBe(false);
    expect(policy.composerMode).toBe("pick");
    expect(policy.firstPickRequired).toBe(false);
    __flushMemoryPickSessionPersistForTests();
    expect(loadMemoryPickSessionPolicy("ws-a", "th-1")?.composerMode).toBe(
      "pick",
    );
  });

  it("normalizes single → pick and rejects bad payload", () => {
    const ok = normalizePersistedMemoryPickSessionPolicy(
      {
        v: 1,
        workspaceId: "ws-a",
        threadId: "th-1",
        composerMode: "single",
        dismissed: false,
        firstPickRequired: true,
        alwaysPreferredCount: 3,
        updatedAt: 1,
      },
      "ws-a",
      "th-1",
    );
    expect(ok?.composerMode).toBe("pick");

    expect(
      normalizePersistedMemoryPickSessionPolicy(
        { v: 2, composerMode: "always" },
        "ws-a",
        "th-1",
      ),
    ).toBeNull();
  });
});
