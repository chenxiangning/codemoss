// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetComposerEnginePrefsStoreForTests,
  setComposerEnginePref,
} from "../../features/composer/hooks/composerEnginePrefsStore";
import { useCollaborationModeThreadSync } from "./useCollaborationModeThreadSync";

describe("useCollaborationModeThreadSync", () => {
  beforeEach(() => {
    __resetComposerEnginePrefsStoreForTests();
  });

  it("syncs mapped thread mode and active thread refs", () => {
    const setSelectedCollaborationModeId = vi.fn();
    const activeThreadIdForModeRef = { current: null as string | null };
    const lastCodexModeSyncThreadRef = { current: null as string | null };
    const codexComposerModeRef = { current: null as "plan" | "code" | null };

    renderHook(() =>
      useCollaborationModeThreadSync({
        activeEngine: "codex",
        activeThreadId: "codex:thread-1",
        activeThreadIdForModeRef,
        appSettingsLoading: false,
        codexComposerModeRef,
        collaborationUiModeByThread: { "codex:thread-1": "plan" },
        lastCodexModeSyncThreadRef,
        selectedCollaborationModeId: "code",
        setSelectedCollaborationModeId,
      }),
    );

    expect(activeThreadIdForModeRef.current).toBe("codex:thread-1");
    expect(lastCodexModeSyncThreadRef.current).toBe("codex:thread-1");
    expect(codexComposerModeRef.current).toBe("plan");
    expect(setSelectedCollaborationModeId).toHaveBeenCalledWith("plan");
  });

  it("uses the persisted Claude plan/code default for a new thread", () => {
    setComposerEnginePref("claude", { collaborationModeId: "plan" });
    const setSelectedCollaborationModeId = vi.fn();
    const lastCodexModeSyncThreadRef = { current: null as string | null };
    const codexComposerModeRef = { current: null as "plan" | "code" | null };

    renderHook(() =>
      useCollaborationModeThreadSync({
        activeEngine: "claude",
        activeThreadId: "claude-pending-1",
        activeThreadIdForModeRef: { current: null },
        appSettingsLoading: false,
        codexComposerModeRef,
        collaborationUiModeByThread: {},
        lastCodexModeSyncThreadRef,
        selectedCollaborationModeId: "code",
        setSelectedCollaborationModeId,
      }),
    );

    expect(lastCodexModeSyncThreadRef.current).toBe("claude-pending-1");
    expect(codexComposerModeRef.current).toBe("plan");
    expect(setSelectedCollaborationModeId).toHaveBeenCalledWith("plan");
  });
});
