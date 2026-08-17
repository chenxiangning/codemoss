/** @vitest-environment jsdom */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  "extensions.market.title": "Plugin Market",
  "extensions.market.subtitle": "Local curated catalog.",
  "extensions.market.previewBanner": "Browser preview only.",
  "extensions.market.available": "Available plugs",
  "extensions.market.comingSoon": "Coming soon",
  "extensions.market.installed": "Installed",
  "extensions.market.availableBadge": "Not installed",
  "extensions.market.comingSoonBadge": "Sealed",
  "extensions.market.publisher": "mossx",
  "extensions.market.footnote": "Local curated catalog only. Remote Marketplace stays closed.",
  "extensions.market.installFromFolder": "Install from folder",
  "extensions.market.listings.claude": "Claude Engine listing.",
  "extensions.market.listings.notes": "Notes listing.",
  "extensions.market.listings.projectMap": "Project Map listing.",
  "extensions.market.listings.later": "Later plugin listing.",
  "extensions.market.claudeUninstallTitle": "Uninstall Claude Engine",
  "extensions.market.claudeUninstallBody":
    "Uninstalling will interrupt every in-flight Claude turn and hide the Claude entry. Cancel keeps Claude installed.",
  "extensions.market.claudeUninstallConfirm": "Uninstall and interrupt",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
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
const installPlugin = vi.hoisted(() => vi.fn());
const installPluginFromPath = vi.hoisted(() => vi.fn());
const uninstallPlugin = vi.hoisted(() => vi.fn());
const pickWorkspacePath = vi.hoisted(() => vi.fn());
const tauriState = vi.hoisted(() => ({ desktop: false }));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => tauriState.desktop,
  invoke: vi.fn(),
}));

vi.mock("@/services/tauri/filePickers", () => ({
  pickWorkspacePath,
}));

vi.mock("@/services/tauri/pluginRack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/tauri/pluginRack")>();
  return {
    ...actual,
    getPluginRackSnapshot,
    installPlugin,
    installPluginFromPath,
    uninstallPlugin,
  };
});

