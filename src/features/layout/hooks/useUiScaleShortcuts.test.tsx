/* @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiScaleShortcuts } from "./useUiScaleShortcuts";
import type { AppSettings } from "../../../types";
import type { RendererPlatform } from "../../../utils/rendererPlatform";
import { resetApplyUiScaleQueueForTests } from "../../../utils/applyUiScale";
import {
  readUiScaleStartupGuardRecord,
  resetUiScaleStartupGuardForTests,
} from "../../../utils/uiScaleStartupGuard";

const platformMocks = vi.hoisted(() => ({
  platform: "macos" as RendererPlatform,
}));

vi.mock("../../../utils/rendererPlatform", async () => {
  const actual = await vi.importActual<
    typeof import("../../../utils/rendererPlatform")
  >("../../../utils/rendererPlatform");
  return {
    ...actual,
    detectRendererPlatform: () => platformMocks.platform,
  };
});

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    uiScale: 1,
    increaseUiScaleShortcut: "Mod+=",
    decreaseUiScaleShortcut: "Mod+-",
    resetUiScaleShortcut: "Mod+0",
    ...overrides,
  } as AppSettings;
}

describe("useUiScaleShortcuts (locked to 100%)", () => {
  beforeEach(() => {
    resetApplyUiScaleQueueForTests();
    resetUiScaleStartupGuardForTests();
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "";
    document.documentElement.style.width = "";
    document.documentElement.style.height = "";
    document.documentElement.style.transform = "";
    document.documentElement.style.removeProperty("--ui-scale");
    document.body.style.zoom = "";
    document.body.style.width = "";
    document.body.style.height = "";
    document.body.style.transform = "";
    document.body.style.position = "";
  });

  it("always reports uiScale as 1 even when settings carry a legacy value", () => {
    const { result } = renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );
    expect(result.current.uiScale).toBe(1);
  });

  it("clears residual body zoom styles and never applies ≠1", async () => {
    platformMocks.platform = "macos";
    document.documentElement.style.zoom = "0.8";
    document.body.style.zoom = "0.9";
    document.body.style.transform = "scale(0.9)";

    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(document.documentElement.style.zoom).toBe("");
      expect(document.body.style.zoom).toBe("");
      expect(document.body.style.transform).toBe("");
    });
  });

  it("rewrites legacy ≠1 settings back to 1 on mount", async () => {
    const setSettings = vi.fn();
    const saveSettings = vi.fn(async (next: AppSettings) => next);

    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings,
        saveSettings,
      }),
    );

    await waitFor(() => {
      expect(setSettings).toHaveBeenCalled();
    });

    const updater = setSettings.mock.calls[0]?.[0] as (
      current: AppSettings,
    ) => AppSettings;
    const next = updater(createSettings({ uiScale: 0.9 }));
    expect(next.uiScale).toBe(1);
    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ uiScale: 1 }),
      );
    });
  });

  it("scale action handlers are no-ops", () => {
    const setSettings = vi.fn();
    const { result } = renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 1 }),
        setSettings,
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    result.current.increaseUiScale();
    result.current.decreaseUiScale();
    result.current.resetUiScale();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("clears leftover startup-guard pending records", async () => {
    window.localStorage.setItem(
      "ccgui.uiScaleStartupGuard.v1",
      JSON.stringify({ scale: 0.9, markedAt: Date.now() }),
    );

    renderHook(() =>
      useUiScaleShortcuts({
        settings: createSettings({ uiScale: 0.9 }),
        setSettings: vi.fn(),
        saveSettings: vi.fn(async (next) => next),
      }),
    );

    await waitFor(() => {
      expect(readUiScaleStartupGuardRecord()).toBeNull();
    });
  });

  it("works in browser previews without throwing", async () => {
    platformMocks.platform = "unknown";
    expect(() =>
      renderHook(() =>
        useUiScaleShortcuts({
          settings: createSettings({ uiScale: 0.9 }),
          setSettings: vi.fn(),
          saveSettings: vi.fn(async (next) => next),
        }),
      ),
    ).not.toThrow();

    await waitFor(() => {
      expect(document.body.style.zoom).toBe("");
    });
  });
});
