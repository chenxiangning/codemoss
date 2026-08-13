// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoMigrateDisabledActiveEngine } from "./useAutoMigrateDisabledActiveEngine";

describe("useAutoMigrateDisabledActiveEngine", () => {
  const installedEngines = [
    { type: "claude" as const, installed: true },
    { type: "codex" as const, installed: true },
    { type: "grok" as const, installed: true },
  ];

  it("migrates home active engine off a disabled CLI", async () => {
    const setActiveEngine = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useAutoMigrateDisabledActiveEngine({
        activeEngine: "codex",
        activeThreadEngine: null,
        activeThreadId: null,
        appSettingsLoading: false,
        disabledCliEngineIds: ["codex"],
        installedEngines,
        setActiveEngine,
      }),
    );

    await waitFor(() => {
      expect(setActiveEngine).toHaveBeenCalledWith("claude");
    });
  });

  it("skips migration while a thread is still bound to the disabled engine", async () => {
    const setActiveEngine = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useAutoMigrateDisabledActiveEngine({
        activeEngine: "codex",
        activeThreadEngine: "codex",
        activeThreadId: "thread-1",
        appSettingsLoading: false,
        disabledCliEngineIds: ["codex"],
        installedEngines,
        setActiveEngine,
      }),
    );

    await waitFor(() => {
      expect(setActiveEngine).not.toHaveBeenCalled();
    });
  });

  it("migrates when leaving a bound thread while the engine stays disabled", async () => {
    const setActiveEngine = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      (props: {
        activeThreadId: string | null;
        activeThreadEngine: "codex" | null;
      }) =>
        useAutoMigrateDisabledActiveEngine({
          activeEngine: "codex",
          activeThreadEngine: props.activeThreadEngine,
          activeThreadId: props.activeThreadId,
          appSettingsLoading: false,
          disabledCliEngineIds: ["codex", "claude"],
          installedEngines,
          setActiveEngine,
        }),
      {
        initialProps: {
          activeThreadId: "thread-1" as string | null,
          activeThreadEngine: "codex" as "codex" | null,
        },
      },
    );

    expect(setActiveEngine).not.toHaveBeenCalled();

    rerender({ activeThreadId: null, activeThreadEngine: null });

    await waitFor(() => {
      expect(setActiveEngine).toHaveBeenCalledWith("grok");
    });
  });

  it("does nothing while app settings are still loading", async () => {
    const setActiveEngine = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useAutoMigrateDisabledActiveEngine({
        activeEngine: "codex",
        activeThreadEngine: null,
        activeThreadId: null,
        appSettingsLoading: true,
        disabledCliEngineIds: ["codex"],
        installedEngines,
        setActiveEngine,
      }),
    );

    await waitFor(() => {
      expect(setActiveEngine).not.toHaveBeenCalled();
    });
  });
});
