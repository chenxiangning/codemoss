import { lazy } from "react";

export const SettingsView = lazy(() =>
  import("../../features/settings/components/SettingsView").then((module) => ({
    default: module.SettingsView,
  })),
);

export const GitHubPanelData = lazy(() =>
  import("../../features/git/components/GitHubPanelData").then((module) => ({
    default: module.GitHubPanelData,
  })),
);

export const KanbanView = lazy(() =>
  import("@mossx/plugin-kanban").then((module) => ({
    default: module.KanbanView,
  })),
);

export const GitHistoryPanel = lazy(() =>
  import("@mossx/plugin-git-history/ui").then((module) => ({
    default: module.GitHistoryPanel,
  })),
);

export const ExtensionsView = lazy(() =>
  import("../../features/extensions/components/ExtensionsView").then((module) => ({
    default: module.ExtensionsView,
  })),
);

export const PluginRackSection = lazy(() =>
  import("../../features/extensions/components/PluginRackSection").then((module) => ({
    default: module.PluginRackSection,
  })),
);

export const WorkspaceHome = lazy(() =>
  import("../../features/workspaces/components/WorkspaceHome").then((module) => ({
    default: module.WorkspaceHome,
  })),
);

export const SpecHub = lazy(() =>
  import("@mossx/plugin-spec/ui").then((module) => ({
    default: module.SpecHub,
  })),
);

export const SearchPalette = lazy(() =>
  import("../../features/search/components/SearchPalette").then((module) => ({
    default: module.SearchPalette,
  })),
);

export const QuickSwitcher = lazy(() =>
  import("../../features/quick-switcher/components/QuickSwitcher").then((module) => ({
    default: module.QuickSwitcher,
  })),
);

export const ReleaseNotesModal = lazy(() =>
  import("../../features/update/components/ReleaseNotesModal").then((module) => ({
    default: module.ReleaseNotesModal,
  })),
);
