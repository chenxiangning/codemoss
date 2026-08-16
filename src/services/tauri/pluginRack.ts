import { invoke, isTauri } from "@tauri-apps/api/core";

export type PluginRackPlug = {
  pluginId: string;
  displayName: string;
  kind: string;
  ownerClass: string;
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
      ownerClass: "pilot",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.notes",
      displayName: "Notes",
      kind: "feature",
      ownerClass: "pilot",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.project-map",
      displayName: "Project Map",
      kind: "feature",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.browser",
      displayName: "Browser",
      kind: "feature",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.intent-canvas",
      displayName: "Intent Canvas",
      kind: "feature",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.codex",
      displayName: "Codex Engine",
      kind: "engine",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.gemini",
      displayName: "Gemini Engine",
      kind: "engine",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.grok",
      displayName: "Grok Engine",
      kind: "engine",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.kimi",
      displayName: "Kimi Engine",
      kind: "engine",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.opencode",
      displayName: "OpenCode Engine",
      kind: "engine",
      ownerClass: "later-plugin",
      state: "idle",
      generation: 0,
      unitId: null,
      live: false,
    },
    {
      pluginId: "com.mossx.engine.pi",
      displayName: "Pi Engine",
      kind: "engine",
      ownerClass: "later-plugin",
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
