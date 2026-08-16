// @vitest-environment jsdom
// fix-shared-session-identity-id-first：getThreadKind id-first 回归。
// send 路径 resolveThreadKind 直接代理 getThreadKind（useThreadMessagingThreadResolution），
// delete 清理（useThreads.removeThread）共用同一解析，故在此单点锁定。
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { loadClaudeSession } from "../../../services/tauri";
import { writeClientStoreData } from "../../../services/clientStorage";
import type { useAppServerEvents } from "../../app/hooks/useAppServerEvents";
import { useThreads } from "./useThreads";
import { clearSharedSessionBindingsForSharedThread } from "@mossx/plugin-shared-session/runtime";
import { deleteSharedSession } from "@mossx/plugin-shared-session/runtime";

type AppServerHandlers = Parameters<typeof useAppServerEvents>[0];

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (_incoming: AppServerHandlers) => {},
}));

vi.mock("./useThreadRateLimits", () => ({
  useThreadRateLimits: () => ({
    refreshAccountRateLimits: vi.fn(),
  }),
}));

vi.mock("./useThreadAccountInfo", () => ({
  useThreadAccountInfo: () => ({
    refreshAccountInfo: vi.fn(),
  }),
}));

vi.mock("../../shared-session/runtime/sharedSessionBridge", () => ({
  clearSharedSessionBindingsForSharedThread: vi.fn(),
}));

vi.mock("../../shared-session/services/sharedSessions", () => ({
  deleteSharedSession: vi.fn().mockResolvedValue(undefined),
  syncSharedSessionSnapshot: vi.fn(),
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
  loadClaudeSession: vi.fn(),
  resumeThread: vi.fn(),
  archiveThread: vi.fn(),
  deleteCodexSessions: vi.fn(),
  deleteOpenCodeSession: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAccountInfo: vi.fn(),
  interruptTurn: vi.fn(),
  approveToolCall: vi.fn(),
  denyToolCall: vi.fn(),
  executeSlashCommand: vi.fn(),
  branchWorkspace: vi.fn(),
  startMcpSession: vi.fn(),
  startSpecRootSession: vi.fn(),
  startStatusSession: vi.fn(),
  startContextSession: vi.fn(),
  startFastSession: vi.fn(),
  startModeSession: vi.fn(),
  startExportSession: vi.fn(),
  startImportSession: vi.fn(),
  startLspSession: vi.fn(),
  startShareSession: vi.fn(),
  listWorkspaceSessions: vi.fn().mockResolvedValue({
    data: [],
    nextCursor: null,
    partialSource: null,
  }),
  listWorkspacePlugins: vi.fn(),
  addWorkspacePlugin: vi.fn(),
  removeWorkspacePlugin: vi.fn(),
  listWorkspaceProviderProfiles: vi.fn(),
  saveWorkspaceProviderProfile: vi.fn(),
  removeWorkspaceProviderProfile: vi.fn(),
  saveWorkspaceProviderSelection: vi.fn(),
  listWorkspaceOpenCodeAgents: vi.fn(),
  projectMemoryUpdate: vi.fn(),
  projectMemoryCreate: vi.fn(),
  connectWorkspace: vi.fn(),
  listGeminiSessions: vi.fn().mockResolvedValue([]),
  listGrokSessions: vi.fn().mockResolvedValue([]),
  listKimiSessions: vi.fn().mockResolvedValue([]),
  listPiSessions: vi.fn().mockResolvedValue([]),
  listClaudeSessions: vi.fn().mockResolvedValue([]),
  getOpenCodeSessionList: vi.fn().mockResolvedValue([]),
  getEmailInboundListenerStatus: vi.fn().mockResolvedValue({
    enabled: false,
    readOnly: true,
    connectionState: "disabled",
    lastCheckedAt: null,
    nextCheckAt: null,
    acceptedCount: 0,
    queuedCount: 0,
    needsConfirmationCount: 0,
    rejectedCount: 0,
    ignoredCount: 0,
    pollingIntervalSeconds: 300,
  }),
  checkEmailInbox: vi.fn(),
  claimNextEmailMailCommand: vi.fn().mockResolvedValue({ command: null }),
  completeEmailMailCommand: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "ccgui",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useThreads thread kind identity (id-first)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeClientStoreData("threads", {});
    vi.mocked(loadClaudeSession).mockResolvedValue({ messages: [] });
  });

  it("returns shared for shared: ids even when the summary is missing", () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.getThreadKind("ws-1", "shared:no-summary")).toBe(
      "shared",
    );
  });

  it("returns shared for shared: ids even when threadKind projection is lost", () => {
    writeClientStoreData("threads", {
      sidebarSnapshot: {
        version: 1,
        updatedAt: 1,
        workspaces: [workspace],
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "shared:degraded",
              name: "Shared Session",
              updatedAt: 1,
              threadKind: "native",
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.getThreadKind("ws-1", "shared:degraded")).toBe(
      "shared",
    );
  });

  it("still defaults to native for non-shared ids without a summary", () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.getThreadKind("ws-1", "claude:session-1")).toBe(
      "native",
    );
  });

  it("clears shared bindings on delete even when threadKind projection is lost", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.removeThread("ws-1", "shared:delete-me");
    });

    expect(deleteSharedSession).toHaveBeenCalledWith(
      "ws-1",
      "shared:delete-me",
    );
    expect(clearSharedSessionBindingsForSharedThread).toHaveBeenCalledWith(
      "ws-1",
      "shared:delete-me",
    );
  });
});

// fix-shared-session-target-race-and-merge T5：
// merge 场景中 shared: id 条目 threadKind 不受 incoming truthy 覆盖。
describe("useThreads merge thread kind guard (T5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writeClientStoreData("threads", {});
    vi.mocked(loadClaudeSession).mockResolvedValue({ messages: [] });
  });

  it("getThreadKind returns shared when both id prefix and summary kind are present", () => {
    writeClientStoreData("threads", {
      sidebarSnapshot: {
        version: 1,
        updatedAt: 1,
        workspaces: [workspace],
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "shared:safe",
              name: "Shared Session",
              updatedAt: 1,
              threadKind: "shared",
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.getThreadKind("ws-1", "shared:safe")).toBe("shared");
  });

  it("getThreadKind returns shared even when summary kind is native (merge corruption scenario)", () => {
    writeClientStoreData("threads", {
      sidebarSnapshot: {
        version: 1,
        updatedAt: 1,
        workspaces: [workspace],
        threadsByWorkspace: {
          "ws-1": [
            {
              id: "shared:corrupted",
              name: "Shared Session",
              updatedAt: 1,
              threadKind: "native", // 被 merge 污染
            },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    // id-first 硬闸兜底：即使 summary 被污染为 native，id 前缀仍返回 shared
    expect(
      result.current.getThreadKind("ws-1", "shared:corrupted"),
    ).toBe("shared");
  });

  it("getThreadKind still defaults to native for non-shared ids", () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: workspace,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    expect(result.current.getThreadKind("ws-1", "claude:normal")).toBe("native");
    expect(result.current.getThreadKind("ws-1", "codex:normal")).toBe("native");
  });
});
