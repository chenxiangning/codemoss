import { describe, expect, it } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../types";
import { projectActiveSession } from "./activeSessionProjection";

function makeThread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
  return {
    id: "thread-1",
    name: "Session",
    updatedAt: 1,
    engineSource: "claude",
    selectedEngine: "claude",
    providerProfileId: "profile-1",
    ...overrides,
  };
}

describe("projectActiveSession", () => {
  it("returns null projection when no active workspace/thread", () => {
    const projection = projectActiveSession({
      activeWorkspaceId: null,
      activeThreadId: null,
      threadsByWorkspace: {},
      threadStatusById: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      planByThread: {},
      activeItems: [],
      activeTurnIdByThread: {},
      userInputRequests: [],
    });

    expect(projection.activeThreadSummary).toBeNull();
    expect(projection.activeThreadEngine).toBeNull();
    expect(projection.activeThreadProviderProfileId).toBeNull();
    expect(projection.canInterrupt).toBe(false);
    expect(projection.isProcessing).toBe(false);
    expect(projection.isReviewing).toBe(false);
    expect(projection.activeTurnId).toBeNull();
    expect(projection.hasPendingUserInput).toBe(false);
  });

  it("projects active thread summary and engine fields", () => {
    const thread = makeThread({
      id: "t-2",
      engineSource: "codex",
      selectedEngine: "claude",
      providerProfileId: "disk-codex",
    });
    const projection = projectActiveSession({
      activeWorkspaceId: "ws-1",
      activeThreadId: "t-2",
      threadsByWorkspace: { "ws-1": [thread] },
      threadStatusById: {
        "t-2": { isProcessing: true, isReviewing: false },
      },
      tokenUsageByThread: {
        "t-2": {
          total: {
            totalTokens: 3,
            inputTokens: 1,
            cachedInputTokens: 0,
            outputTokens: 2,
            reasoningOutputTokens: 0,
          },
          last: {
            totalTokens: 3,
            inputTokens: 1,
            cachedInputTokens: 0,
            outputTokens: 2,
            reasoningOutputTokens: 0,
          },
          modelContextWindow: null,
        },
      },
      rateLimitsByWorkspace: {
        "ws-1": {
          primary: null,
          secondary: null,
          credits: null,
          planType: null,
        },
      },
      planByThread: {},
      activeItems: [],
      activeTurnIdByThread: { "t-2": "turn-9" },
      userInputRequests: [],
    });

    expect(projection.activeThreadSummary?.id).toBe("t-2");
    // engineSource 优先于 selectedEngine
    expect(projection.activeThreadEngine).toBe("codex");
    expect(projection.activeThreadProviderProfileId).toBe("disk-codex");
    expect(projection.canInterrupt).toBe(true);
    expect(projection.isProcessing).toBe(true);
    expect(projection.isReviewing).toBe(false);
    expect(projection.activeTurnId).toBe("turn-9");
    expect(projection.activeTokenUsage?.total.outputTokens).toBe(2);
  });

  it("detects pending user input for active thread and workspace", () => {
    const projection = projectActiveSession({
      activeWorkspaceId: "ws-1",
      activeThreadId: "t-1",
      threadsByWorkspace: {
        "ws-1": [makeThread({ id: "t-1" })],
      },
      threadStatusById: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      planByThread: {},
      activeItems: [] as ConversationItem[],
      activeTurnIdByThread: {},
      userInputRequests: [
        {
          id: "req-1",
          workspace_id: "ws-1",
          params: {
            item_id: "item-1",
            thread_id: "t-1",
            questions: [],
          },
        } as never,
      ],
    });

    expect(projection.hasPendingUserInput).toBe(true);
  });

  it("ignores user input requests for other threads", () => {
    const projection = projectActiveSession({
      activeWorkspaceId: "ws-1",
      activeThreadId: "t-1",
      threadsByWorkspace: {
        "ws-1": [makeThread({ id: "t-1" })],
      },
      threadStatusById: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      planByThread: {},
      activeItems: [],
      activeTurnIdByThread: {},
      userInputRequests: [
        {
          id: "req-2",
          workspace_id: "ws-1",
          params: {
            item_id: "item-2",
            thread_id: "t-other",
            questions: [],
          },
        } as never,
      ],
    });

    expect(projection.hasPendingUserInput).toBe(false);
  });
});
