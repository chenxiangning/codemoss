// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import {
  markUserInputRequestSettled,
  resetUserInputSettlementTombstonesForTests,
} from "../../../utils/userInputSettlementTombstone";
import { requestUserInputIdentityKey } from "../../../utils/requestUserInputIdentity";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";

const baseRequest: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: "req-1",
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [{ id: "q1", header: "", question: "Continue?" }],
  },
};

describe("useThreadUserInputEvents", () => {
  beforeEach(() => {
    resetUserInputSettlementTombstonesForTests();
  });

  afterEach(() => {
    resetUserInputSettlementTombstonesForTests();
  });

  it("adds requestUserInput into queue when request is not completed", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInputEvents({ dispatch }));

    act(() => {
      result.current(baseRequest);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "addUserInputRequest",
      request: baseRequest,
    });
  });

  it("removes request when completed is true", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInputEvents({ dispatch }));
    const completedRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        completed: true,
      },
    };

    act(() => {
      result.current(completedRequest);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request: completedRequest,
    });
  });

  it("ignores stale non-completed event after completed event for same request", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInputEvents({ dispatch }));
    const completedRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        completed: true,
      },
    };

    act(() => {
      result.current(completedRequest);
    });

    act(() => {
      result.current(baseRequest);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: "req-1",
      workspaceId: "ws-1",
      request: completedRequest,
    });
  });

  it("does not let a completed Shared attempt suppress the same request id on another Runtime", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInputEvents({ dispatch }));
    const owner = {
      attemptId: "attempt-1",
      providerRuntimeKey: "codex::profile-a",
      sharedThreadId: "shared:thread-1",
      nativeThreadId: "native-1",
      runtimeTurnId: "runtime-turn-1",
      engine: "codex" as const,
      providerProfileId: "profile-a",
    };
    const completedRequest: RequestUserInputRequest = {
      ...baseRequest,
      params: {
        ...baseRequest.params,
        thread_id: owner.sharedThreadId,
        turn_id: owner.runtimeTurnId,
        completed: true,
      },
      shared_runtime_owner: owner,
    };
    const nextRuntimeRequest: RequestUserInputRequest = {
      ...completedRequest,
      params: {
        ...completedRequest.params,
        completed: false,
        turn_id: "runtime-turn-2",
      },
      shared_runtime_owner: {
        ...owner,
        attemptId: "attempt-2",
        providerRuntimeKey: "claude::profile-b",
        nativeThreadId: "native-2",
        runtimeTurnId: "runtime-turn-2",
        engine: "claude",
        providerProfileId: "profile-b",
      },
    };

    act(() => {
      result.current(completedRequest);
      result.current(nextRuntimeRequest);
    });

    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "addUserInputRequest",
      request: nextRuntimeRequest,
    });
  });

  it("ignores non-completed re-add after local settlement tombstone", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadUserInputEvents({ dispatch }));

    markUserInputRequestSettled(requestUserInputIdentityKey(baseRequest));

    act(() => {
      result.current(baseRequest);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
