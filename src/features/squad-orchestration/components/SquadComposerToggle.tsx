import UsersRound from "lucide-react/dist/esm/icons/users-round";
import { useTranslation } from "react-i18next";

import type { EngineType } from "../../../types";

type SquadComposerToggleProps = {
  engine: EngineType | null | undefined;
  armed: boolean;
  disabled: boolean;
  hasActiveSquad: boolean;
  onToggle: () => void;
};

export function isSquadTargetEngineSupported(
  engine: EngineType | null | undefined,
): boolean {
  // Backend `validate_squad_lead_target` remains authoritative; this mirror
  // prevents unsupported targets from entering a guaranteed-failure UI flow.
  return engine === "codex" || engine === "claude";
}

export function SquadComposerToggle({
  engine,
  armed,
  disabled,
  hasActiveSquad,
  onToggle,
}: SquadComposerToggleProps) {
  const { t } = useTranslation();
  const targetSupported = isSquadTargetEngineSupported(engine);
  const unavailable = !targetSupported;

  return (
    <button
      type="button"
      className={`squad-composer-toggle${armed ? " is-armed" : ""}`}
      aria-pressed={armed}
      aria-label={
        unavailable
          ? t("squadOrchestration.errors.targetUnavailable")
          : t("squadOrchestration.entry.aria")
      }
      title={
        hasActiveSquad
          ? t("squadOrchestration.entry.activeRun")
          : unavailable
            ? t("squadOrchestration.errors.targetUnavailable")
            : armed
              ? t("squadOrchestration.entry.disarm")
              : t("squadOrchestration.entry.arm")
      }
      disabled={disabled || hasActiveSquad || unavailable}
      onClick={onToggle}
    >
      <UsersRound size={15} aria-hidden="true" />
      <span>{t("squadOrchestration.entry.label")}</span>
    </button>
  );
}
