import { describe, expect, it } from "vitest";
import {
  isSharedSessionSupportedEngine,
  normalizeSharedSessionEngine,
} from "./sharedSessionEngines";

describe("sharedSessionEngines", () => {
  it.each(["claude", "codex", "kimi", "grok", "opencode"] as const)(
    "accepts %s as a Shared Session target",
    (engine) => {
      expect(isSharedSessionSupportedEngine(engine)).toBe(true);
      expect(normalizeSharedSessionEngine(engine)).toBe(engine);
    },
  );

  it("keeps unsupported engines on claude fallback", () => {
    expect(isSharedSessionSupportedEngine("gemini")).toBe(false);
    expect(normalizeSharedSessionEngine("gemini")).toBe("claude");
  });

  it("keeps pi as a native-only engine outside Shared Session", () => {
    expect(isSharedSessionSupportedEngine("pi")).toBe(false);
    expect(normalizeSharedSessionEngine("pi")).toBe("claude");
  });
});
