// @vitest-environment jsdom
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  connectWorkspace,
  createWorkspaceDirectory,
  forkThread,
  resumeThread,
  startThread,
} from "../../../services/tauri";
import {
  buildItemsFromThread,
  previewThreadName,
} from "../../../utils/threadItems";
import {
  clearGlobalRuntimeNotices,
  getGlobalRuntimeNoticesSnapshot,
} from "../../../services/globalRuntimeNotices";
import { renderActions } from "./useThreadActions.test-utils";

vi.mock("../../../services/tauri", () => ({
  startThread: vi.fn(),
  connectWorkspace: vi.fn(),
  createWorkspaceDirectory: vi.fn(),
  forkClaudeSession: vi.fn(),
  forkClaudeSessionFromMessage: vi.fn(),
  forkThread: vi.fn(),
  rewindCodexThread: vi.fn(),
  listClaudeSessions: vi.fn(),
  listGeminiSessions: vi.fn(),
  listKimiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  getOpenCodeSessionList: vi.fn(),
  listWorkspaceSessions: vi.fn(),
  loadClaudeSession: vi.fn(),
  loadGeminiSession: vi.fn(),
  loadCodexSession: vi.fn(),
  listThreadTitles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  setThreadTitle: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  writeClientCreatedSessionIndex: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSession: vi.fn(),
  deleteClaudeSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  trashWorkspaceItem: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  extractClaudeApprovalResumeEntries: vi.fn(() => []),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  normalizeItem: vi.fn((item: ConversationItem) => item),
  previewThreadName: vi.fn(),
  stripClaudeApprovalResumeArtifacts: vi.fn((text: string) => text),
}));

vi.mock("../utils/threadStorage", () => ({
  makeCustomNameKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
  saveThreadActivity: vi.fn(),
}));

vi.mock("../utils/sidebarSnapshot", () => ({
  loadSidebarSnapshot: vi.fn(() => null),
}));

vi.mock("../../../services/globalRuntimeNotices", async () => {
  const actual = await vi.importActual<
    typeof import("../../../services/globalRuntimeNotices")
  >("../../../services/globalRuntimeNotices");
  return actual;
});

