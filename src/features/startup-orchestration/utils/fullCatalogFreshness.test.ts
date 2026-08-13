import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFullCatalogFresh,
  getFullCatalogFreshSnapshot,
  isFullCatalogFresh,
  markFullCatalogFresh,
  resetFullCatalogFreshForTests,
} from "./fullCatalogFreshness";

describe("fullCatalogFreshness", () => {
  beforeEach(() => {
    resetFullCatalogFreshForTests();
  });

  it("is fresh after mark until cleared", () => {
    expect(isFullCatalogFresh("ws-a")).toBe(false);
    markFullCatalogFresh("ws-a", 60_000);
    expect(isFullCatalogFresh("ws-a")).toBe(true);
    expect(getFullCatalogFreshSnapshot()[0]).toContain("ws-a");
    clearFullCatalogFresh("ws-a");
    expect(isFullCatalogFresh("ws-a")).toBe(false);
  });

  it("expires by wall time", () => {
    markFullCatalogFresh("ws-b", 0);
    expect(isFullCatalogFresh("ws-b")).toBe(false);
  });
});
