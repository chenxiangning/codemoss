import { invoke, isTauri } from "@tauri-apps/api/core";

import { publishPluginRackSnapshot } from "../pluginPresence";

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

export const ALLOWLISTED_PLUGIN_IDS = [
  "com.mossx.engine.claude",
  "com.mossx.notes",
  "com.mossx.project-map",
] as const;

export type AllowlistedPluginId = (typeof ALLOWLISTED_PLUGIN_IDS)[number];

export function isAllowlistedPluginId(pluginId: string): pluginId is AllowlistedPluginId {
  return (ALLOWLISTED_PLUGIN_IDS as readonly string[]).includes(pluginId);
}

export function isPlugged(plug: PluginRackPlug): boolean {
  return plug.desiredState !== "uninstalled";
}

export function partitionPluginRackPlugs(plugs: PluginRackPlug[]): {
  live: PluginRackPlug[];
  later: PluginRackPlug[];
} {
  const live: PluginRackPlug[] = [];
  const later: PluginRackPlug[] = [];
  for (const plug of plugs) {
    if (plug.installable) {
      live.push(plug);
    } else {
      later.push(plug);
    }
  }
  return { live, later };
}

export function listingCopyKey(pluginId: string): "claude" | "notes" | "projectMap" | "later" {
  if (pluginId === "com.mossx.engine.claude") {
    return "claude";
  }
  if (pluginId === "com.mossx.notes") {
    return "notes";
  }
  if (pluginId === "com.mossx.project-map") {
    return "projectMap";
  }
  return "later";
}

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
    installable: isAllowlistedPluginId(pluginId),
    desiredState: isAllowlistedPluginId(pluginId) ? "installed" : "uninstalled",
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

function clonePluginRackSnapshot(snapshot: PluginRackSnapshot): PluginRackSnapshot {
  return {
    ...snapshot,
    plugs: snapshot.plugs.map((plug) => ({ ...plug })),
  };
}

let previewSnapshot = clonePluginRackSnapshot(DECLARED_PLUGIN_RACK_SNAPSHOT);

export function resetPreviewPluginRackSnapshot(): void {
  previewSnapshot = clonePluginRackSnapshot(DECLARED_PLUGIN_RACK_SNAPSHOT);
  publishPluginRackSnapshot(previewSnapshot);
}

function applyPreviewDesiredState(
  pluginId: string,
  desiredState: "installed" | "uninstalled",
): PluginRackSnapshot {
  if (!isAllowlistedPluginId(pluginId)) {
    throw new Error("plugin-not-allowlisted");
  }
  previewSnapshot = {
    ...previewSnapshot,
    plugs: previewSnapshot.plugs.map((plug) =>
      plug.pluginId === pluginId ? { ...plug, desiredState } : plug,
    ),
  };
  return clonePluginRackSnapshot(previewSnapshot);
}

function publishAndReturn(snapshot: PluginRackSnapshot): PluginRackSnapshot {
  publishPluginRackSnapshot(snapshot);
  return snapshot;
}

export async function getPluginRackSnapshot(): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    return publishAndReturn(clonePluginRackSnapshot(previewSnapshot));
  }
  return publishAndReturn(await invoke<PluginRackSnapshot>("get_plugin_rack_snapshot"));
}

export async function installPlugin(pluginId: string): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    return publishAndReturn(applyPreviewDesiredState(pluginId, "installed"));
  }
  return publishAndReturn(await invoke<PluginRackSnapshot>("install_plugin", { pluginId }));
}

export async function installPluginFromPath(
  pluginId: string,
  sourcePath: string,
): Promise<PluginRackSnapshot> {
  if (!isAllowlistedPluginId(pluginId)) {
    throw new Error("plugin-not-allowlisted");
  }
  if (!isTauri()) {
    throw new Error("install-from-path-unavailable");
  }
  return publishAndReturn(
    await invoke<PluginRackSnapshot>("install_plugin_from_path", { pluginId, sourcePath }),
  );
}

export async function uninstallPlugin(pluginId: string): Promise<PluginRackSnapshot> {
  if (!isTauri()) {
    return publishAndReturn(applyPreviewDesiredState(pluginId, "uninstalled"));
  }
  return publishAndReturn(await invoke<PluginRackSnapshot>("uninstall_plugin", { pluginId }));
}
