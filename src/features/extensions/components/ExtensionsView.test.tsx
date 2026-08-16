/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import enSidebar from "@/i18n/locales/en/sidebar";
import zhSidebar from "@/i18n/locales/zh/sidebar";
import { ExtensionsView } from "./ExtensionsView";

const translations = vi.hoisted(
  (): Record<string, string> => ({
  "extensions.title": "Extensions",
  "extensions.sectionsLabel": "Usage and framework",
  "extensions.tabs.usage": "Usage",
  "extensions.tabs.framework": "AI Framework",
  "extensions.tabs.skills": "Skills",
  "extensions.tabs.mcps": "Mcps",
  "extensions.tabs.plugins": "Plugins",
  "extensions.tabs.hooks": "Hooks",
  "extensions.tabs.rules": "Rules",
  "extensions.tabs.commands": "Commands",
  "extensions.tabs.subagents": "Subagents",
  "extensions.panelTitles.usage": "Usage",
  "extensions.panelTitles.framework": "AI Framework",
  "extensions.panelTitles.skills": "Extend your CLI with Skills",
  "extensions.panelTitles.mcps": "Extend your CLI with MCP servers",
  "extensions.panelTitles.hooks": "Extend your CLI with Hooks",
  "extensions.descriptions.usage": "Coming soon",
  "extensions.descriptions.skills": "Coming soon",
  "extensions.descriptions.mcps": "Coming soon",
  "extensions.descriptions.hooks": "Coming soon",
  }),
);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

vi.mock("./UsageDashboardSection", () => ({
  UsageDashboardSection: () => <div data-testid="usage-dashboard-section" />,
}));

vi.mock("./SkillsDashboardSection", () => ({
  SkillsDashboardSection: () => <div data-testid="skills-dashboard-section" />,
}));

vi.mock("./McpsDashboardSection", () => ({
  McpsDashboardSection: () => <div data-testid="mcps-dashboard-section" />,
}));

function renderExtensionsView() {
  return render(<ExtensionsView activeWorkspace={null} />);
}

