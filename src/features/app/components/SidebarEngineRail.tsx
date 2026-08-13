import { EngineIcon } from "../../engine/components/EngineIcon";
import { SharedSessionIcon } from "../../shared-session/components/SharedSessionIcon";
import type { EngineType } from "../../../types";
import type { SidebarEngineRailId } from "../utils/sidebarEngineRail";

const RAIL_LABEL: Record<SidebarEngineRailId, string> = {
  shared: "Shared",
  claude: "Claude",
  codex: "Codex",
  gemini: "Gemini",
  grok: "Grok",
  kimi: "Kimi",
  opencode: "OpenCode",
  pi: "PI",
};

type SidebarEngineRailProps = {
  rails: SidebarEngineRailId[];
  selectedRail: SidebarEngineRailId | null;
  onSelectRail: (railId: SidebarEngineRailId) => void;
};

export function SidebarEngineRail({
  rails,
  selectedRail,
  onSelectRail,
}: SidebarEngineRailProps) {
  if (rails.length === 0) {
    return null;
  }
  return (
    <div className="sidebar-engine-rail" role="tablist" aria-label="Session engines">
      {rails.map((railId) => {
        const selected = railId === selectedRail;
        return (
          <button
            key={railId}
            type="button"
            role="tab"
            aria-selected={selected}
            title={RAIL_LABEL[railId]}
            className={
              selected
                ? "sidebar-engine-rail__btn is-selected"
                : "sidebar-engine-rail__btn"
            }
            onClick={() => onSelectRail(railId)}
          >
            {railId === "shared" ? (
              <SharedSessionIcon size={14} />
            ) : (
              <EngineIcon
                engine={railId as EngineType}
                size={railId === "pi" ? 11 : 14}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
