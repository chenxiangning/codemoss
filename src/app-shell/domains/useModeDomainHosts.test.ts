import { describe, expect, it } from "vitest";
import { resolveAppModeSurfaceFlags } from "./useModeDomainHosts";

describe("resolveAppModeSurfaceFlags", () => {
  it("marks kanban surface only for kanban mode", () => {
    expect(resolveAppModeSurfaceFlags("kanban").showKanban).toBe(true);
    expect(resolveAppModeSurfaceFlags("chat").showKanban).toBe(false);
  });

  it("treats chat and gitHistory as git surface modes", () => {
    expect(resolveAppModeSurfaceFlags("chat").isGitSurfaceMode).toBe(true);
    expect(resolveAppModeSurfaceFlags("gitHistory").isGitSurfaceMode).toBe(
      true,
    );
    expect(resolveAppModeSurfaceFlags("kanban").isGitSurfaceMode).toBe(false);
    expect(resolveAppModeSurfaceFlags("extensions").isGitSurfaceMode).toBe(
      false,
    );
    expect(resolveAppModeSurfaceFlags("market").isGitSurfaceMode).toBe(false);
  });

  it("flags extensions, market, and git history surfaces", () => {
    expect(resolveAppModeSurfaceFlags("extensions").showExtensions).toBe(true);
    expect(resolveAppModeSurfaceFlags("market").showMarket).toBe(true);
    expect(resolveAppModeSurfaceFlags("extensions").showMarket).toBe(false);
    expect(resolveAppModeSurfaceFlags("gitHistory").showGitHistory).toBe(true);
  });
});
