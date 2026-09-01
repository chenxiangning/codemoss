import { describe, expect, it } from "vitest";
import type { EngineFeatures, EngineStatus } from "../../../types";
import {
  buildAvailableEngines,
  DISPLAY_ENGINE_TYPES,
  ENABLED_ENGINE_TYPES,
} from "./engineControllerAvailability";
describe("engineControllerAvailability", () => {
  it("projects all registered engines into execution when policy allows them", () => {
    expect(DISPLAY_ENGINE_TYPES).toContain("omp");
    expect(ENABLED_ENGINE_TYPES).toContain("omp");
  });

  it("projects labels from the canonical registry and excludes retired engines", () => {
    expect(ENABLED_ENGINE_TYPES).toEqual([
      "claude",
      "codex",
      "grok",
      "kimi",
      "opencode",
      "pi",
      "dsh",
      "qoder",
      "omp",
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
        type: "gemini",
        displayName: "Gemini CLI",
        shortName: "Gemini",
        availabilityState: "loading",
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
      expect.objectContaining({
        type: "dsh",
        displayName: "DeepSeek Harness",
        shortName: "DSH",
      }),
      expect.objectContaining({
        type: "qoder",
        displayName: "Qoder CLI",
        shortName: "Qoder",
      }),
      expect.objectContaining({
        type: "omp",
        displayName: "OMP CLI",
        shortName: "OMP",
        availabilityState: "loading",
      }),
    ]);
  });
  it("projects OMP as ready when backend detection reports it installed", () => {
    const omp = buildAvailableEngines(
      [
        {
          engineType: "omp",
          features: {} as EngineFeatures,
          installed: true,
          version: "18.0.11",
          binPath: "/opt/homebrew/bin/omp",
          models: [],
          error: null,
        },
      ],
      true,
    ).find((engine) => engine.type === "omp");

    expect(omp).toMatchObject({
      installed: true,
      version: "18.0.11",
      availabilityState: "ready",
      availabilityLabelKey: null,
    });
  });
});

describe("engineControllerAvailability auth state (B6)", () => {
  const baseStatus: EngineStatus = {
    engineType: "qoder",
    features: {} as EngineFeatures,
    installed: true,
    version: "1.1.28",
    binPath: null,
    models: [],
    error: null,
  };

  it("projects requires-login when phase 2 reports requires_login", () => {
    const engines = buildAvailableEngines(
      [{ ...baseStatus, authState: "requires_login" }],
      true,
    );
    const qoder = engines.find((engine) => engine.type === "qoder");
    expect(qoder?.availabilityState).toBe("requires-login");
    expect(qoder?.availabilityLabelKey).toBe("workspace.engineStatusRequiresLogin");
  });

  it("keeps ready when authenticated or unknown", () => {
    const engines = buildAvailableEngines(
      [
        { ...baseStatus, authState: "authenticated" as const },
        baseStatus,
      ].map((status, index): EngineStatus => ({
        ...status,
        engineType: index === 0 ? "qoder" : "kimi",
      })),
      true,
    );
    expect(engines.find((engine) => engine.type === "qoder")?.availabilityState).toBe("ready");
    expect(engines.find((engine) => engine.type === "kimi")?.availabilityState).toBe("ready");
  });
});
