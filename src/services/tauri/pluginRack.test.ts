import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DECLARED_PLUGIN_RACK_SNAPSHOT } from "./pluginRack";

const currentDir = dirname(fileURLToPath(import.meta.url));
const ownership = JSON.parse(
  readFileSync(
    join(currentDir, "../../../docs/architecture/plugin-platform/inventory/ownership.json"),
    "utf8",
  ),
) as { owners: Array<{ targetPluginId?: string | null }> };

describe("DECLARED_PLUGIN_RACK_SNAPSHOT", () => {
  it("lists inventoried later plugs after the two pilots without inventing ids", () => {
    const pluginIds = DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) => plug.pluginId);
    expect(pluginIds).toEqual([
      "com.mossx.engine.claude",
      "com.mossx.notes",
      "com.mossx.project-map",
      "com.mossx.browser",
      "com.mossx.intent-canvas",
    ]);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.hostEnabled).toBe(false);
    expect(DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.every((plug) => plug.state === "idle")).toBe(true);

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