describe("PluginRackSection", () => {
  beforeEach(() => {
    tauriState.desktop = false;
    getPluginRackSnapshot.mockReset();
    installPlugin.mockReset();
    installPluginFromPath.mockReset();
    uninstallPlugin.mockReset();
    pickWorkspacePath.mockReset();
  });

  it("renders a visual strip with three live sockets and nine sealed sockets", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      hostAvailable: true,
      supervisorLive: true,
      supervisorPid: 4242,
      supervisorPath: "/tmp/host.s",
    });

    render(<PluginRackSection />);

    expect(await screen.findByRole("heading", { name: "Plugin Market" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Live sockets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sealed sockets" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Available plugs" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Coming soon" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Engines" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Features" })).toBeNull();
    expect(screen.getByText("Supervisor is live. Host activation stays off.")).toBeTruthy();
    expect(screen.getByText("4242")).toBeTruthy();
    expect(screen.getByText("/tmp/host.s")).toBeTruthy();

    const liveBank = screen.getByRole("region", { name: "Live sockets" });
    const laterBank = screen.getByRole("region", { name: "Sealed sockets" });
    const availableShelf = screen.getByRole("region", { name: "Available plugs" });
    const comingSoonShelf = screen.getByRole("region", { name: "Coming soon" });
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
    expect(availableShelf.textContent).toContain("Claude Engine listing.");
    expect(availableShelf.textContent).toContain("Notes listing.");
    expect(availableShelf.textContent).toContain("Project Map listing.");
    expect(comingSoonShelf.textContent).toContain("Later plugin listing.");
    expect(screen.getByText("Local curated catalog only. Remote Marketplace stays closed.")).toBeTruthy();
    expect(screen.queryByText("Browse Marketplace")).toBeNull();

    const actions = screen.getAllByRole("button");
    expect(actions).toHaveLength(3);
    expect(actions.map((button) => button.textContent)).toEqual(["Uninstall", "Uninstall", "Uninstall"]);
    expect(availableShelf.contains(actions[0])).toBe(true);
    expect(availableShelf.contains(actions[1])).toBe(true);
    expect(availableShelf.contains(actions[2])).toBe(true);
    expect(liveBank.querySelectorAll("button")).toHaveLength(0);
    expect(laterBank.querySelectorAll("button")).toHaveLength(0);
    expect(comingSoonShelf.querySelectorAll("button")).toHaveLength(0);
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
    const availableShelf = screen.getByRole("region", { name: "Available plugs" });
    expect(within(availableShelf).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Uninstall",
      "Install",
      "Uninstall",
    ]);
    expect(liveBank.textContent).toContain("Unplugged");
    expect(availableShelf.textContent).toContain("Not installed");
    expect(within(liveBank).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("uninstalls from the marketplace listing and leaves sealed cards inert", async () => {
    const nextSnapshot = {
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.notes" ? { ...plug, desiredState: "uninstalled" } : plug,
      ),
    };
    getPluginRackSnapshot.mockResolvedValue(DECLARED_PLUGIN_RACK_SNAPSHOT);
    uninstallPlugin.mockResolvedValue(nextSnapshot);

    render(<PluginRackSection />);

    const availableShelf = await screen.findByRole("region", { name: "Available plugs" });
    const notesCard = (await within(availableShelf).findByText("com.mossx.notes")).closest("li");
    expect(notesCard).toBeTruthy();
    await act(async () => {
      within(notesCard as HTMLElement).getByRole("button", { name: "Uninstall" }).click();
    });

    await waitFor(() => {
      expect(uninstallPlugin).toHaveBeenCalledWith("com.mossx.notes");
    });
    expect(await screen.findByRole("region", { name: "Available plugs" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Available plugs" })).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Uninstall",
      "Install",
      "Uninstall",
    ]);
    expect(installPlugin).not.toHaveBeenCalled();
  });

  it("installs from the marketplace listing and occupies the matching socket", async () => {
    const emptyNotes = {
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.notes" ? { ...plug, desiredState: "uninstalled" } : plug,
      ),
    };
    getPluginRackSnapshot.mockResolvedValue(emptyNotes);
    installPlugin.mockResolvedValue(DECLARED_PLUGIN_RACK_SNAPSHOT);

    render(<PluginRackSection />);

    const availableShelf = await screen.findByRole("region", { name: "Available plugs" });
    const notesCard = (await within(availableShelf).findByText("com.mossx.notes")).closest("li");
    expect(notesCard).toBeTruthy();
    await act(async () => {
      within(notesCard as HTMLElement).getByRole("button", { name: "Install" }).click();
    });

    await waitFor(() => {
      expect(installPlugin).toHaveBeenCalledWith("com.mossx.notes");
    });
    expect(
      within(screen.getByRole("region", { name: "Available plugs" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Uninstall", "Uninstall", "Uninstall"]);
    expect(screen.getByRole("region", { name: "Live sockets" }).textContent).toContain("Plugged");
    expect(uninstallPlugin).not.toHaveBeenCalled();
  });

  it("asks before uninstalling Claude and keeps it installed on cancel", async () => {
    getPluginRackSnapshot.mockResolvedValue(DECLARED_PLUGIN_RACK_SNAPSHOT);

    render(<PluginRackSection />);

    const availableShelf = await screen.findByRole("region", { name: "Available plugs" });
    const claudeCard = (await within(availableShelf).findByText("com.mossx.engine.claude")).closest("li");
    expect(claudeCard).toBeTruthy();
    await act(async () => {
      within(claudeCard as HTMLElement).getByRole("button", { name: "Uninstall" }).click();
    });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Uninstall Claude Engine");
    expect(dialog.textContent).toContain("interrupt every in-flight Claude turn");
    expect(uninstallPlugin).not.toHaveBeenCalled();

    await act(async () => {
      within(dialog).getByRole("button", { name: "Cancel" }).click();
    });

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(uninstallPlugin).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("region", { name: "Available plugs" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Uninstall", "Uninstall", "Uninstall"]);
  });

  it("uninstalls Claude only after the interrupt prompt is confirmed", async () => {
    const nextSnapshot = {
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.engine.claude" ? { ...plug, desiredState: "uninstalled" } : plug,
      ),
    };
    getPluginRackSnapshot.mockResolvedValue(DECLARED_PLUGIN_RACK_SNAPSHOT);
    uninstallPlugin.mockResolvedValue(nextSnapshot);

    render(<PluginRackSection />);

    const availableShelf = await screen.findByRole("region", { name: "Available plugs" });
    const claudeCard = (await within(availableShelf).findByText("com.mossx.engine.claude")).closest("li");
    expect(claudeCard).toBeTruthy();
    await act(async () => {
      within(claudeCard as HTMLElement).getByRole("button", { name: "Uninstall" }).click();
    });

    const dialog = await screen.findByRole("alertdialog");
    await act(async () => {
      within(dialog).getByRole("button", { name: "Uninstall and interrupt" }).click();
    });

    await waitFor(() => {
      expect(uninstallPlugin).toHaveBeenCalledWith("com.mossx.engine.claude");
    });
    expect(
      within(screen.getByRole("region", { name: "Available plugs" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Install", "Uninstall", "Uninstall"]);
  });

  it("lets the desktop Notes card install from a local folder", async () => {
    tauriState.desktop = true;
    const emptyNotes = {
      ...DECLARED_PLUGIN_RACK_SNAPSHOT,
      plugs: DECLARED_PLUGIN_RACK_SNAPSHOT.plugs.map((plug) =>
        plug.pluginId === "com.mossx.notes" ? { ...plug, desiredState: "uninstalled" } : plug,
      ),
    };
    getPluginRackSnapshot.mockResolvedValue(emptyNotes);
    pickWorkspacePath.mockResolvedValue("/tmp/mossx-plugin-notes");
    installPluginFromPath.mockResolvedValue(DECLARED_PLUGIN_RACK_SNAPSHOT);

    render(<PluginRackSection />);

    const availableShelf = await screen.findByRole("region", { name: "Available plugs" });
    expect(within(availableShelf).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Uninstall",
      "Install",
      "Install from folder",
      "Uninstall",
    ]);
    const notesCard = (await within(availableShelf).findByText("com.mossx.notes")).closest("li");
    await act(async () => {
      within(notesCard as HTMLElement).getByRole("button", { name: "Install from folder" }).click();
    });

    await waitFor(() => {
      expect(pickWorkspacePath).toHaveBeenCalledTimes(1);
      expect(installPluginFromPath).toHaveBeenCalledWith("com.mossx.notes", "/tmp/mossx-plugin-notes");
    });
    expect(installPlugin).not.toHaveBeenCalled();
  });

  it("shows an error when the snapshot command fails", async () => {
    getPluginRackSnapshot.mockRejectedValue(new Error("plugin-rack-lock"));

    render(<PluginRackSection />);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("plugin-rack-lock");
    });
  });
});
