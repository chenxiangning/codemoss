// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../../i18n";
import type { RequestUserInputRequest, RequestUserInputResponse } from "../../../types";
import { respondToUserInputRequest } from "../../../services/tauri";
import { requestUserInputIdentityKey } from "../../../utils/requestUserInputIdentity";
import {
  isUserInputRequestSettled,
  resetUserInputSettlementTombstonesForTests,
} from "../../../utils/userInputSettlementTombstone";
import { useThreadUserInput } from "./useThreadUserInput";

vi.mock("../../../services/tauri", () => ({
  respondToUserInputRequest: vi.fn(),
}));

const request: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: "req-1",
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [
      {
        id: "age",
        header: "年龄确认",
        question: "你今年多大了？",
        options: [
          { label: "18-25岁 (Recommended)", description: "用于快速给出青年阶段建议" },
          { label: "26-35岁", description: "用于快速给出职业发展阶段建议" },
        ],
      },
    ],
  },
};

describe("useThreadUserInput", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetUserInputSettlementTombstonesForTests();
    await i18nReady;
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    resetUserInputSettlementTombstonesForTests();
    await i18nReady;
    await i18n.changeLanguage("zh");
  });

  it("adds a visible user history message and removes request after successful submit", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputSubmit(request, {
        answers: {
          age: {
            answers: ["18-25岁 (Recommended)", "user_note: 我是31岁"],
          },
        },
      });
    });

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      "req-1",
      {
        age: {
          answers: ["18-25岁 (Recommended)", "user_note: 我是31岁"],
        },
      },
      {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    );

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });

    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: expect.objectContaining({
          id: "item-1",
          kind: "tool",
          toolType: "askuserquestion",
          status: "completed",
        }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: expect.objectContaining({
          id: "request-user-input-submitted-req-1",
          kind: "tool",
          toolType: "requestUserInputSubmitted",
          title: "18-25岁 (Recommended)",
          status: "completed",
        }),
        hasCustomName: true,
      }),
    );
    const upsertAction = dispatch.mock.calls[2]?.[0];
    expect(typeof upsertAction.item.detail).toBe("string");
    const payload = JSON.parse(upsertAction.item.detail);
    expect(payload.schema).toBe("requestUserInputSubmitted/v1");
    expect(payload.questions).toEqual([
      {
        id: "age",
        header: "年龄确认",
        question: "你今年多大了？",
        options: [
          { label: "18-25岁 (Recommended)", description: "用于快速给出青年阶段建议" },
          { label: "26-35岁", description: "用于快速给出职业发展阶段建议" },
        ],
        selectedOptions: ["18-25岁 (Recommended)"],
        note: "我是31岁",
      },
    ]);
    expect(upsertAction.item.output).toContain("[User input submitted]");
    expect(dispatch).toHaveBeenNthCalledWith(4, {
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request,
    });
    expect(isUserInputRequestSettled(requestUserInputIdentityKey(request))).toBe(
      true,
    );
  });

  it("keeps request when submit fails", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(new Error("failed"));

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await expect(
      result.current.handleUserInputSubmit(request, { answers: {} }),
    ).rejects.toThrow("failed");

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    );

    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
  });

  it("settles a dismissed request with skippedQuestionIds and durable submitted audit", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputDismiss(request);
    });

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "thread-1",
        turnId: "turn-1",
        skippedQuestionIds: ["age"],
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: expect.objectContaining({
          id: "item-1",
          kind: "tool",
          toolType: "askuserquestion",
          status: "completed",
        }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: expect.objectContaining({
          id: "request-user-input-submitted-req-1",
          kind: "tool",
          toolType: "requestUserInputSubmitted",
          status: "completed",
        }),
        hasCustomName: true,
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(4, {
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request,
    });
    expect(isUserInputRequestSettled(requestUserInputIdentityKey(request))).toBe(
      true,
    );
  });

  it("removes dismissed stale requests when runtime has already settled them", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("workspace not connected"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputDismiss(request);
    });

    expect(respondToUserInputRequest).toHaveBeenLastCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "thread-1",
        turnId: "turn-1",
        skippedQuestionIds: ["age"],
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "removeUserInputRequest",
        requestId: "req-1",
        workspaceId: "ws-1",
        request,
      }),
    );
    expect(isUserInputRequestSettled(requestUserInputIdentityKey(request))).toBe(
      true,
    );
  });

  it("does not tombstone non-stale submit failures so retry remains possible", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("network blip"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await expect(
      act(async () => {
        await result.current.handleUserInputSubmit(request, {
          answers: { age: { answers: ["18-25岁 (Recommended)"] } },
        });
      }),
    ).rejects.toThrow(/network blip/i);

    expect(isUserInputRequestSettled(requestUserInputIdentityKey(request))).toBe(
      false,
    );
  });

  it("settles a stale timeout request when cancel reaches an already timed out Claude prompt", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("workspace not connected"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputDismiss(request);
    });

    expect(respondToUserInputRequest).toHaveBeenLastCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "thread-1",
        turnId: "turn-1",
        skippedQuestionIds: ["age"],
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          toolType: "askuserquestion",
          status: "completed",
        }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          toolType: "requestUserInputSubmitted",
          status: "completed",
        }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request,
    });
  });

  it("settles a timed-out submit when runtime reports the request is already stale", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("workspace not connected"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputSubmit(
        request,
        {
          answers: {
            age: {
              answers: ["18-25岁 (Recommended)"],
            },
          },
        },
        { staleSettlementHint: "timeout" },
      );
    });

    expect(respondToUserInputRequest).toHaveBeenLastCalledWith(
      "ws-1",
      "req-1",
      {
        age: {
          answers: ["18-25岁 (Recommended)"],
        },
      },
      {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          toolType: "askuserquestion",
          status: "completed",
        }),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request,
    });
  });

  it("settles a late submit recognized as expired even without a local timeout hint", async () => {
    // The frontend's own countdown can lag the backend's real deadline (clock
    // drift, throttled tab). When that happens the submit arrives with no
    // staleSettlementHint, so this must be recognized from the backend's
    // error message alone, not the hint.
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("AskUserQuestion request ask-1 already expired or was answered"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await act(async () => {
      await result.current.handleUserInputSubmit(request, {
        answers: {
          age: {
            answers: ["18-25岁 (Recommended)"],
          },
        },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request,
    });
    // The stale branch also writes a durable terminal marker before removing,
    // so a history reopen cannot rehydrate the card as live. That marker is
    // settlement behaviour shared with every other stale path; what this test
    // pins is that the expired-answer error reaches that branch at all,
    // without a local timeout hint to corroborate it.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          toolType: "askuserquestion",
          status: "completed",
        }),
      }),
    );
  });

  it("keeps empty submit retryable when workspace disconnects", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("workspace not connected"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await expect(
      result.current.handleUserInputSubmit(request, { answers: {} }),
    ).rejects.toThrow("workspace not connected");

    expect(respondToUserInputRequest).toHaveBeenLastCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "thread-1",
        turnId: "turn-1",
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
    });
  });

  it("keeps malformed empty submit responses retryable", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("workspace not connected"),
    );

    const { result } = renderHook(() => useThreadUserInput({ dispatch }));

    await expect(
      result.current.handleUserInputSubmit(
        request,
        { answers: { age: {} } } as unknown as RequestUserInputResponse,
      ),
    ).rejects.toThrow("workspace not connected");

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
    });
  });

  it("keeps runtime payload stable but remaps Claude continuity state updates", async () => {
    const dispatch = vi.fn();
    vi.mocked(respondToUserInputRequest).mockResolvedValue(undefined as never);

    const { result } = renderHook(() =>
      useThreadUserInput({
        dispatch,
        resolveClaudeContinuationThreadId: () => "claude:canonical",
      }),
    );

    await act(async () => {
      await result.current.handleUserInputSubmit(
        {
          ...request,
          params: {
            ...request.params,
            thread_id: "claude:stale",
          },
        },
        { answers: {} },
      );
    });

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "claude:stale",
        turnId: "turn-1",
      },
    );
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "claude:canonical",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "claude:canonical",
      }),
    );
  });

  it("submits shared Codex user input with native thread id for resume watching", async () => {
    const dispatch = vi.fn();
    const resolveClaudeContinuationThreadId = vi.fn();
    vi.mocked(respondToUserInputRequest).mockResolvedValue(undefined as never);
    const sharedRuntimeOwner = {
      attemptId: "attempt-1",
      providerRuntimeKey: "codex::profile-kimi",
      sharedThreadId: "shared:codex-thread-1",
      nativeThreadId: "codex-native-thread-1",
      runtimeTurnId: "turn-1",
      engine: "codex" as const,
      providerProfileId: "profile-kimi",
    };
    const sharedRequest: RequestUserInputRequest = {
      ...request,
      params: {
        ...request.params,
        thread_id: sharedRuntimeOwner.sharedThreadId,
      },
      shared_runtime_owner: sharedRuntimeOwner,
    };

    const { result } = renderHook(() =>
      useThreadUserInput({
        dispatch,
        resolveClaudeContinuationThreadId,
      }),
    );

    await act(async () => {
      await result.current.handleUserInputSubmit(
        sharedRequest,
        { answers: {} },
      );
    });

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      "req-1",
      {},
      {
        threadId: "codex-native-thread-1",
        turnId: "turn-1",
        sharedOwner: sharedRuntimeOwner,
      },
    );
    expect(resolveClaudeContinuationThreadId).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markProcessing",
      threadId: "shared:codex-thread-1",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        type: "upsertItem",
        item: expect.objectContaining({
          id: "request-user-input-submitted-attempt-1-req-1",
        }),
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(4, {
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request: sharedRequest,
    });
  });

  it("fails closed before side effects when Shared user input has no Runtime owner", async () => {
    const dispatch = vi.fn();
    const resolveClaudeContinuationThreadId = vi.fn(
      () => "codex-native-thread-1",
    );
    const { result } = renderHook(() =>
      useThreadUserInput({ dispatch, resolveClaudeContinuationThreadId }),
    );

    await expect(
      result.current.handleUserInputSubmit(
        {
          ...request,
          params: {
            ...request.params,
            thread_id: "shared:codex-thread-1",
          },
        },
        { answers: {} },
      ),
    ).rejects.toThrow("missing its Runtime owner");

    expect(resolveClaudeContinuationThreadId).not.toHaveBeenCalled();
    expect(respondToUserInputRequest).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
