// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useThreadMessaging } from "./useThreadMessaging";
import { sendUserMessage } from "../../../services/tauri";
import { projectMemoryFacade } from "../../project-memory/services/projectMemoryFacade";
import * as memoryPickGateStore from "../../project-memory/memoryPick/memoryPickGateStore";
import {
  __resetMemoryPickGateStoreForTests,
  confirmMemoryPickGate,
  dismissMemoryPickGate,
  getMemoryPickGateSnapshot,
  setMemoryPickGateSelectedIds,
  skipMemoryPickGate,
} from "../../project-memory/memoryPick/memoryPickGateStore";
import {
  __resetMemoryPickSessionStoreForTests,
  getMemoryPickSessionPolicy,
  markMemoryPickFirstPickDone,
  resetMemoryPickSessionPolicy,
  setMemoryPickComposerMode,
} from "../../project-memory/memoryPick/memoryPickSessionStore";
import {
  setMemoryPickTelemetrySink,
} from "../../project-memory/memoryPick/memoryPickTelemetry";
import { pushErrorToast } from "../../../services/toasts";

vi.mock("@sentry/react", () => ({
  metrics: { count: vi.fn() },
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(() => "toast-1"),
}));

vi.mock("./useReviewPrompt", () => ({
  useReviewPrompt: () => ({
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
  }),
}));

vi.mock("../../../services/tauri", () => ({
  sendUserMessage: vi.fn(),
  startReview: vi.fn(),
  interruptTurn: vi.fn(),
  listMcpServerStatus: vi.fn(),
  engineSendMessage: vi.fn(),
  engineInterruptTurn: vi.fn(),
  engineInterrupt: vi.fn(),
  projectMemoryCaptureAuto: vi.fn(async () => null),
  listGeminiSessions: vi.fn(),
  listGrokSessions: vi.fn(),
  listKimiSessions: vi.fn(),
}));

vi.mock("../../project-memory/services/projectMemoryFacade", () => ({
  projectMemoryFacade: {
    list: vi.fn(),
    listSummary: vi.fn(),
    get: vi.fn(),
    captureTurnInput: vi.fn(async () => null),
  },
}));

