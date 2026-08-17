import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: () => false,
}));

import {
  DECLARED_PLUGIN_RACK_SNAPSHOT,
  getPluginRackSnapshot,
  installPlugin,
  installPluginFromPath,
  resetPreviewPluginRackSnapshot,
  uninstallPlugin,
} from "./pluginRack";

const currentDir = dirname(fileURLToPath(import.meta.url));
const ownership = JSON.parse(
  readFileSync(
    join(currentDir, "../../../docs/architecture/plugin-platform/inventory/ownership.json"),
    "utf8",
  ),
) as { owners: Array<{ targetPluginId?: string | null }> };

describe("DECLARED_PLUGIN_RACK_SNAPSHOT", () => {
  it("lists inventoried later feature and CLI plugs after the three pilots without inventing ids", () => {
    const pluginIds = DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) => plug.pluginId);
    expect(pluginIds).toEqual([
      "com.mossx.engine.claude",
      "com.mossx.notes",
      "com.mossx.project-map",
      "com.mossx.browser",
      "com.mossx.intent-canvas",
      "com.mossx.kanban",
      "com.mossx.engine.codex",
      "com.mossx.engine.gemini",
      "com.mossx.engine.grok",
      "com.mossx.engine.kimi",
      "com.mossx.engine.opencode",
      "com.mossx.engine.pi",
    ]);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.hostEnabled).toBe(false);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.supervisorLive).toBe(false);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.every((plug) => plug.state === "idle")).toBe(true);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.plugs[0]).toMatchObject({
      productPath: "process-entry",
      circuit: "live",
      coreOwner: "disabled",
      installable: true,
      desiredState: "installed",
      contributionsLive: false,
      allowlistedLive: false,
    });
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.plugs[1]).toMatchObject({
      productPath: "isolated-sqlite",
      circuit: "live",
      coreOwner: "disabled",
      installable: true,
      desiredState: "installed",
      contributionsLive: false,
      allowlistedLive: false,
    });
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.plugs[2]).toMatchObject({
      productPath: "isolated-sqlite",
      circuit: "live",
      coreOwner: "disabled",
      installable: true,
      desiredState: "installed",
      contributionsLive: false,
      allowlistedLive: false,
      ownerClass: "pilot",
    });
    expect(
      DECLARED_PLUGIN_RACK_SNAPSHOT.plugs
        .slice(3)
        .every((plug) => !plug.installable && plug.desiredState === "uninstalled"),
    ).toBe(true);
    expect(
      DECLARED_PLUGIN_RACK_SNAPSHOT.plugs
        .slice(3)
        .every(
          (plug) =>
            plug.productPath === "undeclared" &&
            plug.circuit === "idle" &&
            plug.coreOwner === "active",
        ),
    ).toBe(true);
    expect(
      DECLARED_PLUGIN_RACK_SNAPSHOT.plugs
        .filter(
          (plug) =>
            plug.pluginId === "com.mossx.engine.claude"
            || plug.pluginId === "com.mossx.notes"
            || plug.pluginId === "com.mossx.project-map",
        )
        .every((plug) => plug.ownerClass === "pilot"),
    ).toBe(true);
    expect(
      DECLARED_PLUGIN_RACK_SNAPSHOT.plugs
        .filter(
          (plug) =>
            plug.pluginId !== "com.mossx.engine.claude"
            && plug.pluginId !== "com.mossx.notes"
            && plug.pluginId !== "com.mossx.project-map",
        )
        .every((plug) => plug.ownerClass === "later-plugin"),
    ).toBe(true);

    const inventoried = new Set(
      ownership.owners
        .map((owner) => owner.targetPluginId)
        .filter((pluginId): pluginId is string => Boolean(pluginId)),
    );
    for (const pluginId of pluginIds) {
      expect(inventoried.has(pluginId)).toBe(true);
    }
  });
});

describe("browser preview plugin rack", () => {
  afterEach(() => {
    resetPreviewPluginRackSnapshot();
  });

  it("toggles an allowlisted plug in memory and leaves later plugs sealed", async () => {
    const uninstalled = await uninstallPlugin("com.mossx.notes");
    expect(uninstalled.plugs.find((plug) => plug.pluginId === "com.mossx.notes")?.desiredState).toBe(
      "uninstalled",
    );
    expect(uninstalled.plugs.find((plug) => plug.pluginId === "com.mossx.engine.claude")?.desiredState).toBe(
      "installed",
    );

    const snapshot = await getPluginRackSnapshot();
    expect(snapshot.plugs.find((plug) => plug.pluginId === "com.mossx.notes")?.desiredState).toBe(
      "uninstalled",
    );

    const reinstalled = await installPlugin("com.mossx.notes");
    expect(reinstalled.plugs.find((plug) => plug.pluginId === "com.mossx.notes")?.desiredState).toBe(
      "installed",
    );
    expect(reinstalled.plugs.slice(3).every((plug) => plug.desiredState === "uninstalled")).toBe(true);
  });

  it("rejects install from path in the browser preview", async () => {
    await expect(installPluginFromPath("com.mossx.notes", "/tmp/mossx-plugin-notes")).rejects.toThrow(
      "install-from-path-unavailable",
    );
    const snapshot = await getPluginRackSnapshot();
    expect(snapshot.plugs.find((plug) => plug.pluginId === "com.mossx.notes")?.desiredState).toBe("installed");
  });

  it("rejects a sealed later plugin without changing the snapshot", async () => {
    await expect(installPlugin("com.mossx.browser")).rejects.toThrow("plugin-not-allowlisted");
    const snapshot = await getPluginRackSnapshot();
    expect(snapshot.plugs.find((plug) => plug.pluginId === "com.mossx.browser")?.desiredState).toBe(
      "uninstalled",
    );
    expect(snapshot.plugs.find((plug) => plug.pluginId === "com.mossx.notes")?.desiredState).toBe("installed");
  });

  it("resets the preview snapshot back to the declared default", async () => {
    await uninstallPlugin("com.mossx.project-map");
    resetPreviewPluginRackSnapshot();
    const snapshot = await getPluginRackSnapshot();
    expect(snapshot.plugs.find((plug) => plug.pluginId === "com.mossx.project-map")?.desiredState).toBe(
      "installed",
    );
  });
});
