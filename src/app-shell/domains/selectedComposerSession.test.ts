import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractClaudeForkParentThreadId,
  fillPendingComposerSelectionEffortFromEnginePref,
  getThreadComposerSelectionStorageKey,
  normalizeComposerSessionSelectionForThread,
  shouldApplyDraftComposerSelectionToThread,
  shouldInheritComposerSelectionFromClaudeForkParent,
  shouldMigrateComposerSelectionBetweenThreadIds,
  type ComposerSessionSelection,
} from "./selectedComposerSession";

const { getComposerEnginePrefForEngine } = vi.hoisted(() => ({
  getComposerEnginePrefForEngine: vi.fn(),
}));

vi.mock("../../features/composer/hooks/composerEnginePrefsStore", () => ({
  getComposerEnginePrefForEngine,
}));

describe("selectedComposerSession", () => {
  const identity = (threadId: string) => threadId;
  const draftSelection: ComposerSessionSelection = {
    modelId: "gpt-5.4",
    effort: "high",
  };

  it("builds a workspace-scoped session key for each thread", () => {
    expect(getThreadComposerSelectionStorageKey("ws-a", "codex:session-1")).toBe(
      "selectedModelByThread.ws-a:codex:session-1",
    );
    expect(getThreadComposerSelectionStorageKey("ws-b", "codex:session-1")).toBe(
      "selectedModelByThread.ws-b:codex:session-1",
    );
  });

  it("applies a draft selection to the first pending thread", () => {
    expect(
      shouldApplyDraftComposerSelectionToThread({
        candidate: null,
        shouldApplyDraftToNextThread: true,
        draftComposerSelection: draftSelection,
        activeThreadId: "codex-pending-1",
      }),
    ).toBe(true);
  });

  it("does not apply a draft selection to a finalized thread", () => {
    expect(
      shouldApplyDraftComposerSelectionToThread({
        candidate: null,
        shouldApplyDraftToNextThread: true,
        draftComposerSelection: draftSelection,
        activeThreadId: "codex:session-1",
      }),
    ).toBe(false);
  });

  // 并行 native：离开会话 A 后 draft 不得污染历史会话 B（finalized）。
  it("does not apply MiniMax draft onto a finalized DeepSeek-bound historical session", () => {
    const minimaxDraft: ComposerSessionSelection = {
      modelId: "MiniMax-M3",
      effort: null,
    };
    expect(
      shouldApplyDraftComposerSelectionToThread({
        candidate: null,
        shouldApplyDraftToNextThread: true,
        draftComposerSelection: minimaxDraft,
        activeThreadId: "claude:historical-deepseek-session",
      }),
    ).toBe(false);
  });

  it("migrates a persisted selection from pending to finalized thread ids", () => {
    expect(
      shouldMigrateComposerSelectionBetweenThreadIds({
        previousThreadId: "codex-pending-1",
        activeThreadId: "codex:session-1",
        previousSessionKey: "selectedModelByThread.ws-a:codex-pending-1",
        activeSessionKey: "selectedModelByThread.ws-a:codex:session-1",
        hasSourceSelection: true,
        hasTargetSelection: false,
        resolveCanonicalThreadId: identity,
      }),
    ).toBe(true);
  });

  it("does not migrate across unrelated threads or engines", () => {
    expect(
      shouldMigrateComposerSelectionBetweenThreadIds({
        previousThreadId: "codex:session-1",
        activeThreadId: "claude:session-2",
        previousSessionKey: "selectedModelByThread.ws-a:codex:session-1",
        activeSessionKey: "selectedModelByThread.ws-a:claude:session-2",
        hasSourceSelection: true,
        hasTargetSelection: false,
        resolveCanonicalThreadId: identity,
      }),
    ).toBe(false);
  });

  it("treats temporary Claude fork ids as Claude children", () => {
    expect(extractClaudeForkParentThreadId("claude-fork:session-1:local-1")).toBe(
      "claude:session-1",
    );
    expect(
      shouldInheritComposerSelectionFromClaudeForkParent({
        activeThreadId: "claude-fork:session-1:local-1",
        hasCandidate: false,
        hasParentSelection: true,
      }),
    ).toBe(true);
  });

  it("normalizes stored effort by thread engine capability", () => {
    expect(
      normalizeComposerSessionSelectionForThread("claude:session-1", {
        modelId: "claude-opus-4-1",
        effort: " high ",
      }),
    ).toEqual({
      modelId: "claude-opus-4-1",
      effort: "high",
    });
    expect(
      normalizeComposerSessionSelectionForThread("claude:session-1", {
        modelId: "claude-opus-4-1",
        effort: "ultra",
      }),
    ).toEqual({
      modelId: "claude-opus-4-1",
      effort: null,
    });
    expect(
      normalizeComposerSessionSelectionForThread("gemini:session-1", {
        modelId: "gemini-2.5-pro",
        effort: "high",
      }),
    ).toEqual({
      modelId: "gemini-2.5-pro",
      effort: null,
    });
    expect(
      normalizeComposerSessionSelectionForThread("grok:session-1", {
        modelId: "grok-4.5",
        effort: " high ",
      }),
    ).toEqual({
      modelId: "grok-4.5",
      effort: "high",
    });
    expect(
      normalizeComposerSessionSelectionForThread("grok:session-1", {
        modelId: "grok-4.5",
        effort: "xhigh",
      }),
    ).toEqual({
      modelId: "grok-4.5",
      effort: null,
    });
    expect(
      normalizeComposerSessionSelectionForThread("codex:session-1", {
        modelId: "gpt-5.4",
        effort: "high",
      }),
    ).toEqual({
      modelId: "gpt-5.4",
      effort: "high",
    });
  });

  describe("fillPendingComposerSelectionEffortFromEnginePref", () => {
    beforeEach(() => {
      getComposerEnginePrefForEngine.mockReset();
      getComposerEnginePrefForEngine.mockReturnValue({
        modelId: "grok-4.5",
        effort: "high",
        accessMode: null,
        collaborationModeId: null,
      });
    });

    it("fills null effort on a Grok pending thread from the engine pref", () => {
      expect(
        fillPendingComposerSelectionEffortFromEnginePref(
          { modelId: "grok-4.5", effort: null },
          "grok-pending-1",
        ),
      ).toEqual({ modelId: "grok-4.5", effort: "high" });
    });

    it("does not override an explicit effort on the pending thread", () => {
      expect(
        fillPendingComposerSelectionEffortFromEnginePref(
          { modelId: "grok-4.5", effort: "low" },
          "grok-pending-1",
        ),
      ).toEqual({ modelId: "grok-4.5", effort: "low" });
    });

    it("does not fill finalized threads or engines without effort prefs", () => {
      expect(
        fillPendingComposerSelectionEffortFromEnginePref(
          { modelId: "grok-4.5", effort: null },
          "grok:session-1",
        ),
      ).toEqual({ modelId: "grok-4.5", effort: null });

      getComposerEnginePrefForEngine.mockReturnValue({
        modelId: "gemini-2.5-pro",
        effort: "high",
        accessMode: null,
        collaborationModeId: null,
      });
      // gemini normalizes effort away; fill still runs only when prefEffort is truthy
      // but normalize strips unsupported effort → stays null for model-only selection.
      expect(
        fillPendingComposerSelectionEffortFromEnginePref(
          { modelId: "gemini-2.5-pro", effort: null },
          "gemini-pending-1",
        ),
      ).toEqual({ modelId: "gemini-2.5-pro", effort: null });
    });

    it("does not invent effort when the engine pref effort is also null", () => {
      getComposerEnginePrefForEngine.mockReturnValue({
        modelId: "grok-4.5",
        effort: null,
        accessMode: null,
        collaborationModeId: null,
      });
      expect(
        fillPendingComposerSelectionEffortFromEnginePref(
          { modelId: "grok-4.5", effort: null },
          "grok-pending-1",
        ),
      ).toEqual({ modelId: "grok-4.5", effort: null });
    });
  });
});
