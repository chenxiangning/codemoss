import { describe, expect, it, beforeEach } from "vitest";
import {
  getStartupForceEnteredAtMs,
  isStartupForceEntered,
  markStartupForceEnter,
  registerStartupIdleHydrationCancel,
  resetStartupForceEnterForTests,
  subscribeStartupForceEnter,
} from "./startupForceEnter";

describe("startupForceEnter", () => {
  beforeEach(() => {
    resetStartupForceEnterForTests();
  });

  it("marks force-enter and notifies listeners", () => {
    let notified = 0;
    const unsub = subscribeStartupForceEnter(() => {
      notified += 1;
    });
    expect(isStartupForceEntered()).toBe(false);
    markStartupForceEnter();
    expect(isStartupForceEntered()).toBe(true);
    expect(getStartupForceEnteredAtMs()).toBeGreaterThan(0);
    expect(notified).toBe(1);
    unsub();
  });

  it("cancels registered idle hydration disposers", () => {
    let cancelled = false;
    registerStartupIdleHydrationCancel(() => {
      cancelled = true;
    });
    markStartupForceEnter();
    expect(cancelled).toBe(true);
  });
});
