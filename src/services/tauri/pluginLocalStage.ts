import { previewInstall } from "@/plugin-kernel/installPreview";
import type { ValidatedManifest } from "@/plugin-kernel/types";

import { LOCAL_PLUGIN_CATALOG } from "./pluginLocalCatalog";

export const LOCAL_PLUGIN_STAGE_KEY = "ccgui.pluginLocalStage.v1";

export type LocalLockfileRow = {
  pluginId: string;
  version: string;
};

export type LocalStageResult = {
  ok: boolean;
  pluginId: string;
  staged: boolean;
  previewed: boolean;
  activatedHost: false;
  version?: string;
};

function isLockfileRow(value: unknown): value is LocalLockfileRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LocalLockfileRow).pluginId === "string" &&
    typeof (value as LocalLockfileRow).version === "string"
  );
}

function readLockfile(): LocalLockfileRow[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(LOCAL_PLUGIN_STAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (typeof item === "string") {
        return [{ pluginId: item, version: "1.0.0" }];
      }
      return isLockfileRow(item) ? [item] : [];
    });
  } catch {
    return [];
  }
}

function writeLockfile(rows: LocalLockfileRow[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  const unique = new Map(rows.map((row) => [row.pluginId, row]));
  localStorage.setItem(LOCAL_PLUGIN_STAGE_KEY, JSON.stringify([...unique.values()]));
}

export function listLocalLockfile(): LocalLockfileRow[] {
  return readLockfile();
}

export function listStagedLocalPlugins(): string[] {
  return readLockfile().map((row) => row.pluginId);
}

export function isLocalPluginStaged(pluginId: string): boolean {
  return readLockfile().some((row) => row.pluginId === pluginId);
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
  writeLockfile([...readLockfile(), { pluginId, version: manifest.version }]);
  return {
    ok: true,
    pluginId,
    staged: true,
    previewed: true,
    activatedHost: false,
    version: manifest.version,
  };
}

export function unstageLocalPlugin(pluginId: string): LocalStageResult {
  writeLockfile(readLockfile().filter((row) => row.pluginId !== pluginId));
  return { ok: true, pluginId, staged: false, previewed: false, activatedHost: false };
}
