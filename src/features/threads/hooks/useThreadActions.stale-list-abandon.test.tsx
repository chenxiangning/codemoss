// @vitest-environment jsdom
/**
 * Runtime workspace-switch: soft-ignore cancel must cooperatively abandon
 * listThreadsForWorkspace so orphan bodies do not fan out more IPC / setThreads.
 * OpenSpec: fix-runtime-workspace-switch-main-thread-stall
 */
import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  connectWorkspace,
  createWorkspaceDirectory,
  getOpenCodeSessionList,
  listClaudeSessions,
  listGeminiSessions,
  listGrokSessions,
  listKimiSessions,
  listPiSessions,
  listThreadTitles,
  listSessionIndexForWorkspace,
  listThreads,
  listWorkspaceSessions,
  listWorkspaceSessionArchiveEvidence,
  renameThreadTitleKey,
  setThreadTitle,
} from "../../../services/tauri";
import { listSharedSessions } from "../../shared-session/services/sharedSessions";
import {
  getThreadTimestamp,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import { clearGlobalRuntimeNotices } from "../../../services/globalRuntimeNotices";
import { loadSidebarSnapshot } from "../utils/sidebarSnapshot";
import { renderActions, workspace } from "./useThreadActions.test-utils";

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
  listPiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  getOpenCodeSessionList: vi.fn(),
  listWorkspaceSessions: vi.fn(),
  listWorkspaceSessionArchiveEvidence: vi.fn(),
  listSessionIndexForWorkspace: vi.fn(async () => ({
    data: [],
    source: "session-index",
    synced: false,
    engines: [],
  })),
  syncSessionIndexForWorkspace: vi.fn(async () => ({
    upserted: 0,
    engines: [],
    durationMs: 0,
    skippedFresh: true,
  })),
  loadClaudeSession: vi.fn(),
  loadGeminiSession: vi.fn(),
  loadCodexSession: vi.fn(),
  listThreadTitles: vi.fn(),
  readWorkspaceFile: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  setThreadTitle: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSession: vi.fn(),
  deleteClaudeSession: vi.fn(),
  deleteGeminiSession: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  trashWorkspaceItem: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

vi.mock("../../shared-session/services/sharedSessions", () => ({
  listSharedSessions: vi.fn(async () => []),
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function countSetThreads(dispatch: ReturnType<typeof vi.fn>) {
  return dispatch.mock.calls.filter(
    (call) => call[0] && call[0].type === "setThreads",
  ).length;
}

describe("useThreadActions list stale abandon (runtime workspace switch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(listSharedSessions).mockResolvedValue([]);
    vi.mocked(listClaudeSessions).mockResolvedValue([]);
    vi.mocked(listGeminiSessions).mockResolvedValue([]);
    vi.mocked(listKimiSessions).mockResolvedValue([]);
    vi.mocked(listPiSessions).mockResolvedValue([]);
    vi.mocked(listGrokSessions).mockResolvedValue([]);
    vi.mocked(getOpenCodeSessionList).mockResolvedValue([]);
    vi.mocked(listWorkspaceSessions).mockResolvedValue({
      data: [],
      nextCursor: null,
      partialSource: null,
    });
    vi.mocked(listWorkspaceSessionArchiveEvidence).mockResolvedValue({
      archivedAtBySessionId: {},
      partialSource: null,
      sourceStatuses: [],
    });
    vi.mocked(listThreads).mockResolvedValue({
      result: { data: [], nextCursor: null },
    } as never);
    vi.mocked(renameThreadTitleKey).mockResolvedValue(undefined);
    vi.mocked(setThreadTitle).mockResolvedValue("title");
    vi.mocked(connectWorkspace).mockResolvedValue(undefined);
    vi.mocked(createWorkspaceDirectory).mockResolvedValue(undefined);
    vi.mocked(previewThreadName).mockImplementation(
      (text: string, fallback: string) => {
        const trimmed = (text ?? "").trim();
        return trimmed || fallback;
      },
    );
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as
        | number
        | undefined;
      return value ?? 0;
    });
    vi.mocked(loadSidebarSnapshot).mockReturnValue(null);
    vi.mocked(mergeThreadItems).mockImplementation(
      (primaryItems: ConversationItem[]) => primaryItems,
    );
    clearGlobalRuntimeNotices();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("abandons after titles when isStale flips: no listThreads / catalog / setThreads", async () => {
    const titlesGate = createDeferred<Record<string, string>>();
    let stale = false;
    vi.mocked(listThreadTitles).mockImplementation(
      () => titlesGate.promise as Promise<Record<string, string>>,
    );

    const { result, dispatch } = renderActions();
    const runPromise = result.current.listThreadsForWorkspace(workspace, {
      preserveState: true,
      startupHydrationMode: "full-catalog",
      isStale: () => stale,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(listThreadTitles).toHaveBeenCalledTimes(1);
    expect(listSharedSessions).not.toHaveBeenCalled();
    expect(listThreads).not.toHaveBeenCalled();

    // Simulate workspace switch cancel while titles IPC is in flight.
    stale = true;
    titlesGate.resolve({});

    const outcome = await act(async () => runPromise);

    expect(outcome).toEqual({ applied: false, stale: true });
    expect(listSharedSessions).not.toHaveBeenCalled();
    expect(listThreads).not.toHaveBeenCalled();
    expect(listWorkspaceSessions).not.toHaveBeenCalled();
    expect(getOpenCodeSessionList).not.toHaveBeenCalled();
    expect(listClaudeSessions).not.toHaveBeenCalled();
    expect(listGeminiSessions).not.toHaveBeenCalled();
    expect(countSetThreads(dispatch)).toBe(0);
  });

  it("abandons between shared and codex paging when isStale flips after shared", async () => {
    const sharedGate = createDeferred<unknown[]>();
    let stale = false;
    vi.mocked(listThreadTitles).mockResolvedValue({});
    vi.mocked(listSharedSessions).mockImplementation(
      () => sharedGate.promise as Promise<never[]>,
    );

    const { result, dispatch } = renderActions();
    const runPromise = result.current.listThreadsForWorkspace(workspace, {
      preserveState: true,
      startupHydrationMode: "first-paint",
      isStale: () => stale,
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(listSharedSessions).toHaveBeenCalledTimes(1);
    expect(listThreads).not.toHaveBeenCalled();

    stale = true;
    sharedGate.resolve([]);

    const outcome = await act(async () => runPromise);

    expect(outcome).toEqual({ applied: false, stale: true });
    expect(listThreads).not.toHaveBeenCalled();
    expect(countSetThreads(dispatch)).toBe(0);
  });

  it("still applies setThreads when isStale stays false", async () => {
    vi.mocked(listThreadTitles).mockResolvedValue({});
    vi.mocked(listSharedSessions).mockResolvedValue([]);
    vi.mocked(listSessionIndexForWorkspace).mockResolvedValue({
      data: [
        {
          engine: "codex",
          sessionId: "thread-keep",
          title: "hello",
          updatedAt: 1000,
        },
      ],
      source: "session-index",
      synced: false,
      engines: ["codex"],
      visibility: { available: true, freshness: "verified", hiddenNativeIds: [] },
    });

    const { result, dispatch } = renderActions();
    const outcome = await act(async () =>
      result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "first-paint",
        isStale: () => false,
      }),
    );

    // first-paint may return void or applied shape depending on path
    expect(outcome === undefined || (outcome as { applied?: boolean }).applied !== false).toBe(
      true,
    );
    expect(listThreads).not.toHaveBeenCalled();
    // setThreads is startTransition; flush microtasks/macrotasks
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(countSetThreads(dispatch)).toBeGreaterThan(0);
  });

  it("first-paint does not call engine disk lists", async () => {
    vi.mocked(listThreadTitles).mockResolvedValue({});
    const { result } = renderActions();
    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
        startupHydrationMode: "first-paint",
      });
    });
    expect(listGeminiSessions).not.toHaveBeenCalled();
    expect(listGrokSessions).not.toHaveBeenCalled();
    expect(listKimiSessions).not.toHaveBeenCalled();
    expect(listClaudeSessions).not.toHaveBeenCalled();
    expect(getOpenCodeSessionList).not.toHaveBeenCalled();
    expect(listWorkspaceSessions).not.toHaveBeenCalled();
    expect(listThreads).not.toHaveBeenCalled();
  });

  it("default listThreadsForWorkspace does not call Gemini/Grok/Kimi disk lists", async () => {
    vi.mocked(listThreadTitles).mockResolvedValue({});
    const { result } = renderActions();
    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
      });
    });
    expect(listGeminiSessions).not.toHaveBeenCalled();
    expect(listGrokSessions).not.toHaveBeenCalled();
    expect(listKimiSessions).not.toHaveBeenCalled();
  });
});
