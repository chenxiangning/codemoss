import { beforeEach, describe, expect, it, vi } from "vitest";

import { startSharedSession } from "@mossx/plugin-shared-session/runtime";
import {
  getSharedTargetState,
  resetSharedTargetStoreForTests,
} from "@mossx/plugin-shared-session/runtime";
import { createStartSharedSessionForWorkspace } from "./useThreadActions.sessionActions";

vi.mock("../../shared-session/services/sharedSessions", () => ({
  archiveSharedSession: vi.fn(),
  deleteSharedSession: vi.fn(),
  startSharedSession: vi.fn(),
}));

const requestedTarget = {
  engine: "codex" as const,
  providerProfileId: "provider-a",
  modelCatalogEntryId: "catalog-a",
  model: "runtime-a",
  reasoning: { effort: "high" },
  providerProfileNameSnapshot: "Provider A",
  providerProfileSource: "managed" as const,
};

function createStartAction(threadId = "") {
  const dispatch = vi.fn();
  const start = createStartSharedSessionForWorkspace({
    dispatch,
    extractThreadId: vi.fn(() => threadId),
    loadedThreadsRef: { current: {} },
    threadsByWorkspace: {},
  });
  return { dispatch, start };
}

describe("createStartSharedSessionForWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSharedTargetStoreForTests();
  });

  it("rejects an engine/target mismatch instead of replacing the target with null", async () => {
    const { start } = createStartAction();

    await expect(
      start("ws-1", {
        initialEngine: "claude",
        initialTarget: {
          engine: "codex",
          providerProfileId: null,
          modelCatalogEntryId: "gpt-5.3-codex",
          model: "gpt-5.3-codex",
          providerProfileNameSnapshot: "本地配置",
          providerProfileSource: "disk",
        },
      }),
    ).rejects.toThrow("初始 Engine 与 Execution Target 不一致");
  });

  it("rejects a missing target before creating a partial Shared Session", async () => {
    const { start } = createStartAction();

    await expect(
      start("ws-1", { initialEngine: "claude" }),
    ).rejects.toThrow("Execution Target 不完整");
  });

  it("publishes only the exact normalized target returned by backend", async () => {
    vi.mocked(startSharedSession).mockResolvedValue({
      result: {
        thread: {
          id: "shared:thread-a",
          name: "Shared Session",
          updatedAt: 42,
          selectedTarget: requestedTarget,
        },
      },
    });
    const { dispatch, start } = createStartAction("shared:thread-a");

    await expect(
      start("ws-1", { initialTarget: requestedTarget }),
    ).resolves.toBe("shared:thread-a");

    expect(
      getSharedTargetState("ws-1", "shared:thread-a").selectedNextTarget,
    ).toEqual(requestedTarget);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
      }),
    );
  });

  it("does not publish a new session when backend target is malformed or mismatched", async () => {
    vi.mocked(startSharedSession).mockResolvedValue({
      result: {
        thread: {
          id: "shared:thread-b",
          selectedTarget: {
            ...requestedTarget,
            providerProfileId: "provider-b",
          },
        },
      },
    });
    const { dispatch, start } = createStartAction("shared:thread-b");

    await expect(
      start("ws-1", { initialTarget: requestedTarget }),
    ).rejects.toThrow("mismatched");

    expect(
      getSharedTargetState("ws-1", "shared:thread-b").selectedNextTarget,
    ).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
