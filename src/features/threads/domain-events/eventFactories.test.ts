import { describe, expect, it } from "vitest";
import type { ConversationState } from "../contracts/conversationCurtainContracts";
import type { DomainEventType } from "./eventTypes";
import {
  createMessageDeltaAppendedEvent,
  createSessionStartedEvent,
} from "./eventFactories";
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
} from "./eventDerivationFixtures";

const occurredAt = "2026-05-18T00:00:00.000Z";
const identity = {
  occurredAt,
  workspaceId: "ws-1",
  sessionId: "thread-1",
  engine: "codex",
} as const;

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    items: [],
    plan: null,
    userInputQueue: [],
    meta: {
      workspaceId: identity.workspaceId,
      threadId: identity.sessionId,
      engine: identity.engine,
      activeTurnId: null,
      isThinking: false,
      heartbeatPulse: null,
      historyRestoredAtMs: null,
    },
    ...overrides,
  };
}

describe("agent domain event factories", () => {
  it("creates immutable events with caller-provided identity fields", () => {
    const event = createSessionStartedEvent({
      ...identity,
      source: "new-thread",
    });

    expect(event).toEqual({
      type: "session.started",
      ...identity,
      source: "new-thread",
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(() => {
      (event as { workspaceId: string }).workspaceId = "mutated";
    }).toThrow();
  });

  it("rejects non-ISO timestamps instead of defaulting occurredAt", () => {
    expect(() =>
      createMessageDeltaAppendedEvent({
        ...identity,
        occurredAt: "not-a-date",
        turnId: "turn-1",
        messageId: "assistant-1",
        deltaLength: 5,
      }),
    ).toThrow(/ISO 8601/);
  });
});

describe("agent domain event derivation fixtures", () => {
  it("covers the initial ten event types with pure state-diff derivations", () => {
    const turnContext = {
      ...identity,
      turnId: "turn-1",
    };
    const started = state();
    const restored = state({
      meta: {
        ...started.meta,
        historyRestoredAtMs: 1,
      },
    });
    const withUserPrompt = state({
      items: [{ id: "user-1", kind: "message", role: "user", text: "Run checks" }],
      meta: {
        ...started.meta,
        activeTurnId: "turn-1",
        isThinking: true,
      },
    });
    const withAssistantDelta = state({
      items: [
        { id: "assistant-1", kind: "message", role: "assistant", text: "hello" },
      ],
    });
    const withAssistantMoreDelta = state({
      items: [
        { id: "assistant-1", kind: "message", role: "assistant", text: "hello world" },
      ],
    });
    const withAssistantFinal = state({
      items: [
        {
          id: "assistant-1",
          kind: "message",
          role: "assistant",
          text: "hello world",
          isFinal: true,
        },
      ],
    });
    const beforeTool = state();
    const withToolStarted = state({
      items: [
        {
          id: "tool-1",
          kind: "tool",
          toolType: "commandExecution",
          title: "Command",
          detail: "npm test",
          status: "started",
        },
      ],
    });
    const withToolCompleted = state({
      items: [
        {
          id: "tool-1",
          kind: "tool",
          toolType: "commandExecution",
          title: "Command",
          detail: "npm test",
          status: "completed",
          durationMs: 12,
        },
      ],
    });
    const usageSnapshot = {
      total: {
        totalTokens: 8,
        inputTokens: 5,
        cachedInputTokens: 1,
        outputTokens: 3,
        reasoningOutputTokens: 0,
      },
      last: {
        totalTokens: 8,
        inputTokens: 5,
        cachedInputTokens: 1,
        outputTokens: 3,
        reasoningOutputTokens: 0,
      },
      modelContextWindow: 200000,
    };

    const events = [
      deriveSessionStartedEvent(started, restored, identity),
      deriveSessionEndedEvent(state({ items: [{ id: "assistant-1", kind: "message", role: "assistant", text: "done" }] }), state(), identity),
      deriveTurnStartedEvent(started, withUserPrompt, turnContext),
      deriveTurnCompletedEvent(withUserPrompt, state(), turnContext, 42),
      deriveTurnFailedEvent(
        state({
          meta: {
            ...started.meta,
            activeTurnId: "turn-1",
            isThinking: false,
          },
        }),
        state(),
        turnContext,
        "runtime error",
      ),
      deriveMessageDeltaAppendedEvent(withAssistantDelta, withAssistantMoreDelta, turnContext, "assistant-1"),
      deriveMessageCompletedEvent(withAssistantMoreDelta, withAssistantFinal, turnContext, "assistant-1"),
      deriveToolStartedEvent(beforeTool, withToolStarted, turnContext, "tool-1"),
      deriveToolCompletedEvent(withToolStarted, withToolCompleted, turnContext, "tool-1"),
      deriveUsageUpdatedEvent(null, usageSnapshot, turnContext),
    ];

    expect(events.map((event) => event?.type)).toEqual([
      "session.started",
      "session.ended",
      "turn.started",
      "turn.completed",
      "turn.failed",
      "message.delta.appended",
      "message.completed",
      "tool.started",
      "tool.completed",
      "usage.updated",
    ] satisfies DomainEventType[]);
  });
});
