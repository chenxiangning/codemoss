/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
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
    expect(catalog.textContent).toContain("com.mossx.engine.claude");
    expect(catalog.textContent).toContain("com.mossx.notes");
    expect(catalog.textContent).toContain("com.mossx.kanban");
    expect(catalog.textContent).toContain("packages/plugin-engine-claude");
    expect(catalog.textContent).toContain("packages/plugin-notes");
    expect(catalog.textContent).toContain("packages/plugin-kanban");
    expect(catalog.textContent).toContain("packages/plugin-project-map");
    expect(catalog.textContent).toContain("packages/plugin-browser");
    expect(catalog.textContent).toContain("packages/plugin-intent-canvas");
    expect(screen.getAllByText("Not installed").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText("com.mossx.engine.codex")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.gemini")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.grok")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.kimi")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.opencode")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.pi")).toBeTruthy();
    expect(screen.getByText("Marketplace stays closed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /install|enable|marketplace/i })).toBeNull();
  });

  it("shows an error when the snapshot command fails", async () => {
    getPluginRackSnapshot.mockRejectedValue(new Error("plugin-rack-lock"));

    render(<PluginRackSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("plugin-rack-lock");
    });
  });
});
