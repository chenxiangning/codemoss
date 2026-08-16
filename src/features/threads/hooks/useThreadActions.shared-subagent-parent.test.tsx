// @vitest-environment jsdom
/**
 * 集成测（边界）：Shared × Codex 子代理 parent-id 改挂。
 *
 * 只验证 listThreadsForWorkspace 主路径：
 * - 有 authoritative parent 且命中 Shared hidden owner → parentThreadId = shared:
 * - 未命中 owner / 无 parent → 不改
 * - 改挂不是 hide（子代理行仍在列表）
 *
 * 不测：无 parent 猜测、MOSSX hide、catalog 无 parent 的后端洞。
 */
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { listThreads } from "../../../services/tauri";
import { getThreadTimestamp } from "../../../utils/threadItems";
import { listSharedSessions } from "@mossx/plugin-shared-session/runtime";
import { renderActions, workspace } from "./useThreadActions.test-utils";

vi.mock("../../../services/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/tauri")>();
  return {
    ...actual,
    listThreads: vi.fn(),
    listThreadTitles: vi.fn(async () => ({})),
    listClaudeSessions: vi.fn(async () => []),
    listGeminiSessions: vi.fn(async () => []),
    listGrokSessions: vi.fn(async () => []),
    listKimiSessions: vi.fn(async () => []),
    listPiSessions: vi.fn(async () => []),
    getOpenCodeSessionList: vi.fn(async () => []),
    listWorkspaceSessions: vi.fn(async () => ({
      data: [],
      nextCursor: null,
      partialSource: null,
    })),
    listWorkspaceSessionArchiveEvidence: vi.fn(async () => ({
      archivedAtBySessionId: {},
      partialSource: null,
      sourceStatuses: [],
    })),
    connectWorkspace: vi.fn(async () => undefined),
    renameThreadTitleKey: vi.fn(async () => undefined),
    setThreadTitle: vi.fn(async () => "title"),
  };
});

vi.mock("../../shared-session/services/sharedSessions", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../shared-session/services/sharedSessions")
    >();
  return {
    ...actual,
    listSharedSessions: vi.fn(async () => []),
  };
});

vi.mock("../../../utils/threadItems", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../utils/threadItems")>();
  return {
    ...actual,
    getThreadTimestamp: vi.fn(),
    previewThreadName: vi.fn((text: string, fallback: string) => {
      const trimmed = text.trim();
      return trimmed || fallback;
    }),
    mergeThreadItems: vi.fn((primary: ConversationItem[]) => primary),
  };
});

vi.mock("../utils/threadStorage", () => ({
  makeCustomNameKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
  saveThreadActivity: vi.fn(),
}));

vi.mock("../utils/sidebarSnapshot", () => ({
  loadSidebarSnapshot: vi.fn(() => null),
}));

const SHARED_THREAD_ID = "shared:shared-codex-1";
const HIDDEN_OWNER_RAW = "parent-codex-owner";
const HIDDEN_OWNER_PREFIXED = `codex:${HIDDEN_OWNER_RAW}`;

describe("useThreadActions Shared subagent parent attach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listSharedSessions).mockResolvedValue([
      {
        id: "shared-codex-1",
        threadId: SHARED_THREAD_ID,
        title: "Shared Codex Session",
        updatedAt: 10_000,
        selectedEngine: "codex",
        // binding 用 engine: 前缀；子代理 parent 用 raw —— 本 change 主缺口
        nativeThreadIds: [HIDDEN_OWNER_PREFIXED],
      },
    ] as never);
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });
  });

  it("remaps codex subagent parent from hidden native owner onto shared (raw vs codex: shape)", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "child-archimedes",
            cwd: "/tmp/codex",
            preview: "geometry",
            updated_at: 9000,
            parentThreadId: HIDDEN_OWNER_RAW,
            agentNickname: "Archimedes",
            source: {
              subagent: {
                thread_spawn: {
                  parent_thread_id: HIDDEN_OWNER_RAW,
                  depth: 1,
                  agent_nickname: "Archimedes",
                },
              },
            },
          },
          {
            id: "child-native-nest",
            cwd: "/tmp/codex",
            preview: "other",
            updated_at: 8000,
            // 边界：parent 不是 Shared owner → 禁止改挂
            parentThreadId: "codex:visible-native-parent",
            agentNickname: "NativeNest",
            source: {
              subagent: {
                thread_spawn: {
                  parent_thread_id: "codex:visible-native-parent",
                  depth: 1,
                  agent_nickname: "NativeNest",
                },
              },
            },
          },
          {
            id: "top-level-no-parent",
            cwd: "/tmp/codex",
            preview: "solo",
            updated_at: 7000,
            // 边界：无 parent → 禁止推断
          },
        ],
        nextCursor: null,
      },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listSharedSessions).toHaveBeenCalledWith(workspace.id);

    const setThreadsCall = dispatch.mock.calls.find(
      (call) =>
        call[0] &&
        typeof call[0] === "object" &&
        (call[0] as { type?: string }).type === "setThreads" &&
        (call[0] as { workspaceId?: string }).workspaceId === "ws-1",
    );
    expect(setThreadsCall).toBeDefined();
    const threads = (
      setThreadsCall![0] as {
        threads: Array<{
          id: string;
          name?: string;
          engineSource?: string;
          threadKind?: string;
          parentThreadId?: string | null;
        }>;
      }
    ).threads;

    expect(threads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: SHARED_THREAD_ID,
          threadKind: "shared",
        }),
      ]),
    );

    // 命中：raw parent + codex: binding → shared:
    expect(threads.find((row) => row.id === "child-archimedes")).toMatchObject({
      name: "Archimedes",
      engineSource: "codex",
      parentThreadId: SHARED_THREAD_ID,
    });

    // 未命中：保持原 parent
    expect(
      threads.find((row) => row.id === "child-native-nest")?.parentThreadId,
    ).toBe("codex:visible-native-parent");

    // 无 parent：不得写成 shared:
    const solo = threads.find((row) => row.id === "top-level-no-parent");
    expect(solo).toBeDefined();
    expect(solo?.parentThreadId ?? null).toBeNull();

    // 改挂 ≠ hide：子代理仍在列表
    expect(threads.some((row) => row.id === "child-archimedes")).toBe(true);
  });
});
