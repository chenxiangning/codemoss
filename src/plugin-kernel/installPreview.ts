import type { ManifestCapability, ManifestContribution, ValidatedManifest } from "./types";

export type InstallPreview = {
  pluginId: string;
  version: string;
  displayName?: string;
  channel: "stable" | "beta";
  contributions: ManifestContribution[];
  capabilities: ManifestCapability[];
  permissionDiff: string[];
  loadsEntries: false;
};

export type RegistrationRequest = {
  contributions?: string[];
  capabilities?: string[];
};

export type RegistrationResult = {
  ok: boolean;
  visibleContributions: string[];
  visibleCapabilities: string[];
  rejected: Array<{ kind: "contribution" | "capability"; id: string }>;
};

export function previewInstall(manifest: ValidatedManifest): InstallPreview {
  const permissionDiff = manifest.capabilities
    .filter((capability) => capability.role === "consumer")
    .map((capability) => capability.id);
  return {
    pluginId: manifest.pluginId,
    version: manifest.version,
    displayName: manifest.displayName,
    channel: manifest.channel,
    contributions: manifest.contributions,
    capabilities: manifest.capabilities,
    permissionDiff,
    loadsEntries: false,
  };
}

export function validateRegistration(
  manifest: ValidatedManifest,
  request: RegistrationRequest,
): RegistrationResult {
  const declaredContributions = new Set(manifest.contributions.map((item) => item.id));
  const declaredCapabilities = new Set(manifest.capabilities.map((item) => item.id));
  const rejected: RegistrationResult["rejected"] = [];
  const visibleContributions: string[] = [];
  const visibleCapabilities: string[] = [];

  for (const id of request.contributions ?? []) {
    if (declaredContributions.has(id)) {
      visibleContributions.push(id);
    } else {
      rejected.push({ kind: "contribution", id });
    }
  }
  for (const id of request.capabilities ?? []) {
    if (declaredCapabilities.has(id)) {
      visibleCapabilities.push(id);
    } else {
      rejected.push({ kind: "capability", id });
    }
  }

  return {
    ok: rejected.length === 0,
    visibleContributions,
    visibleCapabilities,
    rejected,
  };
}
