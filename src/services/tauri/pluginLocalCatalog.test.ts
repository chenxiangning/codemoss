import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DECLARED_PLUGIN_RACK_SNAPSHOT } from "./pluginRack";
import { listLocalPluginCatalog } from "./pluginLocalCatalog";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("listLocalPluginCatalog", () => {
  it("lists in-repo transitional packages without marking them installed or remote", () => {
    const catalog = listLocalPluginCatalog();
    const pluginIds = catalog.map((item) => item.pluginId);
    expect(pluginIds).toContain("com.mossx.engine.claude");
    expect(pluginIds).toContain("com.mossx.notes");
    expect(pluginIds).toContain("com.mossx.kanban");
    expect(pluginIds).toContain("com.mossx.git-history");
    expect(pluginIds).toContain("com.mossx.spec");
    expect(pluginIds).toContain("com.mossx.terminal");
    expect(catalog).toHaveLength(45);
    expect(catalog.every((item) => item.installed === false)).toBe(true);
    expect(catalog.every((item) => item.remote === false)).toBe(true);
    const notes = catalog.find((item) => item.pluginId === "com.mossx.notes");
    expect(notes?.capabilities).toEqual(["mossx.ui.slot.workspace.main", "mossx.storage.readwrite"]);
    const claude = catalog.find((item) => item.pluginId === "com.mossx.engine.claude");
    expect(claude?.capabilities).toEqual([
      "mossx.engine.provider",
      "mossx.process.spawn",
      "mossx.workspace.read",
    ]);
    for (const item of catalog) {
      expect(existsSync(join(repoRoot, item.packageDir, ".mossx-plugin/plugin.json"))).toBe(true);
    }
    const rackIds = DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) => plug.pluginId);
    expect(rackIds).toHaveLength(12);
    expect(pluginIds.filter((pluginId) => !rackIds.includes(pluginId))).toContain("com.mossx.git-history");
    const registry = readFileSync(join(repoRoot, "src-tauri/src/plugin_rack.rs"), "utf8");
    expect(registry).not.toContain("install_plugin");
    expect(registry).not.toContain("uninstall_plugin");
  });
});
