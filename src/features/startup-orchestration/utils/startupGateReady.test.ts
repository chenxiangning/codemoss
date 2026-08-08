import { describe, expect, it, beforeEach } from "vitest";
import {
  getStartupGateReadyReason,
  resetStartupGateReadyForTests,
  stampStartupGateReady,
} from "./startupGateReady";
import {
  getStartupTraceSnapshot,
  resetStartupTraceForTests,
} from "./startupTrace";

describe("startupGateReady", () => {
  beforeEach(() => {
    resetStartupTraceForTests();
    resetStartupGateReadyForTests();
  });

  it("stamps milestone once and records reason", () => {
    expect(stampStartupGateReady("first-paint-complete")).toBe(true);
    expect(getStartupGateReadyReason()).toBe("first-paint-complete");
    expect(getStartupTraceSnapshot().milestones["startup-gate-ready"]).toBeTruthy();
    expect(stampStartupGateReady("force-enter")).toBe(false);
    expect(getStartupGateReadyReason()).toBe("first-paint-complete");
  });
});
