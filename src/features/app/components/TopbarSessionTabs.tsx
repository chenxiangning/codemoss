import type { TopbarSessionTabItem } from "../../layout/hooks/topbarSessionTabs";
import { EngineIcon } from "../../engine/components/EngineIcon";

type TopbarSessionTabsProps = {
  tabs: TopbarSessionTabItem[];
  ariaLabel: string;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onCloseThread: (workspaceId: string, threadId: string) => void;
};

function isActivationKey(key: string) {
  return key === "Enter" || key === " " || key === "Space" || key === "Spacebar";
}

export function TopbarSessionTabs({
  tabs,
  ariaLabel,
  onSelectThread,
  onCloseThread,
}: TopbarSessionTabsProps) {
  if (tabs.length === 0) {
    return null;
  }
  return (
    <div
      className="topbar-session-tabs"
      role="tablist"
      aria-label={ariaLabel}
      data-tauri-drag-region="false"
    >
      {tabs.map((tab) => (
        <div
          key={`${tab.workspaceId}:${tab.threadId}`}
          role="tab"
          tabIndex={0}
          className={`topbar-session-tab${tab.isActive ? " is-active" : ""}`}
          aria-selected={tab.isActive}
          aria-label={`${tab.engineLabel} · ${tab.label}`}
          title={`${tab.engineLabel} · ${tab.label}`}
          data-tauri-drag-region="false"
          onClick={() => {
            if (!tab.isActive) {
              onSelectThread(tab.workspaceId, tab.threadId);
            }
          }}
          onKeyDown={(event) => {
            if (isActivationKey(event.key) && !tab.isActive) {
              event.preventDefault();
              onSelectThread(tab.workspaceId, tab.threadId);
            }
          }}
        >
          <span className="topbar-session-tab-engine" aria-hidden="true">
            <EngineIcon engine={tab.engineType} size={12} />
          </span>
          <span className="topbar-session-tab-label">{tab.displayLabel}</span>
          <button
            type="button"
            className="topbar-session-tab-close"
            aria-label={`Close ${tab.label}`}
            title={`Close ${tab.label}`}
            data-tauri-drag-region="false"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onCloseThread(tab.workspaceId, tab.threadId);
            }}
            onKeyDown={(event) => {
              if (isActivationKey(event.key)) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
