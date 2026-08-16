import { previewInstall } from "@/plugin-kernel/installPreview";
import type { ValidatedManifest } from "@/plugin-kernel/types";

import { LOCAL_PLUGIN_CATALOG } from "./pluginLocalCatalog";

export const LOCAL_PLUGIN_STAGE_KEY = "ccgui.pluginLocalStage.v1";

export type LocalStageResult = {
  ok: boolean;
  pluginId: string;
  staged: boolean;
  previewed: boolean;
  activatedHost: false;
};

function readStaged(): string[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(LOCAL_PLUGIN_STAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeStaged(pluginIds: string[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(LOCAL_PLUGIN_STAGE_KEY, JSON.stringify([...new Set(pluginIds)]));
}

export function listStagedLocalPlugins(): string[] {
  return readStaged();
}

export function isLocalPluginStaged(pluginId: string): boolean {
  return readStaged().includes(pluginId);
}

export function catalogManifestStub(pluginId: string): ValidatedManifest | null {
  const item = LOCAL_PLUGIN_CATALOG.find((entry) => entry.pluginId === pluginId);
  if (!item) {
    return null;
  }
  return {
    pluginId: item.pluginId,
    version: "1.0.0",
    manifestVersion: 1,
    channel: "stable",
    displayName: item.displayName,
    entries: [],
    activationUnits: [],
    contributions: [],
    contributionTemplates: [],
    capabilities: item.capabilities.map((id) => ({ id, role: "consumer" as const })),
    requiredClosureByUnit: {},
  };
}

export function stageLocalPlugin(pluginId: string): LocalStageResult {
  const manifest = catalogManifestStub(pluginId);
  if (!manifest) {
    return { ok: false, pluginId, staged: false, previewed: false, activatedHost: false };
  }
  const preview = previewInstall(manifest);
  if (preview.loadsEntries || preview.pluginId !== pluginId) {
    return { ok: false, pluginId, staged: false, previewed: false, activatedHost: false };
  }
  writeStaged([...readStaged(), pluginId]);
  return { ok: true, pluginId, staged: true, previewed: true, activatedHost: false };
}

export function unstageLocalPlugin(pluginId: string): LocalStageResult {
  writeStaged(readStaged().filter((item) => item !== pluginId));
  return { ok: true, pluginId, staged: false, previewed: false, activatedHost: false };
}
