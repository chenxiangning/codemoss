import { describe, expect, it } from "vitest";
import {
  normalizeMemoryPickComposerMode,
  PICK_MATCH_MIN_DISPLAY_MS,
} from "./memoryPickTypes";

describe("normalizeMemoryPickComposerMode", () => {
  it("maps single to pick", () => {
    expect(normalizeMemoryPickComposerMode("single")).toBe("pick");
  });
  it("keeps always and pick", () => {
    expect(normalizeMemoryPickComposerMode("always")).toBe("always");
    expect(normalizeMemoryPickComposerMode("pick")).toBe("pick");
  });
  it("defaults to off", () => {
    expect(normalizeMemoryPickComposerMode(undefined)).toBe("off");
    expect(normalizeMemoryPickComposerMode("nope")).toBe("off");
  });
});

describe("PICK_MATCH_MIN_DISPLAY_MS freeze (Phase-3 G5)", () => {
  it("remains at least 1000ms product floor", () => {
    expect(PICK_MATCH_MIN_DISPLAY_MS).toBeGreaterThanOrEqual(1000);
  });
});
