/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DECLARED_PLUGIN_RACK_SNAPSHOT } from "@/services/tauri/pluginRack";
import { PluginRackSection } from "./PluginRackSection";

const translations: Record<string, string> = {
  "extensions.rack.title": "Plugin rack",
  "extensions.rack.subtitle": "Declared Host plugs. Read-only.",
  "extensions.rack.loading": "Reading Host snapshot…",
  "extensions.rack.hostUnavailable": "Host snapshot unavailable.",
  "extensions.rack.hostDisabled": "Host is default-off.",
  "extensions.rack.hostEnabled": "Host is enabled.",
  "extensions.rack.kind": "Kind",
  "extensions.rack.ownerClass": "Class",
  "extensions.rack.ownerClasses.pilot": "Pilot",
  "extensions.rack.ownerClasses.later-plugin": "Later plugin",
  "extensions.rack.state": "State",
  "extensions.rack.generation": "Generation",
  "extensions.rack.marketplaceLater": "Marketplace stays closed.",
  "extensions.rack.catalogTitle": "Local packages",
  "extensions.rack.catalogSubtitle": "In-repo plugin packages. Read-only. Not installed.",
  "extensions.rack.catalogPath": "Path",
  "extensions.rack.catalogStatus": "Status",
  "extensions.rack.catalogNotInstalled": "Not installed",
  "extensions.rack.catalogInstalled": "Installed (local mark)",
  "extensions.rack.catalogStage": "Install",
  "extensions.rack.catalogUnstage": "Uninstall",
  "extensions.rack.catalogPermissions": "Permission preview",
  "extensions.rack.catalogVersion": "Version",
  "extensions.rack.rackInstall": "Rack install",
  "extensions.rack.rackVersion": "Rack version",
  "extensions.rack.error": "Could not read the Host rack: {{message}}",
  "extensions.rack.kinds.engine": "Engines",
  "extensions.rack.kinds.feature": "Features",
  "extensions.rack.states.idle": "Idle",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; message?: string }) => {
      if (key === "extensions.rack.error" && options?.message) {
        return `Could not read the Host rack: ${options.message}`;
      }
      return translations[key] ?? options?.defaultValue ?? key;
    },
  }),
}));

const getPluginRackSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/services/tauri/pluginRack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/tauri/pluginRack")>();
  return {
    ...actual,
    getPluginRackSnapshot,
  };
});

describe("PluginRackSection", () => {
  it("renders declared idle plugs without a marketplace action", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      hostAvailable: true,
    });

    render(<PluginRackSection />);

    expect(await screen.findByRole("heading", { name: "Plugin rack" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Engines" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Features" })).toBeTruthy();
    expect(screen.getByText("Host is default-off.")).toBeTruthy();
    const engineGroup = screen.getByRole("region", { name: "Engines" });
    const featureGroup = screen.getByRole("region", { name: "Features" });
    expect(engineGroup.textContent).toContain("com.mossx.engine.claude");
    expect(engineGroup.textContent).toContain("com.mossx.engine.codex");
    expect(engineGroup.textContent).toContain("Pilot");
    expect(engineGroup.textContent).toContain("Later plugin");
    expect(featureGroup.textContent).toContain("com.mossx.notes");
    expect(featureGroup.textContent).toContain("com.mossx.project-map");
    expect(featureGroup.textContent).toContain("Pilot");
    expect(featureGroup.textContent).toContain("Later plugin");
    expect(featureGroup.textContent).toContain("com.mossx.kanban");
    const catalog = screen.getByRole("region", { name: "Local packages" });
    const catalogPilot = catalog.querySelectorAll('[aria-label="Pilot"]');
    const catalogLater = catalog.querySelectorAll('[aria-label="Later plugin"]');
    expect(catalogPilot.length).toBeGreaterThan(0);
    expect(catalogLater.length).toBeGreaterThan(0);
    expect(catalogPilot[0]?.textContent).toContain("com.mossx.engine.claude");
    expect(catalogPilot[0]?.textContent).toContain("com.mossx.notes");
    expect(catalogPilot[0]?.textContent).toContain("mossx.storage.readwrite");
    expect(catalogPilot[0]?.textContent).toContain("mossx.ui.slot.workspace.main");
    expect(catalogLater[0]?.textContent).toContain("com.mossx.kanban");
    expect(catalog.textContent).toContain("packages/plugin-engine-claude");
    expect(catalog.textContent).toContain("packages/plugin-notes");
    expect(catalog.textContent).toContain("packages/plugin-kanban");
    expect(catalog.textContent).toContain("packages/plugin-project-map");
    expect(catalog.textContent).toContain("packages/plugin-browser");
    expect(catalog.textContent).toContain("packages/plugin-intent-canvas");
    expect(catalog.textContent).toContain("packages/plugin-engine-codex");
    expect(catalog.textContent).toContain("packages/plugin-engine-pi");
    expect(catalog.textContent).toContain("packages/plugin-git-history");
    expect(catalog.textContent).toContain("packages/plugin-spec");
    expect(screen.getAllByText("Not installed").length).toBeGreaterThanOrEqual(45);
    expect(engineGroup.textContent).toContain("com.mossx.engine.codex");
    expect(engineGroup.textContent).toContain("com.mossx.engine.gemini");
    expect(engineGroup.textContent).toContain("com.mossx.engine.grok");
    expect(engineGroup.textContent).toContain("com.mossx.engine.kimi");
    expect(engineGroup.textContent).toContain("com.mossx.engine.opencode");
    expect(engineGroup.textContent).toContain("com.mossx.engine.pi");
    expect(catalog.textContent).toContain("com.mossx.engine.codex");
    expect(catalog.textContent).toContain("com.mossx.engine.pi");
    expect(screen.getByText("Marketplace stays closed.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Install" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /enable|marketplace/i })).toBeNull();
    const notesPlug = featureGroup.textContent ?? "";
    expect(notesPlug).toContain("Idle");
  });

  it("marks a local package installed without changing the Host idle state", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      hostAvailable: true,
    });
    localStorage.clear();
    const user = userEvent.setup();
    render(<PluginRackSection />);
    const catalog = await screen.findByRole("region", { name: "Local packages" });
    const notesCard = Array.from(catalog.querySelectorAll(".extensions-plugin-rack-card")).find((card) =>
      card.textContent?.includes("com.mossx.notes"),
    );
    expect(notesCard).toBeTruthy();
    await user.click(notesCard!.querySelector("button") as HTMLButtonElement);
    const featureGroup = screen.getByRole("region", { name: "Features" });
    expect(featureGroup.textContent).toContain("Installed (local mark)");
    expect(featureGroup.textContent).toContain("Idle");
    expect(featureGroup.textContent).toContain("1.0.0");
    expect(notesCard!.textContent).toContain("Installed (local mark)");
    expect(notesCard!.textContent).toContain("1.0.0");
    expect(notesCard!.querySelector("button")?.textContent).toBe("Uninstall");
  });

  it("shows an error when the snapshot command fails", async () => {
    getPluginRackSnapshot.mockRejectedValue(new Error("plugin-rack-lock"));

    render(<PluginRackSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("plugin-rack-lock");
    });
  });
});
