/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";

import { DECLARED_PLUGIN_RACK_SNAPSHOT, type PluginRackSnapshot } from "./tauri/pluginRack";
import {
  __resetPluginPresenceForTests,
  getPluginPresenceSnapshot,
  isPlugPresentInSnapshot,
  publishPluginRackSnapshot,
  subscribePluginPresence,
} from "./pluginPresence";

function snapshotWithDesiredState(
  pluginId: string,
  desiredState: "installed" | "uninstalled",
): PluginRackSnapshot {
  return {
    ...DECLARED_PLUGIN_RACK_SNAPSHOT,
    plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
      plug.pluginId === pluginId ? { ...plug, desiredState } : plug,
    ),
  };
}

describe("pluginPresence", () => {
  beforeEach(() => {
    __resetPluginPresenceForTests();
  });

  it("defaults every allowlisted plug to present before the first snapshot", () => {
    expect(getPluginPresenceSnapshot()).toEqual({
      notes: true,
      projectMap: true,
      claude: true,
    });
  });

  it("treats a missing plug as present so the product shell does not flash-hide", () => {
    const empty: PluginRackSnapshot = {
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: [],
    };
    expect(isPlugPresentInSnapshot(empty, "com.mossx.notes")).toBe(true);
    expect(isPlugPresentInSnapshot(empty, "com.mossx.project-map")).toBe(true);
    expect(isPlugPresentInSnapshot(empty, "com.mossx.engine.claude")).toBe(true);
    expect(publishPluginRackSnapshot(empty)).toEqual({
      notes: true,
      projectMap: true,
      claude: true,
    });
  });

  it("hides only the uninstalled allowlisted plugs", () => {
    expect(publishPluginRackSnapshot(snapshotWithDesiredState("com.mossx.notes", "uninstalled"))).toEqual({
      notes: false,
      projectMap: true,
      claude: true,
    });
    expect(
      publishPluginRackSnapshot(snapshotWithDesiredState("com.mossx.project-map", "uninstalled")),
    ).toEqual({
      notes: true,
      projectMap: false,
      claude: true,
    });
    expect(
      publishPluginRackSnapshot(snapshotWithDesiredState("com.mossx.engine.claude", "uninstalled")),
    ).toEqual({
      notes: true,
      projectMap: true,
      claude: false,
    });
  });

  it("does not notify listeners when presence did not change", () => {
    let notifyCount = 0;
    const unsubscribe = subscribePluginPresence(() => {
      notifyCount += 1;
    });
    publishPluginRackSnapshot(DECLARED_PLUGIN_RACK_SNAPSHOT);
    publishPluginRackSnapshot(snapshotWithDesiredState("com.mossx.browser", "installed"));
    expect(notifyCount).toBe(0);
    publishPluginRackSnapshot(snapshotWithDesiredState("com.mossx.notes", "uninstalled"));
    expect(notifyCount).toBe(1);
    expect(getPluginPresenceSnapshot()).toEqual({
      notes: false,
      projectMap: true,
      claude: true,
    });
    unsubscribe();
  });
});