describe("ExtensionsView", () => {
  it("renders the section pills and extension tabs in the requested order", () => {
    renderExtensionsView();

    const sectionGroup = screen.getByRole("group", { name: "Usage and framework" });
    expect(
      within(sectionGroup).getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Usage", "AI Framework"]);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByText("Browse Marketplace")).toBeNull();

    const filterRow = sectionGroup.parentElement;
    expect(filterRow).toBeTruthy();
    const tabButtons = within(filterRow as HTMLElement)
      .getAllByRole("button")
      .filter((button) => !sectionGroup.contains(button));
    expect(
      tabButtons.map((button) => button.textContent),
    ).toEqual(["Skills", "Mcps", "Plugins", "Hooks", "Rules", "Commands", "Subagents"]);
  });

  it("gives section pills an icon but keeps extension tabs icon-less", () => {
    renderExtensionsView();

    const sectionGroup = screen.getByRole("group", { name: "Usage and framework" });
    for (const button of within(sectionGroup).getAllByRole("button")) {
      expect(button.querySelector("svg")).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: "Skills" }).querySelector("svg")).toBeNull();
    expect(screen.getByRole("button", { name: "Subagents" }).querySelector("svg")).toBeNull();
  });

  it("defaults to the usage section when the page opens", () => {
    renderExtensionsView();

    expect(screen.getByRole("button", { name: "Usage" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Skills" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByTestId("usage-dashboard-section")).toBeTruthy();
    expect(screen.getByLabelText("Extensions").classList.contains("extensions-view-usage")).toBe(true);
    expect(document.querySelector(".extensions-empty-panel")).toBeNull();
  });

  it("renders the skills dashboard section when the Skills tab is selected", () => {
    renderExtensionsView();

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));

    expect(screen.queryByTestId("usage-dashboard-section")).toBeNull();
    expect(screen.getByTestId("skills-dashboard-section")).toBeTruthy();
    expect(document.querySelector(".extensions-empty-panel")).toBeNull();
  });

  it("updates the introduction panel when a tab is selected", () => {
    renderExtensionsView();

    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));

    expect(screen.queryByTestId("usage-dashboard-section")).toBeNull();
    expect(screen.getByLabelText("Extensions").classList.contains("extensions-view-usage")).toBe(false);
    expect(screen.getByRole("heading", { name: "Extend your CLI with Hooks" })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
  });

  it("renders the mcps dashboard section when the Mcps tab is selected", () => {
    renderExtensionsView();

    fireEvent.click(screen.getByRole("button", { name: "Mcps" }));

    expect(screen.queryByTestId("usage-dashboard-section")).toBeNull();
    expect(screen.getByTestId("mcps-dashboard-section")).toBeTruthy();
    expect(document.querySelector(".extensions-empty-panel")).toBeNull();
  });

  it("keeps the Plugins tab as an empty shell after the rack moved to Market", () => {
    renderExtensionsView();

    fireEvent.click(screen.getByRole("button", { name: "Plugins" }));

    expect(screen.queryByTestId("plugin-rack-section")).toBeNull();
    expect(document.querySelector(".extensions-empty-panel")).toBeTruthy();
    expect(screen.queryByText("Browse Marketplace")).toBeNull();
  });

  it("renders a structured shadcn-style empty state", () => {
    renderExtensionsView();

    fireEvent.click(screen.getByRole("button", { name: "Hooks" }));

    const panel = screen.getByRole("heading", { name: "Extend your CLI with Hooks" }).closest(".extensions-empty-panel");
    expect(panel).toBeTruthy();
    expect(panel?.querySelector(".extensions-empty-panel-icon svg")).toBeTruthy();
    expect(panel?.querySelectorAll(".extensions-empty-panel-preview span")).toHaveLength(4);
  });

  it("keeps zh and en locale keys aligned for every tab", () => {
    for (const locale of [enSidebar, zhSidebar]) {
      expect(Object.keys(locale.extensions.tabs).sort()).toEqual(
        ["commands", "framework", "hooks", "mcps", "plugins", "rules", "skills", "subagents", "usage"],
      );
      expect(Object.keys(locale.extensions.panelTitles).sort()).toEqual(
        Object.keys(locale.extensions.tabs).sort(),
      );
      expect(Object.keys(locale.extensions.descriptions).sort()).toEqual(
        Object.keys(locale.extensions.tabs).sort(),
      );
      expect(Object.keys(locale.extensions.rack).sort()).toEqual(
        Object.keys(enSidebar.extensions.rack).sort(),
      );
    }
  });

  it("keeps zh and en usage dashboard copy keys aligned", () => {
    const expectedUsageKeys = [
      "checkingLabel",
      "errorRetry",
      "errorTitle",
      "guideCopied",
      "guideCopy",
      "guideDesc",
      "guideInstallLabel",
      "guideInstallNow",
      "guideNoteHooks",
      "guideNoteTelemetry",
      "guideOpenNpm",
      "guideRecheck",
      "guideTitle",
      "installingDesc",
      "installingLabel",
      "startingLabel",
    ];
    for (const locale of [enSidebar, zhSidebar]) {
      expect(Object.keys(locale.extensions.usage).sort()).toEqual(expectedUsageKeys);
    }
    expect(zhSidebar.extensions.usage.guideTitle).not.toBe(
      enSidebar.extensions.usage.guideTitle,
    );
  });

  it("does not render empty state action buttons", () => {
    renderExtensionsView();

    expect(screen.getByRole("button", { name: "Skills" }).dataset.size).toBe("sm");
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Documentation" })).toBeNull();
  });

  it("keeps tab button dimensions stable across active state changes", () => {
    renderExtensionsView();

    for (const name of ["Usage", "AI Framework", "Skills", "Subagents"]) {
      expect(screen.getByRole("button", { name }).classList.contains("extensions-filter-tab")).toBe(true);
    }
  });

  it("keeps the top search surface hidden", () => {
    renderExtensionsView();

    expect(screen.queryByLabelText("Search extensions")).toBeNull();
    expect(screen.queryByPlaceholderText(/Search/)).toBeNull();
  });
});
