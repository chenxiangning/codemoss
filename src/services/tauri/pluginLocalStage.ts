import { previewInstall, validateRegistration } from "@/plugin-kernel/installPreview";
import type { ValidatedManifest } from "@/plugin-kernel/types";

import { LOCAL_PLUGIN_CATALOG } from "./pluginLocalCatalog";

export const LOCAL_PLUGIN_STAGE_KEY = "ccgui.pluginLocalStage.v1";

export type LocalLockfileRow = {
  pluginId: string;
  version: string;
  artifactHash: string;
};

export type LocalStageResult = {
  ok: boolean;
  pluginId: string;
  staged: boolean;
  previewed: boolean;
  activatedHost: false;
  version?: string;
  artifactHash?: string;
};

function isLockfileRow(value: unknown): value is LocalLockfileRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as LocalLockfileRow).pluginId === "string" &&
    typeof (value as LocalLockfileRow).version === "string" &&
    typeof (value as LocalLockfileRow).artifactHash === "string"
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
        const catalog = LOCAL_PLUGIN_CATALOG.find((entry) => entry.pluginId === item);
        return catalog
          ? [{ pluginId: item, version: "1.0.0", artifactHash: catalog.artifactHash }]
          : [];
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

export function stageLocalPlugin(
  pluginId: string,
  extraCapabilities: string[] = [],
  artifactHash?: string,
): LocalStageResult {
  const manifest = catalogManifestStub(pluginId);
  if (!manifest) {
    return { ok: false, pluginId, staged: false, previewed: false, activatedHost: false };
  }
  const preview = previewInstall(manifest);
  if (preview.loadsEntries || preview.pluginId !== pluginId) {
    return { ok: false, pluginId, staged: false, previewed: false, activatedHost: false };
  }
  const registration = validateRegistration(manifest, {
    capabilities: [...manifest.capabilities.map((item) => item.id), ...extraCapabilities],
  });
  if (!registration.ok) {
    return { ok: false, pluginId, staged: false, previewed: true, activatedHost: false };
  }
  const item = LOCAL_PLUGIN_CATALOG.find((entry) => entry.pluginId === pluginId);
  const nextHash = artifactHash ?? item?.artifactHash;
  if (!nextHash) {
    return { ok: false, pluginId, staged: false, previewed: true, activatedHost: false };
  }
  const existing = readLockfile().find(
    (row) => row.pluginId === pluginId && row.version === manifest.version,
  );
  if (existing && existing.artifactHash !== nextHash) {
    return { ok: false, pluginId, staged: true, previewed: true, activatedHost: false, version: existing.version, artifactHash: existing.artifactHash };
  }
  writeLockfile([...readLockfile(), { pluginId, version: manifest.version, artifactHash: nextHash }]);
  return {
    ok: true,
    pluginId,
    staged: true,
    previewed: true,
    activatedHost: false,
    version: manifest.version,
    artifactHash: nextHash,
  };
}

export function unstageLocalPlugin(pluginId: string): LocalStageResult {
  writeLockfile(readLockfile().filter((row) => row.pluginId !== pluginId));
  return { ok: true, pluginId, staged: false, previewed: false, activatedHost: false };
}
