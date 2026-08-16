import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { listLocalPluginCatalog } from "./pluginLocalCatalog";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("listLocalPluginCatalog", () => {
  it("lists in-repo transitional packages without marking them installed or remote", () => {
    const catalog = listLocalPluginCatalog();
    expect(catalog.map((item) => item.pluginId)).toEqual([
      "com.mossx.engine.claude",
      "com.mossx.notes",
      "com.mossx.kanban",
      "com.mossx.project-map",
      "com.mossx.browser",
      "com.mossx.intent-canvas",
    ]);
    expect(catalog.every((item) => item.installed === false)).toBe(true);
    expect(catalog.every((item) => item.remote === false)).toBe(true);
    for (const item of catalog) {
      expect(existsSync(join(repoRoot, item.packageDir, ".mossx-plugin/plugin.json"))).toBe(true);
    }
    const registry = readFileSync(join(repoRoot, "src-tauri/src/plugin_rack.rs"), "utf8");
    expect(registry).not.toContain("install_plugin");
    expect(registry).not.toContain("uninstall_plugin");
  });
});
