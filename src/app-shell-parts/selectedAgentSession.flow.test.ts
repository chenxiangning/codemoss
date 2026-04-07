import { describe, expect, it } from "vitest";
import type { SelectedAgentOption } from "../types";
import {
  shouldApplyDraftAgentToThread,
  shouldMigrateSelectedAgentBetweenThreadIds,
} from "./selectedAgentSession";

type SessionMap = Record<string, SelectedAgentOption | null>;

function sessionKey(workspaceId: string, threadId: string): string {
  return `composer.selectedAgentByThread.${workspaceId}:${threadId}`;
}

function migrateSelection(
  state: SessionMap,
  input: {
    previousThreadId: string | null;
    activeThreadId: string | null;
    previousSessionKey: string | null;
    activeSessionKey: string | null;
    resolveCanonicalThreadId: (threadId: string) => string;
  },
): SessionMap {
  if (
    !shouldMigrateSelectedAgentBetweenThreadIds({
      ...input,
      hasSourceSelection:
        (input.previousSessionKey
          ? state[input.previousSessionKey] ?? null
          : null) !== null,
      hasTargetSelection:
        (input.activeSessionKey
          ? state[input.activeSessionKey] ?? null
          : null) !== null,
    })
  ) {
    return state;
  }
  const sourceSessionKey = input.previousSessionKey!;
  const targetSessionKey = input.activeSessionKey!;
  return {
    ...state,
    [targetSessionKey]: state[sourceSessionKey] ?? null,
  };
}

describe("selected agent session flow", () => {
  it("keeps selected agent after pending->session finalize (project initiated first turn)", () => {
    const workspaceId = "ws-frontend";
    const pendingThreadId = "claude-pending-1001";
    const finalizedThreadId = "claude:session-abc";
    const draftAgent: SelectedAgentOption = {
      id: "backend-architect",
      name: "后端架构师",
      prompt: "focus on backend architecture",
    };

    let selectedAgentBySessionKey: SessionMap = {};
    let shouldApplyDraftToNextThread = true;

    const pendingSessionKey = sessionKey(workspaceId, pendingThreadId);
    const pendingCandidate = selectedAgentBySessionKey[pendingSessionKey] ?? null;
    const shouldApplyToPending = shouldApplyDraftAgentToThread({
      candidate: pendingCandidate,
      shouldApplyDraftToNextThread,
      draftSelectedAgent: draftAgent,
      activeThreadId: pendingThreadId,
    });
    expect(shouldApplyToPending).toBe(true);
    if (shouldApplyToPending) {
      selectedAgentBySessionKey[pendingSessionKey] = draftAgent;
      shouldApplyDraftToNextThread = false;
    }
    expect(selectedAgentBySessionKey[pendingSessionKey]).toEqual(draftAgent);

    const finalizedSessionKey = sessionKey(workspaceId, finalizedThreadId);
    selectedAgentBySessionKey = migrateSelection(selectedAgentBySessionKey, {
      previousThreadId: pendingThreadId,
      activeThreadId: finalizedThreadId,
      previousSessionKey: pendingSessionKey,
      activeSessionKey: finalizedSessionKey,
      resolveCanonicalThreadId: (threadId) =>
        threadId === pendingThreadId ? finalizedThreadId : threadId,
    });
    expect(selectedAgentBySessionKey[finalizedSessionKey]).toEqual(draftAgent);

    const secondSendCandidate = selectedAgentBySessionKey[finalizedSessionKey] ?? null;
    const shouldApplyDraftAgain = shouldApplyDraftAgentToThread({
      candidate: secondSendCandidate,
      shouldApplyDraftToNextThread,
      draftSelectedAgent: draftAgent,
      activeThreadId: finalizedThreadId,
    });
    expect(shouldApplyDraftAgain).toBe(false);
    expect(secondSendCandidate).toEqual(draftAgent);
  });

  it("does not leak draft selected agent into unrelated existing session", () => {
    const draftAgent: SelectedAgentOption = {
      id: "backend-architect",
      name: "后端架构师",
      prompt: "focus on backend architecture",
    };

    const shouldApply = shouldApplyDraftAgentToThread({
      candidate: null,
      shouldApplyDraftToNextThread: true,
      draftSelectedAgent: draftAgent,
      activeThreadId: "claude:existing-session",
    });
    expect(shouldApply).toBe(false);
  });

  it("migrates selected agent across pending finalize for all supported engines", () => {
    const scenarios = [
      {
        pending: "claude-pending-1",
        finalized: "claude:session-1",
      },
      {
        pending: "gemini-pending-1",
        finalized: "gemini:session-1",
      },
      {
        pending: "opencode-pending-1",
        finalized: "opencode:session-1",
      },
    ];
    const agent: SelectedAgentOption = { id: "a", name: "A" };

    for (const scenario of scenarios) {
      const state: SessionMap = {
        [sessionKey("ws", scenario.pending)]: agent,
      };
      const result = migrateSelection(state, {
        previousThreadId: scenario.pending,
        activeThreadId: scenario.finalized,
        previousSessionKey: sessionKey("ws", scenario.pending),
        activeSessionKey: sessionKey("ws", scenario.finalized),
        resolveCanonicalThreadId: (threadId) =>
          threadId === scenario.pending ? scenario.finalized : threadId,
      });
      expect(result[sessionKey("ws", scenario.finalized)]).toEqual(agent);
    }
  });
});
