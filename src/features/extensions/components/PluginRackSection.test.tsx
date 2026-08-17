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
  "extensions.rack.hostSupervisorLive": "Supervisor is live. Host activation stays off.",
  "extensions.rack.hostEnabled": "Host is enabled.",
  "extensions.rack.supervisor": "Supervisor",
  "extensions.rack.supervisorLive": "Separate process, rejecting activation",
  "extensions.rack.supervisorPid": "PID",
  "extensions.rack.supervisorPath": "Socket",
  "extensions.rack.ownerClass": "Class",
  "extensions.rack.ownerClasses.pilot": "Pilot",
  "extensions.rack.ownerClasses.later-plugin": "Later plugin",
  "extensions.rack.circuit": "Circuit",
  "extensions.rack.circuits.live": "Product path live",
  "extensions.rack.circuits.fallback": "Explicit Core fallback",
  "extensions.rack.circuits.idle": "Not wired",
  "extensions.rack.productPath": "Product path",
  "extensions.rack.productPaths.process-entry": "Process Entry",
  "extensions.rack.productPaths.isolated-sqlite": "Isolated sqlite",
  "extensions.rack.productPaths.undeclared": "Undeclared",
  "extensions.rack.coreOwner": "Core owner",
  "extensions.rack.coreOwners.disabled": "Disabled, source kept",
  "extensions.rack.coreOwners.fallback": "Explicit fallback",
  "extensions.rack.coreOwners.active": "Still Core",
  "extensions.rack.state": "Host slot",
  "extensions.rack.generation": "Generation",
  "extensions.rack.marketplaceLater": "Marketplace stays closed.",
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
  it("renders declared idle plugs read-only, without any install/uninstall action", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      hostAvailable: true,
      supervisorLive: true,
      supervisorPid: 4242,
      supervisorPath: "/tmp/host.s",
    });

    render(<PluginRackSection />);

    expect(await screen.findByRole("heading", { name: "Plugin rack" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Engines" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Features" })).toBeTruthy();
    expect(screen.getByText("Supervisor is live. Host activation stays off.")).toBeTruthy();
    expect(screen.getByText("4242")).toBeTruthy();
    expect(screen.getByText("/tmp/host.s")).toBeTruthy();

    const engineGroup = screen.getByRole("region", { name: "Engines" });
    const featureGroup = screen.getByRole("region", { name: "Features" });
    expect(engineGroup.textContent).toContain("com.mossx.engine.claude");
    expect(engineGroup.textContent).toContain("com.mossx.engine.codex");
    expect(engineGroup.textContent).toContain("Pilot");
    expect(engineGroup.textContent).toContain("Later plugin");
    expect(featureGroup.textContent).toContain("com.mossx.notes");
    expect(featureGroup.textContent).toContain("com.mossx.project-map");
    expect(featureGroup.textContent).toContain("com.mossx.kanban");
    expect(screen.getByText("Marketplace stays closed.")).toBeTruthy();
    // 只读市场：不得出现任何安装/卸载/标记按钮
    expect(screen.queryByRole("button")).toBeNull();
    const notesPlug = featureGroup.textContent ?? "";
    expect(notesPlug).toContain("Idle");
    expect(engineGroup.textContent).toContain("Process Entry");
    expect(engineGroup.textContent).toContain("Product path live");
    expect(engineGroup.textContent).toContain("Disabled, source kept");
    expect(featureGroup.textContent).toContain("Isolated sqlite");
    expect(featureGroup.textContent).toContain("Not wired");
    expect(featureGroup.textContent).toContain("Still Core");
  });

  it("shows an error when the snapshot command fails", async () => {
    getPluginRackSnapshot.mockRejectedValue(new Error("plugin-rack-lock"));

    render(<PluginRackSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("plugin-rack-lock");
    });
  });
});
