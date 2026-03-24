import {
  isClaudeReasoningThread,
  isGeminiReasoningThread,
  isLocalCliReasoningThread,
  shouldAcceptReasoningDelta,
} from "./threadReducerReasoningGuards";
import { describe, expect, it } from "vitest";

describe("threadReducerReasoningGuards", () => {
  it("detects local-cli reasoning threads", () => {
    expect(isLocalCliReasoningThread("claude:abc")).toBe(true);
    expect(isLocalCliReasoningThread("gemini:abc")).toBe(true);
    expect(isLocalCliReasoningThread("opencode:abc")).toBe(true);
    expect(isLocalCliReasoningThread("codex:abc")).toBe(false);
  });

  it("detects engine-specific reasoning prefixes", () => {
    expect(isClaudeReasoningThread("claude:abc")).toBe(true);
    expect(isClaudeReasoningThread("gemini:abc")).toBe(false);
    expect(isGeminiReasoningThread("gemini:abc")).toBe(true);
    expect(isGeminiReasoningThread("claude:abc")).toBe(false);
  });

  it("always accepts gemini reasoning deltas", () => {
    const state = {
      activeTurnIdByThread: {},
      threadStatusById: {},
    };
    expect(shouldAcceptReasoningDelta(state, "gemini:session-1")).toBe(true);
  });

  it("requires active turn or processing for non-gemini local-cli reasoning threads", () => {
    const idleState = {
      activeTurnIdByThread: { "claude:session-1": null },
      threadStatusById: { "claude:session-1": { isProcessing: false } },
    };
    const activeTurnState = {
      activeTurnIdByThread: { "claude:session-1": "turn-1" },
      threadStatusById: { "claude:session-1": { isProcessing: false } },
    };
    const processingState = {
      activeTurnIdByThread: { "claude:session-1": null },
      threadStatusById: { "claude:session-1": { isProcessing: true } },
    };
    expect(shouldAcceptReasoningDelta(idleState, "claude:session-1")).toBe(false);
    expect(shouldAcceptReasoningDelta(activeTurnState, "claude:session-1")).toBe(true);
    expect(shouldAcceptReasoningDelta(processingState, "claude:session-1")).toBe(true);
  });
});
