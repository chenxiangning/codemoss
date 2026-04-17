// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import type { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { useThreads } from "./useThreads";

type AppServerHandlers = Parameters<typeof useAppServerEvents>[0];

let handlers: AppServerHandlers | null = null;

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (incoming: AppServerHandlers) => {
    handlers = incoming;
  },
}));

vi.mock("./useThreadMessaging", () => ({
  useThreadMessaging: () => ({
    interruptTurn: vi.fn(),
    sendUserMessage: vi.fn(),
    sendUserMessageToThread: vi.fn(),
    startFork: vi.fn(),
    startReview: vi.fn(),
    startResume: vi.fn(),
    startMcp: vi.fn(),
    startSpecRoot: vi.fn(),
    startStatus: vi.fn(),
    startContext: vi.fn(),
    startFast: vi.fn(),
    startMode: vi.fn(),
    startExport: vi.fn(),
    startImport: vi.fn(),
    startLsp: vi.fn(),
    startShare: vi.fn(),
    reviewPrompt: null,
    openReviewPrompt: vi.fn(),
    closeReviewPrompt: vi.fn(),
    showPresetStep: false,
    choosePreset: vi.fn(),
    highlightedPresetIndex: -1,
    setHighlightedPresetIndex: vi.fn(),
    highlightedBranchIndex: -1,
    setHighlightedBranchIndex: vi.fn(),
    highlightedCommitIndex: -1,
    setHighlightedCommitIndex: vi.fn(),
    handleReviewPromptKeyDown: vi.fn(),
    confirmBranch: vi.fn(),
    selectBranch: vi.fn(),
    selectBranchAtIndex: vi.fn(),
    selectCommit: vi.fn(),
    selectCommitAtIndex: vi.fn(),
    confirmCommit: vi.fn(),
    updateCustomInstructions: vi.fn(),
    confirmCustom: vi.fn(),
  }),
}));

vi.mock("../../../services/tauri", () => ({
  respondToServerRequest: vi.fn(),
  respondToUserInputRequest: vi.fn(),
  listThreadTitles: vi.fn(),
  setThreadTitle: vi.fn(),
  renameThreadTitleKey: vi.fn(),
  generateThreadTitle: vi.fn(),
  rememberApprovalRule: vi.fn(),
  sendUserMessage: vi.fn(),
  startReview: vi.fn(),
  startThread: vi.fn(),
  listThreads: vi.fn(),
  resumeThread: vi.fn(),
  archiveThread: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAccountInfo: vi.fn(),
  interruptTurn: vi.fn(),
  projectMemoryUpdate: vi.fn(),
  projectMemoryCreate: vi.fn(),
}));

vi.mock("../../shared-session/services/sharedSessions", () => ({
  startSharedSession: vi.fn(async () => ({})),
  sendSharedSessionMessage: vi.fn(async () => ({})),
  listSharedSessions: vi.fn(async () => []),
  loadSharedSession: vi.fn(async () => null),
  setSharedSessionSelectedEngine: vi.fn(async () => ({})),
  updateSharedSessionNativeBinding: vi.fn(async () => ({})),
  syncSharedSessionSnapshot: vi.fn(async () => ({})),
  deleteSharedSession: vi.fn(async () => ({})),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "ccgui",
  path: "/tmp/codemoss",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useThreads missing terminal fallback", () => {
  beforeEach(() => {
    handlers = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles processing when assistant completed but turn terminal never arrives", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        activeEngine: "codex",
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(handlers).not.toBeNull();

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "thread-1", "turn-1");
    });

    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    expect(result.current.activeTurnIdByThread["thread-1"]).toBe("turn-1");

    act(() => {
      handlers?.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        text: "Done",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(result.current.threadStatusById["thread-1"]?.isProcessing).toBe(false);
    expect(result.current.activeTurnIdByThread["thread-1"]).toBeNull();
  });

  it("does not settle while heartbeat continues after assistant completion", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        activeEngine: "codex",
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(handlers).not.toBeNull();

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "thread-2", "turn-2");
    });

    act(() => {
      handlers?.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-2",
        itemId: "assistant-2",
        text: "Still working",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });

    act(() => {
      handlers?.onProcessingHeartbeat?.("ws-1", "thread-2", 1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(result.current.threadStatusById["thread-2"]?.isProcessing).toBe(true);
    expect(result.current.activeTurnIdByThread["thread-2"]).toBe("turn-2");
  });

  it("keeps fallback effective after pending thread is rebound to finalized session id", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        activeEngine: "claude",
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(handlers).not.toBeNull();

    act(() => {
      handlers?.onTurnStarted?.("ws-1", "claude-pending-1", "turn-3");
    });

    act(() => {
      handlers?.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "claude-pending-1",
        itemId: "assistant-3",
        text: "Done after rebind",
      });
    });

    act(() => {
      handlers?.onThreadSessionIdUpdated?.(
        "ws-1",
        "claude-pending-1",
        "session-3",
        "claude",
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_500);
    });

    expect(result.current.threadStatusById["claude:session-3"]?.isProcessing).toBe(false);
    expect(result.current.activeTurnIdByThread["claude:session-3"]).toBeNull();
  });
});
