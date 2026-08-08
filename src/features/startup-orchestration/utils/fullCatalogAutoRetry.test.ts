import { describe, expect, it, beforeEach } from "vitest";
import {
  clearFullCatalogAutoRetryCooldown,
  getFullCatalogAutoRetryBlockedSnapshot,
  isFullCatalogAutoRetryBlocked,
  markFullCatalogAutoRetryCooldown,
  resetFullCatalogAutoRetryForTests,
} from "./fullCatalogAutoRetry";

describe("fullCatalogAutoRetry", () => {
  beforeEach(() => {
    resetFullCatalogAutoRetryForTests();
  });

  it("blocks auto retry after mark until cleared", () => {
    expect(isFullCatalogAutoRetryBlocked("ws-a")).toBe(false);
    markFullCatalogAutoRetryCooldown("ws-a", "timeout", 60_000);
    expect(isFullCatalogAutoRetryBlocked("ws-a")).toBe(true);
    expect(getFullCatalogAutoRetryBlockedSnapshot()[0]).toContain("ws-a");
    expect(getFullCatalogAutoRetryBlockedSnapshot()[0]).toContain("timeout");
    clearFullCatalogAutoRetryCooldown("ws-a");
    expect(isFullCatalogAutoRetryBlocked("ws-a")).toBe(false);
  });

  it("expires cooldown by wall time", () => {
    markFullCatalogAutoRetryCooldown("ws-b", "timeout", 0);
    expect(isFullCatalogAutoRetryBlocked("ws-b")).toBe(false);
  });
});
