import { describe, expect, it } from "vitest";
import {
  buildAvailableEngines,
  ENABLED_ENGINE_TYPES,
  excludeUninstalledPluginEngines,
  resolveEngineWhenClaudeUninstalled,
} from "./engineControllerAvailability";

describe("engineControllerAvailability", () => {
  it("projects labels from the canonical registry and excludes retired engines", () => {
    expect(ENABLED_ENGINE_TYPES).toEqual([
      "claude",
      "codex",
      "grok",
      "kimi",
      "opencode",
      "pi",
    ]);
    expect(buildAvailableEngines([], false)).toEqual([
      expect.objectContaining({
        type: "claude",
        displayName: "Claude Code",
        shortName: "Claude Code",
        availabilityState: "loading",
      }),
      expect.objectContaining({
        type: "codex",
        displayName: "Codex CLI",
        shortName: "Codex",
      }),
      expect.objectContaining({
        type: "grok",
        displayName: "Grok CLI",
        shortName: "Grok",
      }),
      expect.objectContaining({
        type: "kimi",
        displayName: "Kimi CLI",
        shortName: "Kimi",
      }),
      expect.objectContaining({
        type: "opencode",
        displayName: "OpenCode",
        shortName: "OpenCode",
      }),
      expect.objectContaining({
        type: "pi",
        displayName: "PI CLI",
        shortName: "PI",
      }),
    ]);
  });

  it("keeps Claude when the plug is still present", () => {
    const engines = buildAvailableEngines([], true);
    expect(
      excludeUninstalledPluginEngines(engines, true).map((engine) => engine.type),
    ).toContain("claude");
  });

  it("drops Claude from available engines after uninstall", () => {
    const engines = buildAvailableEngines([], true);
    expect(
      excludeUninstalledPluginEngines(engines, false).map((engine) => engine.type),
    ).toEqual(["codex", "grok", "kimi", "opencode", "pi"]);
  });

  it("switches away from Claude only after the plug is uninstalled", () => {
    expect(
      resolveEngineWhenClaudeUninstalled("claude", ["claude", "codex"], ENABLED_ENGINE_TYPES, true),
    ).toBe("claude");
    expect(
      resolveEngineWhenClaudeUninstalled("claude", ["claude", "codex"], ENABLED_ENGINE_TYPES, false),
    ).toBe("codex");
    expect(
      resolveEngineWhenClaudeUninstalled("codex", ["codex"], ENABLED_ENGINE_TYPES, false),
    ).toBe("codex");
    expect(
      resolveEngineWhenClaudeUninstalled("claude", [], ENABLED_ENGINE_TYPES, false),
    ).toBe("codex");
  });
});
