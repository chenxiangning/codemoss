/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DECLARED_PLUGIN_RACK_SNAPSHOT } from "@/services/tauri/pluginRack";
import { PluginRackSection } from "./PluginRackSection";

const translations: Record<string, string> = {
  "extensions.rack.title": "Plugin rack",
  "extensions.rack.subtitle": "Visual Host strip. Three plugs can be installed or uninstalled.",
  "extensions.rack.loading": "Reading Host snapshot…",
  "extensions.rack.hostUnavailable": "Host snapshot unavailable.",
  "extensions.rack.hostDisabled": "Host is default-off.",
  "extensions.rack.hostSupervisorLive": "Supervisor is live. Host activation stays off.",
  "extensions.rack.hostEnabled": "Host is enabled.",
  "extensions.rack.supervisor": "Supervisor",
  "extensions.rack.supervisorLive": "Separate process, rejecting activation",
  "extensions.rack.supervisorPid": "PID",
  "extensions.rack.supervisorPath": "Socket",
  "extensions.rack.liveBank": "Live sockets",
  "extensions.rack.laterBank": "Sealed sockets",
  "extensions.rack.sealed": "Sealed",
  "extensions.rack.plugged": "Plugged",
  "extensions.rack.unplugged": "Unplugged",
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
  "extensions.rack.install": "Install",
  "extensions.rack.uninstall": "Uninstall",
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
  it("renders a visual strip with three live sockets and nine sealed sockets", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      hostAvailable: true,
      supervisorLive: true,
      supervisorPid: 4242,
      supervisorPath: "/tmp/host.s",
    });

    render(<PluginRackSection />);

    expect(await screen.findByRole("heading", { name: "Plugin rack" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Live sockets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sealed sockets" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Engines" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Features" })).toBeNull();
    expect(screen.getByText("Supervisor is live. Host activation stays off.")).toBeTruthy();
    expect(screen.getByText("4242")).toBeTruthy();
    expect(screen.getByText("/tmp/host.s")).toBeTruthy();

    const liveBank = screen.getByRole("region", { name: "Live sockets" });
    const laterBank = screen.getByRole("region", { name: "Sealed sockets" });
    expect(liveBank.textContent).toContain("com.mossx.engine.claude");
    expect(liveBank.textContent).toContain("com.mossx.notes");
    expect(liveBank.textContent).toContain("com.mossx.project-map");
    expect(liveBank.textContent).toContain("Process Entry");
    expect(liveBank.textContent).toContain("Isolated sqlite");
    expect(liveBank.textContent).toContain("Product path live");
    expect(liveBank.textContent).toContain("Plugged");
    expect(laterBank.textContent).toContain("com.mossx.browser");
    expect(laterBank.textContent).toContain("com.mossx.intent-canvas");
    expect(laterBank.textContent).toContain("com.mossx.kanban");
    expect(laterBank.textContent).toContain("com.mossx.engine.codex");
    expect(laterBank.textContent).toContain("Sealed");
    expect(screen.getByText("Marketplace stays closed.")).toBeTruthy();

    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(3);
    expect(actions.map((button) => button.textContent)).toEqual(["Uninstall", "Uninstall", "Uninstall"]);
    expect(liveBank.contains(actions[0])).toBe(true);
    expect(liveBank.contains(actions[1])).toBe(true);
    expect(liveBank.contains(actions[2])).toBe(true);
    expect(laterBank.querySelectorAll("button")).toHaveLength(0);
    expect(within(laterBank).queryByRole("button")).toBeNull();
  });

  it("shows Install on an empty live socket", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.notes" ? { ...plug, desiredState: "uninstalled" } : plug,
      ),
    });

    render(<PluginRackSection />);

    const liveBank = await screen.findByRole("region", { name: "Live sockets" });
    expect(within(liveBank).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Uninstall",
      "Install",
      "Uninstall",
    ]);
    expect(liveBank.textContent).toContain("Unplugged");
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("shows an error when the snapshot command fails", async () => {
    getPluginRackSnapshot.mockRejectedValue(new Error("plugin-rack-lock"));

    render(<PluginRackSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("plugin-rack-lock");
    });
  });
});