vi.mock("../../note-cards/services/noteCardsFacade", () => ({
  noteCardsFacade: { get: vi.fn() },
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "ws",
  path: "/tmp/ws",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const THREAD = "thread-1";

function memoryItem(id: string, title: string, summary: string) {
  return {
    id,
    workspaceId: workspace.id,
    kind: "note",
    recordKind: "note",
    title,
    summary,
    detail: summary,
    cleanText: summary,
    rawText: summary,
    tags: ["tag"],
    importance: "high",
    source: "manual",
    fingerprint: id,
    createdAt: 1,
    updatedAt: 2,
  };
}

function buildHook() {
  const dispatch = vi.fn();
  const hook = renderHook(() =>
    useThreadMessaging({
      activeWorkspace: workspace,
      activeThreadId: THREAD,
      steerEnabled: false,
      customPrompts: [],
      activeEngine: "codex",
      threadStatusById: {},
      itemsByThread: {},
      activeTurnIdByThread: {},
      codexAcceptedTurnByThread: {},
      tokenUsageByThread: {},
      rateLimitsByWorkspace: {},
      pendingInterruptsRef: { current: new Map() },
      interruptedThreadsRef: { current: new Map() },
      dispatch,
      getCustomName: vi.fn(),
      getThreadEngine: vi.fn(() => "codex" as const),
      markProcessing: vi.fn(),
      markReviewing: vi.fn(),
      setActiveTurnId: vi.fn(),
      recordThreadActivity: vi.fn(),
      safeMessageActivity: vi.fn(),
      onDebug: vi.fn(),
      pushThreadErrorMessage: vi.fn(),
      ensureThreadForActiveWorkspace: vi.fn(),
      ensureThreadForWorkspace: vi.fn(),
      refreshThread: vi.fn(),
      forkThreadForWorkspace: vi.fn(),
      updateThreadParent: vi.fn(),
      startThreadForWorkspace: vi.fn(),
      onInputMemoryCaptured: vi.fn(),
    }),
  );
  return { ...hook, dispatch };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  __resetMemoryPickGateStoreForTests();
  __resetMemoryPickSessionStoreForTests();
  resetMemoryPickSessionPolicy(workspace.id, THREAD, "off");
  vi.mocked(sendUserMessage).mockResolvedValue({
    result: { turn: { id: "turn-1" } },
  } as never);
  vi.mocked(projectMemoryFacade.listSummary).mockResolvedValue({
    items: [
      memoryItem("m-db", "数据库连接池", "超时与连接上限"),
      memoryItem("m-ui", "UI 主题", "暗色模式"),
      memoryItem("m-idx", "数据库索引", "慢查询"),
    ],
    total: 3,
  } as never);
  vi.mocked(projectMemoryFacade.get).mockImplementation(async (id: string) => {
    const map: Record<string, ReturnType<typeof memoryItem>> = {
      "m-db": memoryItem("m-db", "数据库连接池", "超时与连接上限"),
      "m-ui": memoryItem("m-ui", "UI 主题", "暗色模式"),
      "m-idx": memoryItem("m-idx", "数据库索引", "慢查询"),
    };
    return (map[id] ?? null) as never;
  });
});

afterEach(() => {
  __resetMemoryPickGateStoreForTests();
  __resetMemoryPickSessionStoreForTests();
});

describe("useThreadMessaging memory pick gate", () => {
  it("pick mode blocks send until confirm, then injects memory-pick pack", async () => {
    const { result } = buildHook();

    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时怎么办",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    expect(sendUserMessage).not.toHaveBeenCalled();

    setMemoryPickGateSelectedIds(workspace.id, THREAD, ["m-db"]);
    confirmMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await sendPromise;
    });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toContain('source="memory-pick"');
    expect(textArg).toContain("数据库连接池");
    expect(textArg).toContain("数据库 超时怎么办");
    expect(textArg).toContain("Primary task");
    expect(
      getMemoryPickSessionPolicy(workspace.id, THREAD).firstPickRequired,
    ).toBe(false);
  });

  it("off mode never opens gate even when firstPickRequired (opt-in default)", async () => {
    // 默认 firstPickRequired=true，但 mode=off 时不得强弹
    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "默认关闭记忆参考",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe(
      "默认关闭记忆参考",
    );
  });

  it("pick mode skip sends plain text without memory-pick pack", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");

    const { result } = buildHook();
    let sendPromise!: Promise<unknown>;
    act(() => {
      sendPromise = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时 怎么办",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    skipMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await sendPromise;
    });

    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toBe("数据库 超时 怎么办");
    expect(textArg).not.toContain("memory-pick");
  });

  it("after pick-mode skip, next send with pick still opens gate; off does not", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");

    const { result } = buildHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 超时",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });
    await vi.waitFor(
      () => {
        expect(getMemoryPickGateSnapshot(workspace.id, THREAD)?.phase).toBe(
          "awaiting-choice",
        );
      },
      { timeout: 3000 },
    );
    skipMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await first;
    });
    expect(getMemoryPickSessionPolicy(workspace.id, THREAD).composerMode).toBe(
      "pick",
    );

    // 用户关掉记忆参考后，下一轮不得再弹
    vi.mocked(sendUserMessage).mockClear();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库 索引 优化",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });
    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe(
      "数据库 索引 优化",
    );
  });

  it("dismiss suppresses later gates in the same session", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");

    const { result } = buildHook();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "第一次",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });
    await vi.waitFor(() => {
      expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeTruthy();
    });
    dismissMemoryPickGate(workspace.id, THREAD);
    await act(async () => {
      await first;
    });
    expect(getMemoryPickSessionPolicy(workspace.id, THREAD).dismissed).toBe(
      true,
    );

    vi.mocked(sendUserMessage).mockClear();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "第二次应跳过闸门",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });
    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe(
      "第二次应跳过闸门",
    );
  });

  it("always mode opens pick gate (not silent) after first pick", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "always");
    const openSpy = vi
      .spyOn(memoryPickGateStore, "openMemoryPickGate")
      .mockResolvedValue({
        action: "confirm",
        selectedIds: ["m-db", "m-idx", "m-ui"],
        mode: "always",
      });

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库连接池 超时",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "always" },
      );
    });

    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls[0]?.[0]?.mode).toBe("always");
    expect(openSpy.mock.calls[0]?.[0]?.firstPick).toBe(false);
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toContain('source="memory-pick"');
    openSpy.mockRestore();
  });

  it("empty memory list auto-passes without pick UI", async () => {
    vi.mocked(projectMemoryFacade.listSummary).mockResolvedValue({
      items: [],
      total: 0,
    } as never);

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "无记忆时直发",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe("无记忆时直发");
  });

  it("off mode without first pick does not open gate", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "off");

    const { result } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "plain",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "off" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe("plain");
  });

  it("no_match empty result posts timeline notice and still sends without blocking", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");
    // 有库但与 query 无关 → no_match auto-skip
    vi.mocked(projectMemoryFacade.listSummary).mockResolvedValue({
      items: [memoryItem("m-ui", "UI 主题", "暗色模式")],
      total: 1,
    } as never);

    const events: Array<{ event: string; props: Record<string, unknown> }> = [];
    setMemoryPickTelemetrySink((event, props) => {
      events.push({ event, props });
    });

    const { result, dispatch } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "数据库连接池 超时怎么办",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    expect(getMemoryPickGateSnapshot(workspace.id, THREAD)).toBeNull();
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendUserMessage).mock.calls[0]?.[2]).toBe(
      "数据库连接池 超时怎么办",
    );
    // 不再弹全局 toast
    expect(pushErrorToast).not.toHaveBeenCalled();
    // 主幕时间线：【记忆参考状态】轻量 status（非旧摘要卡）
    const emptyNotices = vi
      .mocked(dispatch)
      .mock.calls.map((call) => call[0] as { type?: string; item?: { text?: string } })
      .filter(
        (action) =>
          action?.type === "upsertItem" &&
          typeof action.item?.text === "string" &&
          action.item.text.includes("【记忆参考状态】") &&
          action.item.text.includes("未找到"),
      );
    expect(emptyNotices.length).toBeGreaterThan(0);
    const retrieveEvents = events.filter(
      (e) => e.event === "memory_pick_retrieve",
    );
    expect(retrieveEvents.length).toBeGreaterThan(0);
    expect(retrieveEvents[0]?.props.emptyReason).toBe("no_match");
    setMemoryPickTelemetrySink(null);
  });

  it("timeout empty result posts timeline notice and still sends", async () => {
    markMemoryPickFirstPickDone(workspace.id, THREAD);
    setMemoryPickComposerMode(workspace.id, THREAD, "pick");
    // list 抛 memory-pick-timeout → kernel emptyReason timeout
    vi.mocked(projectMemoryFacade.listSummary).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          window.setTimeout(
            () => reject(new Error("memory-pick-timeout")),
            5,
          );
        }) as never,
    );

    const { result, dispatch } = buildHook();
    await act(async () => {
      await result.current.sendUserMessageToThread(
        workspace,
        THREAD,
        "anything related query",
        [],
        { skipPromptExpansion: true, memoryReferenceMode: "pick" },
      );
    });

    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(pushErrorToast).not.toHaveBeenCalled();
    const textArg = vi.mocked(sendUserMessage).mock.calls[0]?.[2] as string;
    expect(textArg).toBe("anything related query");
    const emptyNotices = vi
      .mocked(dispatch)
      .mock.calls.map((call) => call[0] as { type?: string; item?: { text?: string } })
      .filter(
        (action) =>
          action?.type === "upsertItem" &&
          typeof action.item?.text === "string" &&
          action.item.text.includes("【记忆参考状态】"),
      );
    expect(emptyNotices.length).toBeGreaterThan(0);
  });
});
