import type { EngineStatus, EngineType } from "../../../types";
import { isEngineExecutionEnabled } from "../../../utils/engineExecutionPolicy";
import {
  BUILTIN_ENGINE_TYPES,
  getEngineRegistryEntry,
} from "../engineRegistry";

export type EngineDisplayInfo = {
  type: EngineType;
  displayName: string;
  shortName: string;
  installed: boolean;
  version: string | null;
  error: string | null;
  availabilityState?: "loading" | "ready" | "requires-login" | "unavailable";
  availabilityLabelKey?: string | null;
};

export const ENABLED_ENGINE_TYPES: readonly EngineType[] = Object.freeze(
  BUILTIN_ENGINE_TYPES.filter((engineType) =>
    isEngineExecutionEnabled(engineType),
  ),
);

export function excludeUninstalledPluginEngines(
  engines: readonly EngineDisplayInfo[],
  claudePresent: boolean,
): EngineDisplayInfo[] {
  if (claudePresent) {
    return engines.slice();
  }
  return engines.filter((engine) => engine.type !== "claude");
}

export function resolveEngineWhenClaudeUninstalled(
  current: EngineType,
  installedTypes: readonly EngineType[],
  enabledTypes: readonly EngineType[],
  claudePresent: boolean,
): EngineType {
  if (claudePresent || current !== "claude") {
    return current;
  }
  return (
    installedTypes.find((engineType) => engineType !== "claude") ??
    enabledTypes.find((engineType) => engineType !== "claude") ??
    current
  );
}

export function buildAvailableEngines(
  engineStatuses: readonly EngineStatus[],
  isInitialized: boolean,
): EngineDisplayInfo[] {
  return ENABLED_ENGINE_TYPES.map((engineType) => {
    const status =
      engineStatuses.find((entry) => entry.engineType === engineType) ?? null;
    const registryEntry = getEngineRegistryEntry(engineType);
    let availabilityState: EngineDisplayInfo["availabilityState"] =
      "unavailable";
    let availabilityLabelKey: string | null = "sidebar.cliNotInstalled";

    if (!isInitialized) {
      availabilityState = "loading";
      availabilityLabelKey = "workspace.engineStatusLoading";
    } else if (status?.installed) {
      availabilityState = "ready";
      availabilityLabelKey = null;
    }

    return {
      type: engineType,
      displayName: registryEntry?.displayName ?? engineType,
      shortName: registryEntry?.shortName ?? engineType,
      installed: status?.installed ?? false,
      version: availabilityState === "loading" ? null : (status?.version ?? null),
      error: status?.error ?? null,
      availabilityState,
      availabilityLabelKey,
    };
  });
}