describe("useThreadActions start/fork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(connectWorkspace).mockResolvedValue(undefined);
    vi.mocked(createWorkspaceDirectory).mockResolvedValue(undefined);
    vi.mocked(previewThreadName).mockImplementation(
      (text: string, fallback: string) => {
        const trimmed = text.trim();
        return trimmed || fallback;
      },
    );
    clearGlobalRuntimeNotices();
  });

  it("starts an optimistic codex pending thread and prewarms the backend start", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toMatch(/^codex-pending-/);
    expect(startThread).toHaveBeenCalledWith("ws-1");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId,
      engine: "codex",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "markCodexAcceptedTurn",
      threadId,
      fact: "empty-draft",
      source: "thread-start",
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId,
    });
    expect(threadId ? loadedThreadsRef.current[threadId] : false).toBe(true);
  });

  it("rejects Gemini thread creation before any owner side effect", async () => {
    const { result, dispatch } = renderActions();

    await expect(
      result.current.startThreadForWorkspace("ws-1", { engine: "gemini" }),
    ).rejects.toThrow("Selected CLI engine is disabled by product policy");

    expect(startThread).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("finalizes an optimistic codex pending thread into the real backend thread", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBe("thread-1");
    expect(startThread).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "renameThreadId",
      workspaceId: "ws-1",
      oldThreadId: pendingThreadId,
      newThreadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
      engine: "codex",
    });
    expect(loadedThreadsRef.current["thread-1"]).toBe(true);
    expect(loadedThreadsRef.current[pendingThreadId!]).toBeUndefined();
  });

  it("returns the same real thread id for concurrent finalize calls", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-shared" } },
    });

    const { result } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    let first: string | null = null;
    let second: string | null = null;
    await act(async () => {
      [first, second] = await Promise.all([
        result.current.finalizeCodexPendingThread("ws-1", pendingThreadId!),
        result.current.finalizeCodexPendingThread("ws-1", pendingThreadId!),
      ]);
    });

    expect(first).toBe("thread-shared");
    expect(second).toBe("thread-shared");
    expect(startThread).toHaveBeenCalledTimes(1);
  });

  it("treats the explicit disk provider selection as an optimistic create", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      // The sidebar new-session menu always sends the __disk__ profile id;
      // it must not be mistaken for a managed provider (sync path).
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        providerProfileId: "__disk__",
      });
    });

    expect(threadId).toMatch(/^codex-pending-/);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        threadId,
        engine: "codex",
        providerProfileId: "__disk__",
        providerProfileSource: "disk",
      }),
    );
  });

  it.each(["claude", "kimi"] as const)(
    "keeps the selected provider on optimistic %s threads",
    async (engine) => {
      const { result, dispatch } = renderActions();

      let threadId: string | null = null;
      await act(async () => {
        threadId = await result.current.startThreadForWorkspace("ws-1", {
          engine,
          providerProfileId: "provider-a",
          providerProfile: {
            id: "provider-a",
            name: "Provider A",
            source: "managed",
          },
        });
      });

      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ensureThread",
          threadId,
          engine,
          providerProfileId: "provider-a",
          providerProfileName: "Provider A",
          providerProfileSource: "managed",
        }),
      );
    },
  );

  it("creates distinct pending threads for rapid consecutive codex creates", async () => {
    vi.mocked(startThread)
      .mockResolvedValueOnce({ result: { thread: { id: "thread-a" } } })
      .mockResolvedValueOnce({ result: { thread: { id: "thread-b" } } });

    const { result } = renderActions();

    let firstThreadId: string | null = null;
    let secondThreadId: string | null = null;
    await act(async () => {
      [firstThreadId, secondThreadId] = await Promise.all([
        result.current.startThreadForWorkspace("ws-1", { activate: false }),
        result.current.startThreadForWorkspace("ws-1", { activate: true }),
      ]);
    });

    expect(firstThreadId).toMatch(/^codex-pending-/);
    expect(secondThreadId).toMatch(/^codex-pending-/);
    expect(firstThreadId).not.toBe(secondThreadId);
    expect(startThread).toHaveBeenCalledTimes(2);
  });

  it("does not resurrect a pending thread deleted while the start was in flight", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    // The delete flow flips the loaded flag to false before finalize runs.
    loadedThreadsRef.current[pendingThreadId!] = false;
    dispatch.mockClear();

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "renameThreadId" }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "ensureThread" }),
    );
  });

  it("does not mint a retry backend thread for a deleted pending thread", async () => {
    vi.mocked(startThread)
      .mockRejectedValueOnce(new Error("runtime offline"))
      .mockResolvedValue({ result: { thread: { id: "thread-orphan" } } });

    const { result, loadedThreadsRef } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    // Delete lands after the failed prewarm but before finalize retries.
    loadedThreadsRef.current[pendingThreadId!] = false;

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBeNull();
    // Only the prewarm attempt reached the backend; the failure retry must
    // not create an orphan thread for a deleted pending session.
    expect(startThread).toHaveBeenCalledTimes(1);
  });

  it("replays the finalized id for late callers holding the pending id", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    await act(async () => {
      await result.current.finalizeCodexPendingThread("ws-1", pendingThreadId!);
    });

    // A caller that recorded the pending id (e.g. a kanban task) sends again
    // after the rename removed the loaded flag for the pending id.
    let replayedThreadId: string | null = null;
    await act(async () => {
      replayedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(replayedThreadId).toBe("thread-1");
    expect(startThread).toHaveBeenCalledTimes(1);
  });

  it("retries the backend start on finalize when the prewarm failed", async () => {
    vi.mocked(startThread)
      .mockRejectedValueOnce(new Error("codex exploded"))
      .mockResolvedValueOnce({ result: { thread: { id: "thread-retry" } } });

    const { result } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBe("thread-retry");
    expect(startThread).toHaveBeenCalledTimes(2);
  });

  it("does not reuse in-flight codex starts across provider profiles", async () => {
    vi.mocked(startThread)
      .mockResolvedValueOnce({ result: { thread: { id: "thread-provider-a" } } })
      .mockResolvedValueOnce({ result: { thread: { id: "thread-provider-b" } } });

    const { result } = renderActions();

    let firstThreadId: string | null = null;
    let secondThreadId: string | null = null;
    await act(async () => {
      firstThreadId = await result.current.startThreadForWorkspace("ws-1", {
        providerProfileId: "provider-a",
      });
      secondThreadId = await result.current.startThreadForWorkspace("ws-1", {
        providerProfileId: "provider-b",
      });
    });

    expect(firstThreadId).toBe("thread-provider-a");
    expect(secondThreadId).toBe("thread-provider-b");
    expect(startThread).toHaveBeenNthCalledWith(1, "ws-1", {
      providerProfileId: "provider-a",
    });
    expect(startThread).toHaveBeenNthCalledWith(2, "ws-1", {
      providerProfileId: "provider-b",
    });
  });

  it("keeps provider metadata on the optimistic codex thread summary", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-provider-a",
          providerProfileId: "provider-a",
          providerProfileSource: "managed",
          providerProfileName: "AskUs",
          providerAvailability: "available",
        },
      },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1", {
        providerProfileId: "provider-a",
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-provider-a",
      engine: "codex",
      providerProfileId: "provider-a",
      providerProfileSource: "managed",
      providerProfileName: "AskUs",
      providerAvailability: "available",
    });
  });

  it("uses selected provider metadata when codex start response only returns the thread id", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-provider-local" } },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1", {
        providerProfileId: "provider-local",
        providerProfile: {
          id: "provider-local",
          name: "老朱2号",
          source: "managed",
        },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-provider-local",
      engine: "codex",
      providerProfileId: "provider-local",
      providerProfileSource: "managed",
      providerProfileName: "老朱2号",
      providerAvailability: "available",
    });
  });

  it("reconnects workspace and retries inside the prewarmed codex start", async () => {
    vi.mocked(startThread)
      .mockRejectedValueOnce(new Error("workspace not connected"))
      .mockResolvedValueOnce({
        result: { thread: { id: "thread-retry" } },
      });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBe("thread-retry");
    expect(connectWorkspace).toHaveBeenCalledWith("ws-1");
    expect(startThread).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-retry",
      engine: "codex",
    });
    expect(loadedThreadsRef.current["thread-retry"]).toBe(true);
  });

  it("finalizes when start_thread returns result.threadId", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { threadId: "thread-1" },
    });

    const { result } = renderActions();

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBe("thread-1");
  });

  it("shows a runtime warning when codex hook-safe fallback creates the thread", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-fallback" } },
      ccguiHookSafeFallback: {
        mode: "session-hooks-disabled",
        reason: "invalid_thread_start_response",
        primaryFailureSummary: "invalid_thread_start_response: root_keys=[]",
      },
    });

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "thread-known",
            name: "Known old",
            updatedAt: 7000,
            engineSource: "codex",
          },
        ],
      },
      activeThreadIdByWorkspace: {
        "ws-1": "thread-known",
      },
    });

    let pendingThreadId: string | null = null;
    await act(async () => {
      pendingThreadId = await result.current.startThreadForWorkspace("ws-1");
    });
    expect(getGlobalRuntimeNoticesSnapshot()).toEqual([]);

    let finalizedThreadId: string | null = null;
    await act(async () => {
      finalizedThreadId = await result.current.finalizeCodexPendingThread(
        "ws-1",
        pendingThreadId!,
      );
    });

    expect(finalizedThreadId).toBe("thread-fallback");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fallback",
      engine: "codex",
    });
    expect(getGlobalRuntimeNoticesSnapshot()).toEqual([
      expect.objectContaining({
        severity: "warning",
        category: "runtime",
        messageKey: "runtimeNotice.runtime.codexSessionStartHookSkipped",
        messageParams: expect.objectContaining({
          reason: "invalid_thread_start_response",
        }),
      }),
    ]);
  });

  it("creates an optimistic DSH pending thread instead of falling back to Codex", async () => {
    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        engine: "dsh",
      });
    });

    expect(threadId).toMatch(/^dsh-pending-/);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        threadId,
        engine: "dsh",
      }),
    );
    expect(threadId ? loadedThreadsRef.current[threadId] : false).toBe(true);
    expect(startThread).not.toHaveBeenCalled();
  });
  it("creates an optimistic OMP pending thread instead of falling back to Codex", async () => {
    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        engine: "omp",
        providerProfileId: "__omp_local__",
      });
    });

    expect(threadId).toMatch(/^omp-pending-/);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        threadId,
        engine: "omp",
        providerProfileId: "__omp_local__",
        providerProfileSource: "disk",
      }),
    );
    expect(threadId ? loadedThreadsRef.current[threadId] : false).toBe(true);
    expect(startThread).not.toHaveBeenCalled();
  });

  it("allows opencode thread creation past the execution policy gate", async () => {
    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        engine: "opencode",
      });
    });

    expect(threadId).toEqual(expect.any(String));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        threadId,
      }),
    );
    expect(threadId ? loadedThreadsRef.current[threadId] : false).toBe(true);
  });

  it("creates a local pi-pending thread without waiting on the daemon", async () => {
    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        engine: "pi",
      });
    });

    expect(threadId).toMatch(/^pi-pending-/);
    expect(startThread).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        threadId,
        engine: "pi",
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId,
    });
    expect(threadId ? loadedThreadsRef.current[threadId] : false).toBe(true);
  });

  it("forks a thread and activates the fork", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-1" } },
    });
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          preview: "forked",
          turns: [{ id: "turn-fork-1", items: [] }],
        },
      },
    } as any);
    vi.mocked(buildItemsFromThread).mockReturnValue([
      {
        id: "fork-user-1",
        kind: "message",
        role: "user",
        text: "分叉后的可读上下文",
      },
    ]);

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace(
        "ws-1",
        "thread-1",
      );
    });

    expect(threadId).toBe("thread-fork-1");
    expect(forkThread).toHaveBeenCalledWith("ws-1", "thread-1", null, {
      providerProfileId: null,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
      engine: "codex",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
    });
    expect(loadedThreadsRef.current["thread-fork-1"]).toBe(true);
  });

  it("passes provider profile when forking a codex thread", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-provider" } },
    });

    const { result } = renderActions();

    await act(async () => {
      await result.current.forkThreadForWorkspace("ws-1", "thread-1", {
        providerProfileId: "provider-b",
      });
    });

    expect(forkThread).toHaveBeenCalledWith("ws-1", "thread-1", null, {
      providerProfileId: "provider-b",
    });
  });

  it("keeps selected provider metadata when forking a codex thread", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-local" } },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.forkThreadForWorkspace("ws-1", "thread-1", {
        providerProfileId: "provider-local",
        providerProfile: {
          id: "provider-local",
          name: "老朱2号",
          source: "managed",
        },
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fork-local",
      engine: "codex",
      providerProfileId: "provider-local",
      providerProfileSource: "managed",
      providerProfileName: "老朱2号",
      providerAvailability: "available",
    });
  });

  it("inherits the parent provider when forking a Claude thread", async () => {
    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "claude:session-parent",
            name: "Parent",
            updatedAt: 1,
            engineSource: "claude",
            providerProfileId: "provider-a",
            providerProfileSource: "managed",
            providerProfileName: "Provider A",
            providerAvailability: "available",
          },
        ],
      },
    });

    await act(async () => {
      await result.current.forkThreadForWorkspace(
        "ws-1",
        "claude:session-parent",
      );
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
        engine: "claude",
        providerProfileId: "provider-a",
        providerProfileSource: "managed",
        providerProfileName: "Provider A",
      }),
    );
  });

  it("forks a thread without activating when requested", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-2" } },
    });

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [
          {
            id: "thread-known",
            name: "Known old",
            updatedAt: 7000,
            engineSource: "codex",
          },
        ],
      },
      activeThreadIdByWorkspace: {
        "ws-1": "thread-known",
      },
    });

    await act(async () => {
      await result.current.forkThreadForWorkspace("ws-1", "thread-1", {
        activate: false,
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fork-2",
      engine: "codex",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setActiveThreadId",
        threadId: "thread-fork-2",
      }),
    );
  });

  it("starts a thread without activating when requested", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-2" } },
    });

    const { result, dispatch } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1", {
        activate: false,
      });
    });

    expect(threadId).toMatch(/^codex-pending-/);
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId,
      engine: "codex",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "setActiveThreadId" }),
    );
  });
});
