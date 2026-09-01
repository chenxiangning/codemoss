import { describe, expect, it, vi } from "vitest";
import {
  applyOmpTodoOperation,
  buildOmpHandoffContext,
  compactOmpTodoPlanContext,
  createOmpTodoPlanState,
  ompTodoPlanStorageKey,
  persistOmpTodoPlanState,
  readOmpTodoPlanState,
  recoverOmpTodoPlanContext,
  transitionOmpPlanState,
} from "./ompTodoPlan";

vi.mock("@/services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

import { getClientStoreSync, writeClientStoreValue } from "@/services/clientStorage";

describe("OMP P9 todo operations projection", () => {
  it("applies add/update/complete/remove/clear as feature-local CRUD", () => {
    let state = createOmpTodoPlanState("profile-1");
    let result = applyOmpTodoOperation(state, {
      operation: "add",
      itemId: "t1",
      content: "扫描协议",
    });
    expect(result.status).toBe("applied");
    state = result.state;
    expect(state.todos).toEqual([{ id: "t1", content: "扫描协议", status: "pending" }]);

    result = applyOmpTodoOperation(state, { operation: "update", itemId: "t1", status: "in_progress" });
    expect(result.status).toBe("applied");
    state = result.state;
    expect(state.todos[0]?.status).toBe("in_progress");

    result = applyOmpTodoOperation(state, { operation: "complete", itemId: "t1" });
    state = result.state;
    expect(state.todos[0]?.status).toBe("completed");

    result = applyOmpTodoOperation(state, { operation: "add", itemId: "t2", content: "写文档" });
    state = result.state;
    result = applyOmpTodoOperation(state, { operation: "remove", itemId: "t2" });
    state = result.state;
    expect(state.todos).toHaveLength(1);

    result = applyOmpTodoOperation(state, { operation: "clear" });
    expect(result.state.todos).toHaveLength(0);
  });

  it("marks unknown operations explicitly without mutating state", () => {
    const state = createOmpTodoPlanState("profile-1");
    const result = applyOmpTodoOperation(state, { operation: "teleport", itemId: "t1" });
    expect(result.status).toBe("unknown");
    if (result.status !== "unknown") return;
    expect(result.reason).toBe("unknown-todo-operation");
    expect(result.state).toBe(state);
  });

  it("fails closed on malformed operations instead of inventing items", () => {
    const state = createOmpTodoPlanState("profile-1");
    const result = applyOmpTodoOperation(state, { operation: "add" });
    expect(result.status).toBe("unknown");
    expect(result.state.todos).toHaveLength(0);
  });
});

describe("OMP P9 plan state machine", () => {
  it("walks idle -> planning -> awaiting_review -> executing -> completed", () => {
    let state = createOmpTodoPlanState("profile-1");
    for (const next of ["planning", "awaiting_review", "executing", "completed"] as const) {
      const result = transitionOmpPlanState(state, next);
      expect(result.status).toBe("applied");
      if (result.status === "applied") state = result.state;
    }
    expect(state.planState).toBe("completed");
  });

  it("rejects illegal transitions and leaves state untouched", () => {
    const state = createOmpTodoPlanState("profile-1");
    const result = transitionOmpPlanState(state, "executing");
    expect(result.status).toBe("rejected");
    expect(result.state).toBe(state);
  });
});

describe("OMP P9 compact/handoff context boundary", () => {
  it("compact keeps canonical facts and lists dropped transient fields", () => {
    let state = createOmpTodoPlanState("profile-1");
    state = applyOmpTodoOperation(state, { operation: "add", itemId: "t1", content: "任务" }).state;

    const compacted = compactOmpTodoPlanContext(state, {
      rawPayload: { noisy: true },
      streamDelta: "chunk",
    });
    expect(compacted.kind).toBe("omp-todo-plan-compact");
    expect(compacted.profileId).toBe("profile-1");
    expect(compacted.planState).toBe("idle");
    expect(compacted.todos).toEqual([{ id: "t1", content: "任务", status: "pending" }]);
    expect(compacted.droppedFields).toEqual(["rawPayload", "streamDelta"]);
    expect("rawPayload" in compacted).toBe(false);
  });

  it("handoff carries an explicit field set and nothing else", () => {
    let state = createOmpTodoPlanState("profile-1");
    state = applyOmpTodoOperation(state, { operation: "add", itemId: "t1", content: "任务" }).state;

    const handoff = buildOmpHandoffContext(state, "native-2");
    expect(handoff).toEqual({
      kind: "omp-todo-plan-handoff",
      schemaVersion: 1,
      profileId: "profile-1",
      targetSessionId: "native-2",
      planState: "idle",
      todos: [{ id: "t1", content: "任务", status: "pending" }],
    });
  });
});

describe("OMP P9 todo/plan persistence and context-loss recovery", () => {
  it("persists profile-scoped state via client storage", () => {
    expect(ompTodoPlanStorageKey("profile-1")).toBe("ompTodoPlan:profile-1");

    const state = createOmpTodoPlanState("profile-1");
    persistOmpTodoPlanState(state);
    expect(writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "ompTodoPlan:profile-1",
      expect.objectContaining({ profileId: "profile-1" }),
      expect.objectContaining({ immediate: true }),
    );
  });

  it("reads back a valid persisted state and rejects malformed payloads", () => {
    const valid = createOmpTodoPlanState("profile-1");
    vi.mocked(getClientStoreSync).mockReturnValueOnce(valid as never);
    expect(readOmpTodoPlanState("profile-1")).toEqual(valid);

    vi.mocked(getClientStoreSync).mockReturnValueOnce({ profileId: 42 } as never);
    expect(readOmpTodoPlanState("profile-1")).toBeNull();
  });

  it("recovers persisted context or reports explicit loss, never silently continuing", () => {
    const state = createOmpTodoPlanState("profile-1");
    vi.mocked(getClientStoreSync).mockReturnValueOnce(state as never);
    const recovered = recoverOmpTodoPlanContext("profile-1");
    expect(recovered.status).toBe("recovered");
    if (recovered.status === "recovered") {
      expect(recovered.state.profileId).toBe("profile-1");
    }

    // 持久化缺失 -> 显式 lost，不得静默以空状态继续
    vi.mocked(getClientStoreSync).mockReturnValueOnce(undefined as never);
    const missing = recoverOmpTodoPlanContext("profile-1");
    expect(missing).toEqual({ status: "lost", reason: "missing-persisted-state", state: null });

    // profile 串台 -> 显式 lost
    vi.mocked(getClientStoreSync).mockReturnValueOnce(createOmpTodoPlanState("other") as never);
    const mismatch = recoverOmpTodoPlanContext("profile-1");
    expect(mismatch).toEqual({ status: "lost", reason: "profile-mismatch", state: null });

    // 载荷损坏 -> 显式 lost
    vi.mocked(getClientStoreSync).mockReturnValueOnce({ broken: true } as never);
    const corrupt = recoverOmpTodoPlanContext("profile-1");
    expect(corrupt).toEqual({ status: "lost", reason: "corrupt-persisted-state", state: null });
  });
});
