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
  productPath: string;
  circuit: string;
  coreOwner: string;
  installable: boolean;
  desiredState: string;
  contributionsLive: boolean;
  allowlistedLive: boolean;
};

export type PluginRackSnapshot = {
  hostAvailable: boolean;
  hostEnabled: boolean;
  supervisorLive: boolean;
  supervisorPid: number | null;
  supervisorPath: string | null;
  plugs: PluginRackPlug[];
};

export const DECLARED_PLUGIN_CIRCUITS = {
  claude: { productPath: "process-entry", circuit: "live", coreOwner: "disabled" },
  notes: { productPath: "isolated-sqlite", circuit: "live", coreOwner: "disabled" },
  projectMap: { productPath: "isolated-sqlite", circuit: "live", coreOwner: "disabled" },
  later: { productPath: "undeclared", circuit: "idle", coreOwner: "active" },
} as const;

function declaredPlug(
  pluginId: string,
  displayName: string,
  kind: string,
  ownerClass: string,
  circuit: { productPath: string; circuit: string; coreOwner: string },
): PluginRackPlug {
  return {
    pluginId,
    displayName,
    kind,
    ownerClass,
    state: "idle",
    generation: 0,
    unitId: null,
    live: false,
    productPath: circuit.productPath,
    circuit: circuit.circuit,
    coreOwner: circuit.coreOwner,
    installable:
      pluginId === "com.mossx.notes"
      || pluginId === "com.mossx.engine.claude"
      || pluginId === "com.mossx.project-map",
    desiredState:
      pluginId === "com.mossx.notes"
      || pluginId === "com.mossx.engine.claude"
      || pluginId === "com.mossx.project-map"
        ? "installed"
        : "uninstalled",
    contributionsLive: false,
    allowlistedLive: false,
  };
}

export const DECLARED_PLUGIN_RACK_SNAPSHOT: PluginRackSnapshot = {
  hostAvailable: false,
  hostEnabled: false,
  supervisorLive: false,
  supervisorPid: null,
  supervisorPath: null,
  plugs: [
    declaredPlug("com.mossx.engine.claude", "Claude Engine", "engine", "pilot", DECLARED_PLUGIN_CIRCUITS.claude),
    declaredPlug("com.mossx.notes", "Notes", "feature", "pilot", DECLARED_PLUGIN_CIRCUITS.notes),
    declaredPlug("com.mossx.project-map", "Project Map", "feature", "pilot", DECLARED_PLUGIN_CIRCUITS.projectMap),
    declaredPlug("com.mossx.browser", "Browser", "feature", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.intent-canvas", "Intent Canvas", "feature", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.kanban", "Kanban", "feature", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.codex", "Codex Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.gemini", "Gemini Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.grok", "Grok Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.kimi", "Kimi Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.opencode", "OpenCode Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
    declaredPlug("com.mossx.engine.pi", "Pi Engine", "engine", "later-plugin", DECLARED_PLUGIN_CIRCUITS.later),
  ],
};

export async function getPluginRackSnapshot(): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    return DECLARED_PLUGIN_RACK_SNAPSHOT;
  }
  return invoke<PluginRackSnapshot>("get_plugin_rack_snapshot");
}

export async function installPlugin(pluginId: string): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    throw new Error("plugin-host-unavailable");
  }
  return invoke<PluginRackSnapshot>("install_plugin", { pluginId });
}

export async function uninstallPlugin(pluginId: string): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    throw new Error("plugin-host-unavailable");
  }
  return invoke<PluginRackSnapshot>("uninstall_plugin", { pluginId });
}
