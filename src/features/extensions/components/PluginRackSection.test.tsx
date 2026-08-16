/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PluginRackSection } from "./PluginRackSection";

const translations: Record<string, string> = {
  "extensions.rack.title": "Plugin rack",
  "extensions.rack.subtitle": "Declared Host plugs. Read-only.",
  "extensions.rack.loading": "Reading Host snapshot…",
  "extensions.rack.hostUnavailable": "Host snapshot unavailable.",
  "extensions.rack.hostDisabled": "Host is default-off.",
  "extensions.rack.hostEnabled": "Host is enabled.",
  "extensions.rack.kind": "Kind",
  "extensions.rack.state": "State",
  "extensions.rack.generation": "Generation",
  "extensions.rack.marketplaceLater": "Marketplace stays closed.",
  "extensions.rack.error": "Could not read the Host rack: {{message}}",
  "extensions.rack.kinds.engine": "Engine",
  "extensions.rack.kinds.feature": "Feature",
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

vi.mock("@/services/tauri/pluginRack", () => ({
  getPluginRackSnapshot,
}));

describe("PluginRackSection", () => {
  it("renders declared idle plugs without a marketplace action", async () => {
    getPluginRackSnapshot.mockResolvedValue({
      hostAvailable: true,
      hostEnabled: false,
      plugs: [
        {
          pluginId: "com.mossx.engine.claude",
          displayName: "Claude Engine",
          kind: "engine",
          state: "idle",
          generation: 0,
          unitId: null,
          live: false,
        },
        {
          pluginId: "com.mossx.notes",
          displayName: "Notes",
          kind: "feature",
          state: "idle",
          generation: 0,
          unitId: null,
          live: false,
        },
      ],
    });

    render(<PluginRackSection />);

    expect(await screen.findByRole("heading", { name: "Plugin rack" })).toBeTruthy();
    expect(screen.getByText("Host is default-off.")).toBeTruthy();
    expect(screen.getByText("com.mossx.engine.claude")).toBeTruthy();
    expect(screen.getByText("com.mossx.notes")).toBeTruthy();
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
