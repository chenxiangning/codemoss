import type { CliInstallEngine, EngineStatus, EngineType } from "../../../types";
import type { FirstRunEngineCardState } from "../components/FirstRunCliStep";
import type { FirstRunSetupProfile } from "../types";

export function isFirstRunEngineInstalled(
  engine: EngineType | CliInstallEngine | null | undefined,
  engineStatuses: EngineStatus[],
  cardStateByEngine: Partial<Record<CliInstallEngine, FirstRunEngineCardState>>,
): engine is CliInstallEngine {
  if (!engine || engine === "gemini" || engine === "omp") {
    return false;
  }
  return (
    cardStateByEngine[engine]?.installed === true ||
    engineStatuses.some(
      (status) => status.engineType === engine && status.installed,
    )
  );
}

export function resolveFirstRunSelectedEngineAfterDetect(options: {
  selectedEngine: CliInstallEngine | null;
  primaryEngine: EngineType | null;
  installedEngines: Array<EngineType | CliInstallEngine>;
}): CliInstallEngine | null {
  const { selectedEngine, primaryEngine, installedEngines } = options;
  if (selectedEngine) {
    return selectedEngine;
  }
  if (
    primaryEngine &&
    primaryEngine !== "gemini" &&
    primaryEngine !== "omp" &&
    installedEngines.some((engine) => engine === primaryEngine)
  ) {
    return primaryEngine;
  }
  const firstInstalled = installedEngines.find(
    (engine) => engine !== "gemini" && engine !== "omp",
  );
  return (firstInstalled as CliInstallEngine | undefined) ?? selectedEngine;
}

export function resolveFirstRunPrimaryEngine(options: {
  selectedEngine: CliInstallEngine | null;
  profile: Pick<FirstRunSetupProfile, "primaryEngine" | "validatedEngines">;
  engineStatuses: EngineStatus[];
  cardStateByEngine: Partial<Record<CliInstallEngine, FirstRunEngineCardState>>;
}): CliInstallEngine | null {
  const { selectedEngine, profile, engineStatuses, cardStateByEngine } = options;
  if (
    isFirstRunEngineInstalled(selectedEngine, engineStatuses, cardStateByEngine)
  ) {
    return selectedEngine;
  }
  if (
    isFirstRunEngineInstalled(
      profile.primaryEngine,
      engineStatuses,
      cardStateByEngine,
    )
  ) {
    return profile.primaryEngine;
  }
  const fromValidated = profile.validatedEngines.find((engine) =>
    isFirstRunEngineInstalled(engine, engineStatuses, cardStateByEngine),
  );
  if (fromValidated) {
    return fromValidated;
  }
  const fromStatus = engineStatuses.find(
    (status) =>
      status.installed &&
      status.engineType !== "gemini" &&
      status.engineType !== "omp",
  );
  if (
    fromStatus &&
    fromStatus.engineType !== "gemini" &&
    fromStatus.engineType !== "omp"
  ) {
    return fromStatus.engineType;
  }
  const fromCard = Object.entries(cardStateByEngine).find(
    ([, card]) => card?.installed,
  )?.[0];
  return (fromCard as CliInstallEngine | undefined) ?? null;
}
