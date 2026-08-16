import { invoke, isTauri } from "@tauri-apps/api/core";

export type PluginRackPlug = {
  pluginId: string;
  displayName: string;
  kind: string;
  state: string;
  generation: number;
  unitId: string | null;
  live: boolean;
};

export type PluginRackSnapshot = {
  hostAvailable: boolean;
  hostEnabled: boolean;
  plugs: PluginRackPlug[];
};

export const DECLARED_PLUGIN_RACK_SNAPSHOT: PluginRackSnapshot = {
  hostAvailable: false,
  hostEnabled: false,
  plugs: [
    {
      pluginId: "com.mossx.engine.claude",
      displayName: "Claude Engine",
      kind: "engine",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.notes",
      displayName: "Notes",
      kind: "feature",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
  ],
};

export async function getPluginRackSnapshot(): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    return DECLARED_PLUGIN_RACK_SNAPSHOT;
  }
  return invoke<PluginRackSnapshot>("get_plugin_rack_snapshot");
}
