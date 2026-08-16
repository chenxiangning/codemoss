import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import Blocks from "lucide-react/dist/esm/icons/blocks";
import Bot from "lucide-react/dist/esm/icons/bot";
import Frame from "lucide-react/dist/esm/icons/frame";
import Package from "lucide-react/dist/esm/icons/package";
import Puzzle from "lucide-react/dist/esm/icons/puzzle";
import ScrollText from "lucide-react/dist/esm/icons/scroll-text";
import Server from "lucide-react/dist/esm/icons/server";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square";
import Webhook from "lucide-react/dist/esm/icons/webhook";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { WorkspaceInfo } from "../../../types";
import { Button } from "@/components/ui/button";
import { loadExtensionsStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";

import { McpsDashboardSection } from "./McpsDashboardSection";
import { PluginRackSection } from "./PluginRackSection";
import { SkillsDashboardSection } from "./SkillsDashboardSection";
import { UsageDashboardSection } from "./UsageDashboardSection";

const SECTION_TABS = ["usage", "framework"] as const;

const SECTION_TAB_ICONS = {
  usage: BarChart3,
  framework: Frame,
} as const;

const EXTENSION_TABS = [
  "skills",
  "mcps",
  "plugins",
  "hooks",
  "rules",
  "commands",
  "subagents",
] as const;

type SectionTab = (typeof SECTION_TABS)[number];
type ExtensionTab = (typeof EXTENSION_TABS)[number];
type ActiveTab = SectionTab | ExtensionTab;

const PANEL_ICONS = {
  usage: BarChart3,
  framework: Blocks,
  skills: Package,
  mcps: Server,
  plugins: Puzzle,
  hooks: Webhook,
  rules: ScrollText,
  commands: TerminalSquare,
  subagents: Bot,
} as const satisfies Record<ActiveTab, typeof BarChart3>;

type ExtensionsViewProps = {
  activeWorkspace: WorkspaceInfo | null;
};

export function ExtensionsView({ activeWorkspace }: ExtensionsViewProps) {
  const { t } = useTranslation();
  const stylesReady = useFeatureStylesReady(loadExtensionsStyles);
  const [activeTab, setActiveTab] = useState<ActiveTab>("usage");
  const PanelIcon = PANEL_ICONS[activeTab];
  const viewClassName =
    activeTab === "usage" ? "extensions-view extensions-view-usage" : "extensions-view";

  if (!stylesReady) {
    return (
      <section className="extensions-view" aria-label={t("extensions.title")} aria-busy="true" />
    );
  }

  return (
    <section className={viewClassName} aria-label={t("extensions.title")}>
      <div className="extensions-filter-row">
        <div className="extensions-section-group" role="group" aria-label={t("extensions.sectionsLabel")}>
          {SECTION_TABS.map((tab) => {
            const Icon = SECTION_TAB_ICONS[tab];
            return (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={activeTab === tab ? "default" : "outline"}
                className="extensions-filter-tab"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                <Icon size={16} aria-hidden />
                {t(`extensions.tabs.${tab}`)}
              </Button>
            );
          })}
        </div>

        <div className="extensions-filter-divider" aria-hidden />

        {EXTENSION_TABS.map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={activeTab === tab ? "default" : "outline"}
            className="extensions-filter-tab"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {t(`extensions.tabs.${tab}`)}
          </Button>
        ))}
      </div>

      {activeTab === "usage" ? (
        <UsageDashboardSection />
      ) : activeTab === "skills" ? (
        <SkillsDashboardSection />
      ) : activeTab === "mcps" ? (
        <McpsDashboardSection activeWorkspace={activeWorkspace} />
      ) : activeTab === "plugins" ? (
        <PluginRackSection />
      ) : (
        <div className="extensions-empty-panel">
          <div className="extensions-empty-panel-icon" aria-hidden>
            <PanelIcon size={20} />
          </div>
          <div className="extensions-empty-panel-copy">
            <h2>{t(`extensions.panelTitles.${activeTab}`)}</h2>
            <p>{t(`extensions.descriptions.${activeTab}`)}</p>
          </div>
          <div className="extensions-empty-panel-preview" aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </section>
  );
}
