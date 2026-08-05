import UsersRound from "lucide-react/dist/esm/icons/users-round";
import { useTranslation } from "react-i18next";

import type { EngineType } from "../../../types";

type ComposerToggleProps = {
  engine: EngineType | null | undefined;
  armed: boolean;
  disabled: boolean;
  hasActiveRun: boolean;
  onToggle: () => void;
};

const SUPPORTED: EngineType[] = [
  "codex",
  "claude",
  "kimi",
  "grok",
  "opencode",
];

export function isMultiAgentTargetSupported(
  engine: EngineType | null | undefined,
): boolean {
  return Boolean(engine && SUPPORTED.includes(engine));
}

export function MultiAgentComposerToggle({
  engine,
  armed,
  disabled,
  hasActiveRun,
  onToggle,
}: ComposerToggleProps) {
  const { t } = useTranslation();
  const targetSupported = isMultiAgentTargetSupported(engine);
  const unavailable = !targetSupported;

  return (
    <button
      type="button"
      className={`multi-agent-toggle${armed ? " is-armed" : ""}`}
      aria-pressed={armed}
      aria-label={
        unavailable
          ? t("multiAgent.errors.targetUnavailable")
          : t("multiAgent.entry.aria")
      }
      title={
        hasActiveRun
          ? t("multiAgent.entry.activeRun")
          : unavailable
            ? t("multiAgent.errors.targetUnavailable")
            : armed
              ? t("multiAgent.entry.disarm")
              : t("multiAgent.entry.arm")
      }
      disabled={disabled || hasActiveRun || unavailable}
      onClick={onToggle}
    >
      <UsersRound size={15} aria-hidden="true" />
      <span>{t("multiAgent.entry.label")}</span>
    </button>
  );
}
