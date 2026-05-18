import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadTokenUsage } from "../../../types";
import type { ConversationState } from "../contracts/conversationCurtainContracts";
import {
  deriveMessageCompletedEvent,
  deriveMessageDeltaAppendedEvent,
  deriveSessionEndedEvent,
  deriveSessionStartedEvent,
  deriveToolCompletedEvent,
  deriveToolStartedEvent,
  deriveTurnCompletedEvent,
  deriveTurnFailedEvent,
  deriveTurnStartedEvent,
  deriveUsageUpdatedEvent,
} from "../domain-events/eventDerivationFixtures";
import { initialState, threadReducer } from "./useThreadsReducer";
import type { ThreadState } from "./useThreadsReducer";

const workspaceId = "ws-domain-events";
const threadId = "codex:domain-events";
const occurredAt = "2026-05-18T00:00:00.000Z";
const identity = {
  occurredAt,
  workspaceId,
  sessionId: threadId,
  engine: "codex",
} as const;
const turnContext = {
  ...identity,
  turnId: "turn-1",
} as const;

function conversationStateFromReducerState(state: ThreadState): ConversationState {
  const threadStatus = state.threadStatusById[threadId];
  return {
    items: state.itemsByThread[threadId] ?? [],
    plan: state.planByThread[threadId] ?? null,
    userInputQueue: [],
    meta: {
      workspaceId,
      threadId,
      engine: "codex",
      activeTurnId: state.activeTurnIdByThread[threadId] ?? null,
      isThinking: threadStatus?.isProcessing ?? false,
      heartbeatPulse: threadStatus?.heartbeatPulse ?? null,
      historyRestoredAtMs: state.historyRestoredAtMsByThread[threadId] ?? null,
    },
  };
}

function upsertItem(state: ThreadState, item: ConversationItem): ThreadState {
  return threadReducer(state, {
    type: "upsertItem",
    workspaceId,
    threadId,
    item,
    hasCustomName: false,
  });
}

const usageSnapshot: ThreadTokenUsage = {
  total: {
    inputTokens: 5,
    cachedInputTokens: 1,
    outputTokens: 3,
    reasoningOutputTokens: 0,
    totalTokens: 8,
  },
  last: {
    inputTokens: 5,
    cachedInputTokens: 1,
    outputTokens: 3,
    reasoningOutputTokens: 0,
    totalTokens: 8,
  },
  modelContextWindow: 200_000,
};

describe("threadReducer domain event derivation fixtures", () => {
  it("derives the initial ten AgentDomainEvent shapes from real reducer state transitions", () => {
    const restored = threadReducer(initialState, {
      type: "setThreadHistoryRestoredAt",
      threadId,
      timestamp: 1,
    });
    expect(
      deriveSessionStartedEvent(
        conversationStateFromReducerState(initialState),
        conversationStateFromReducerState(restored),
        identity,
      )?.type,
    ).toBe("session.started");

    const withUser = upsertItem(restored, {
      id: "user-1",
      kind: "message",
      role: "user",
      text: "Run the harness governance checks",
    });
    const turnStarted = threadReducer(withUser, {
      type: "setActiveTurnId",
      threadId,
      turnId: "turn-1",
    });
    expect(
      deriveTurnStartedEvent(
        conversationStateFromReducerState(withUser),
        conversationStateFromReducerState(turnStarted),
        turnContext,
      )?.type,
    ).toBe("turn.started");

    const withAssistantDelta = threadReducer(turnStarted, {
      type: "appendAgentDelta",
      workspaceId,
      threadId,
      itemId: "assistant-1",
      delta: "hello",
      hasCustomName: false,
    });
    const withAssistantMoreDelta = threadReducer(withAssistantDelta, {
      type: "appendAgentDelta",
      workspaceId,
      threadId,
      itemId: "assistant-1",
      delta: " world",
      hasCustomName: false,
    });
    expect(
      deriveMessageDeltaAppendedEvent(
        conversationStateFromReducerState(withAssistantDelta),
        conversationStateFromReducerState(withAssistantMoreDelta),
        turnContext,
        "assistant-1",
      )?.type,
    ).toBe("message.delta.appended");

    const withAssistantFinal = threadReducer(withAssistantMoreDelta, {
      type: "completeAgentMessage",
      workspaceId,
      threadId,
      itemId: "assistant-1",
      text: "hello world",
      hasCustomName: false,
      timestamp: 2,
    });
    expect(
      deriveMessageCompletedEvent(
        conversationStateFromReducerState(withAssistantMoreDelta),
        conversationStateFromReducerState(withAssistantFinal),
        turnContext,
        "assistant-1",
      )?.type,
    ).toBe("message.completed");

    const withToolStarted = upsertItem(withAssistantFinal, {
      id: "tool-1",
      kind: "tool",
      toolType: "commandExecution",
      title: "Command",
      detail: "npm run typecheck",
      status: "started",
    });
    expect(
      deriveToolStartedEvent(
        conversationStateFromReducerState(withAssistantFinal),
        conversationStateFromReducerState(withToolStarted),
        turnContext,
        "tool-1",
      )?.type,
    ).toBe("tool.started");

    const withToolCompleted = upsertItem(withToolStarted, {
      id: "tool-1",
      kind: "tool",
      toolType: "commandExecution",
      title: "Command",
      detail: "npm run typecheck",
      status: "completed",
      durationMs: 12,
    });
    expect(
      deriveToolCompletedEvent(
        conversationStateFromReducerState(withToolStarted),
        conversationStateFromReducerState(withToolCompleted),
        turnContext,
        "tool-1",
      )?.type,
    ).toBe("tool.completed");

    const withUsage = threadReducer(withToolCompleted, {
      type: "setThreadTokenUsage",
      threadId,
      tokenUsage: usageSnapshot,
    });
    expect(
      deriveUsageUpdatedEvent(null, withUsage.tokenUsageByThread[threadId] ?? null, turnContext)
        ?.type,
    ).toBe("usage.updated");

    const completedTurn = threadReducer(withUsage, {
      type: "setActiveTurnId",
      threadId,
      turnId: null,
    });
    expect(
      deriveTurnCompletedEvent(
        conversationStateFromReducerState(withUsage),
        conversationStateFromReducerState(completedTurn),
        turnContext,
        42,
      )?.type,
    ).toBe("turn.completed");

    const failedTurnBase = threadReducer(withUser, {
      type: "setActiveTurnId",
      threadId,
      turnId: "turn-1",
    });
    const failedTurn = threadReducer(failedTurnBase, {
      type: "setActiveTurnId",
      threadId,
      turnId: null,
    });
    expect(
      deriveTurnFailedEvent(
        conversationStateFromReducerState(failedTurnBase),
        conversationStateFromReducerState(failedTurn),
        turnContext,
        "runtime error",
      )?.type,
    ).toBe("turn.failed");

    const endedSession = threadReducer(withAssistantFinal, {
      type: "setThreadItems",
      threadId,
      items: [],
    });
    expect(
      deriveSessionEndedEvent(
        conversationStateFromReducerState(withAssistantFinal),
        conversationStateFromReducerState(endedSession),
        identity,
      )?.type,
    ).toBe("session.ended");
  });
});
