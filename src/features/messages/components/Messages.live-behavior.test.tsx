// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import type { ConversationState } from "../../threads/contracts/conversationCurtainContracts";
import { MESSAGES_LIVE_CONTROLS_UPDATED_EVENT } from "../../../live-canvas/liveCanvasControls";
import { Messages } from "./Messages";

vi.mock("./Markdown", () => ({
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
}));

// History collapsing ships effectively disabled in production (window = 10000).
// These behavior tests exercise the collapse/expand logic at its original
// threshold; only the three >30-item cases below are affected.
vi.mock("../utils/messagesRenderUtils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/messagesRenderUtils")>();
  return {
    ...actual,
    VISIBLE_MESSAGE_WINDOW: 30,
  };
});

// jsdom never lays anything out, so its ResizeObserver mock never fires. Messages
// drives bottom-follow off content-height changes, so tests need to fire it by hand.
const resizeObserverCallbacks: Array<() => void> = [];
const notifyContentResized = () => {
  act(() => {
    for (const callback of [...resizeObserverCallbacks]) {
      callback();
    }
  });
};

describe("Messages live behavior", () => {
  afterEach(() => {
    cleanup();
    resizeObserverCallbacks.length = 0;
  });

  beforeEach(() => {
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.setItem("ccgui.messages.live.collapseMiddleSteps", "0");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resizeObserverCallbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  const getMessagesScroller = (container: HTMLElement) => {
    const scroller = container.querySelector(".messages");
    expect(scroller).toBeTruthy();
    return scroller as HTMLDivElement;
  };

  const setScrollerMetrics = (
    scroller: HTMLDivElement,
    scrollTop: number,
    scrollHeight: number | (() => number) = 2400,
  ) => {
    let currentScrollTop = scrollTop;
    let scrollTopWriteCount = 0;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => currentScrollTop,
      set: (value: number) => {
        currentScrollTop = value;
        scrollTopWriteCount += 1;
      },
    });
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollHeight", {
      configurable: true,
      get: () => (typeof scrollHeight === "function" ? scrollHeight() : scrollHeight),
    });
    return {
      getScrollTopWriteCount: () => scrollTopWriteCount,
    };
  };

  const setMessageOffsetTop = (container: HTMLElement, messageId: string, offsetTop: number) => {
    const message = container.querySelector(`[data-message-anchor-id="${messageId}"]`);
    expect(message).toBeTruthy();
    Object.defineProperty(message, "offsetTop", {
      configurable: true,
      value: offsetTop,
    });
  };

  const getActiveAnchorDashIndex = (container: HTMLElement) =>
    [...container.querySelectorAll(".messages-anchor-dash")].findIndex((dash) =>
      dash.classList.contains("is-active"),
    );

  it("scrolls the messages container when receiving a jump-to-message event", () => {
    const items: ConversationItem[] = [
      {
        id: "u1",
        kind: "message",
        role: "user",
        text: "older",
      },
      {
        id: "u2",
        kind: "message",
        role: "user",
        text: "latest",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 240,
      writable: true,
    });
    Object.defineProperty(scroller, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 120 }),
    });

    const targetNode = container.querySelector('[data-message-anchor-id="u2"]');
    expect(targetNode).toBeTruthy();
    Object.defineProperty(targetNode as HTMLDivElement, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 480 }),
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u2",
        }),
      );
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: Math.max(0, 240 + (480 - 120) - 720 * 0.28),
      behavior: "smooth",
    });
  });

  it("ignores the retired mossx jump event name after the ccgui event migration", () => {
    const items: ConversationItem[] = [
      {
        id: "u1",
        kind: "message",
        role: "user",
        text: "older",
      },
      {
        id: "u2",
        kind: "message",
        role: "user",
        text: "latest",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-retired-event"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("mossx:jump-to-message", {
          detail: "u2",
        }),
      );
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("expands collapsed history before jumping to an older message", async () => {
    const items: ConversationItem[] = Array.from({ length: 35 }, (_, index) => ({
      id: `u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-collapsed"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('[data-message-anchor-id="u1"]')).toBeNull();
    const showEarlierButton = container.querySelector(".messages-collapsed-indicator");
    expect(showEarlierButton).toBeTruthy();
    expect(showEarlierButton?.getAttribute("data-collapsed-count")).toBe("5");

    const scroller = getMessagesScroller(container);
    const scrollToSpy = vi.spyOn(scroller, "scrollTo");
    Object.defineProperty(scroller, "clientHeight", {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      value: 180,
      writable: true,
    });
    Object.defineProperty(scroller, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ top: 120 }),
    });

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u1",
        }),
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-message-anchor-id="u1"]')).toBeTruthy();
    });

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalled();
    });
    expect(scrollToSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      behavior: "smooth",
    });
  });

  it("keeps only the latest title-only reasoning row for gemini and shows tool activity in the working indicator", () => {
    const items: ConversationItem[] = [
      {
        id: "user-gemini-title-only",
        kind: "message",
        role: "user",
        text: "索引仓库",
      },
      {
        id: "reasoning-title-only-old",
        kind: "reasoning",
        summary: "Planning old step",
        content: "",
      },
      {
        id: "reasoning-title-only",
        kind: "reasoning",
        summary: "Indexing workspace",
        content: "",
      },
      {
        id: "tool-after-reasoning",
        kind: "tool",
        title: "Command: rg --files",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="gemini:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="gemini"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    // Working bar: spinner + timer + fixed status + tool activity; no reasoning first-line echo.
    expect(container.querySelector(".working")).toBeTruthy();
    expect(container.querySelector(".working-text")?.textContent ?? "").toContain("响应中");
    expect(container.querySelector(".working-activity")?.textContent ?? "").toContain(
      "Command: rg --files",
    );
    expect(container.querySelector(".working-activity")?.textContent ?? "").not.toContain(
      "Indexing workspace",
    );
    const reasoningRows = container.querySelectorAll(".thinking-block");
    expect(reasoningRows.length).toBe(1);
    expect(container.querySelector(".thinking-title")).toBeTruthy();
  });

  it("keeps the latest Claude title-only reasoning row on the curtain before the first assistant chunk", () => {
    const items: ConversationItem[] = [
      {
        id: "user-claude-reasoning-visible",
        kind: "message",
        role: "user",
        text: "帮我分析一下项目结构",
      },
      {
        id: "reasoning-claude-old",
        kind: "reasoning",
        summary: "先定位仓库入口",
        content: "",
      },
      {
        id: "reasoning-claude-latest",
        kind: "reasoning",
        summary: "这是一个包含多个子项目的目录。让我探索一下项目结构。",
        content: "",
      },
      {
        id: "tool-claude-read-old",
        kind: "tool",
        title: "批量读取文件 (2)",
        detail: "package.json pyproject.toml",
        toolType: "read",
        output: "",
        status: "completed",
      },
      {
        id: "tool-claude-read-latest",
        kind: "tool",
        title: "批量读取文件 (4)",
        detail: "AGENTS.md next.config.ts README.md",
        toolType: "read",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="claude:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const reasoningRows = container.querySelectorAll(".thinking-block");
    expect(reasoningRows.length).toBe(1);
    const reasoningTitle = container.querySelector(".thinking-title");
    expect(reasoningTitle?.textContent ?? "").toBeTruthy();
    expect(container.querySelector(".working-text")?.textContent ?? "").not.toContain(
      "这是一个包含多个子项目的目录。让我探索一下项目结构。",
    );
    expect(container.querySelector(".working-activity")?.textContent ?? "").toContain(
      "批量读取文件 (4)",
    );
  });

  it("renders Claude reasoning and assistant message together when conversation state reuses the same item id", () => {
    const conversationState: ConversationState = {
      items: [
        {
          id: "user-shared-id",
          kind: "message",
          role: "user",
          text: "分析一下这个项目",
        },
        {
          id: "claude-live-shared",
          kind: "reasoning",
          summary: "我先梳理目录结构。",
          content: "我先梳理目录结构。",
        },
        {
          id: "claude-live-shared",
          kind: "message",
          role: "assistant",
          text: "# 项目分析\n\n这里是实时正文。",
        },
      ],
      plan: null,
      userInputQueue: [],
      meta: {
        workspaceId: "ws-1",
        threadId: "claude:thread-shared-id",
        engine: "claude",
        activeTurnId: "turn-1",
        isThinking: true,
        heartbeatPulse: null,
        historyRestoredAtMs: null,
      },
    };

    const { container } = render(
      <Messages
        items={[]}
        threadId="claude:thread-shared-id"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        conversationState={conversationState}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelectorAll(".thinking-block").length).toBe(1);
    expect(container.textContent ?? "").toContain("这里是实时正文。");
  });

  it("hides command cards on codex canvas while keeping file-edit cards", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-codex-command-1",
        kind: "tool",
        title: "Command: pwd && ls -la",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-codex-command-2",
        kind: "tool",
        title: "Command: echo done",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-codex-edit-1",
        kind: "tool",
        title: "Tool: edit",
        detail: JSON.stringify({
          file_path: "src/keep.ts",
          old_string: "before",
          new_string: "after",
        }),
        toolType: "edit",
        status: "completed",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").not.toContain("pwd && ls -la");
    expect(container.textContent ?? "").not.toContain("echo done");
    // File edits render in a default-collapsed scene shell; expand to assert path.
    const editScene = container.querySelector(
      '[data-testid="file-edit-scene-list"]',
    )?.previousElementSibling as HTMLElement | null;
    const editToggle =
      container.querySelector('[aria-expanded="false"]') ??
      Array.from(container.querySelectorAll("button, [role='button']")).find(
        (node) =>
          (node.textContent ?? "").includes("文件修改") ||
          (node.textContent ?? "").includes("File changes") ||
          (node.textContent ?? "").includes("fileEditSceneCount"),
      );
    if (editToggle) {
      fireEvent.click(editToggle);
    }
    expect(container.textContent ?? "").toContain("keep.ts");
    void editScene;
  });

  it("hides command cards on claude canvas", () => {
    const items: ConversationItem[] = [
      {
        id: "tool-claude-command-1",
        kind: "tool",
        title: "Command: pwd && ls -la",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
      {
        id: "tool-claude-command-2",
        kind: "tool",
        title: "Command: echo done",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "done",
        status: "completed",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").not.toContain("pwd && ls -la");
    expect(container.textContent ?? "").not.toContain("echo done");
  });

  it.each(["claude", "gemini", "codex"] as const)(
    "uses a unified simple working indicator for %s (no phase glow FX)",
    (activeEngine) => {
      const baseItems: ConversationItem[] = [
        {
          id: "user-stream-phase",
          kind: "message",
          role: "user",
          text: "继续输出",
        },
        {
          id: "assistant-stream-phase",
          kind: "message",
          role: "assistant",
          text: "",
        },
      ];

      const { container, rerender } = render(
        <Messages
          items={baseItems}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          activeEngine={activeEngine}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const waitingNode = container.querySelector(".working");
      expect(waitingNode).toBeTruthy();
      expect(waitingNode?.className ?? "").toBe("working");
      expect(waitingNode?.querySelector(".working-spinner")).toBeTruthy();
      expect(waitingNode?.className ?? "").not.toContain("is-waiting");
      expect(waitingNode?.className ?? "").not.toContain("is-ingress");

      rerender(
        <Messages
          items={[
            baseItems[0]!,
            {
              id: "assistant-stream-phase",
              kind: "message",
              role: "assistant",
              text: "增量片段",
            },
          ]}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          activeEngine={activeEngine}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const streamingNode = container.querySelector(".working");
      expect(streamingNode?.className ?? "").toBe("working");
      expect(streamingNode?.className ?? "").not.toContain("is-ingress");
      expect(streamingNode?.className ?? "").not.toContain("is-waiting");
    },
  );

  it("shows a working indicator while context compaction is in progress", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "assistant-before-compaction",
            kind: "message",
            role: "assistant",
            text: "已有上下文",
          },
        ]}
        threadId="claude:thread-compact-1"
        workspaceId="ws-1"
        isThinking={false}
        isContextCompacting={true}
        activeEngine="claude"
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingNode = container.querySelector(".working");
    const workingText = container.querySelector(".working-text");
    expect(workingNode).toBeTruthy();
    expect(workingText?.textContent ?? "").toContain("Compacting context");
  });

  it("shows Codex first-text waiting state before assistant text arrives", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-codex-first-text",
            kind: "message",
            role: "user",
            text: "继续推进",
          },
        ]}
        threadId="codex-thread-first-text"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-text")?.textContent ?? "").toContain(
      "messages.codexWaitingForFirstText",
    );
  });

  it("keeps Codex silent suspected state above the first-text waiting state", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-codex-silent",
            kind: "message",
            role: "user",
            text: "继续推进",
          },
        ]}
        threadId="codex-thread-silent"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 13_000}
        codexSilentSuspectedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const label = container.querySelector(".working-text")?.textContent ?? "";
    expect(label).toContain("messages.codexSilentSuspected");
    expect(label).not.toContain("messages.codexWaitingForFirstText");
  });

  it("shows approval resume status as the primary working label for Claude file approvals", () => {
    const { container } = render(
      <Messages
        items={[
          {
            id: "user-approval-resume",
            kind: "message",
            role: "user",
            text: "创建 3 个文件",
          },
          {
            id: "assistant-before-approval",
            kind: "message",
            role: "assistant",
            text: "我会先创建文件。",
            isFinal: true,
          },
          {
            id: "file-approval-running",
            kind: "tool",
            toolType: "fileChange",
            title: "Applying approved file change",
            detail: "{\"file_path\":\"aaa.txt\"}",
            status: "running",
            output: "Approved. Applying the change locally and resuming Claude...",
          },
        ]}
        threadId="claude:thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-text")?.textContent ?? "").toContain(
      "resuming Claude",
    );
    expect(container.querySelector(".working-activity")?.textContent ?? "").toContain(
      "Applying approved file change",
    );
  });

  it("does not render Codex session file-change summary cards in the timeline", async () => {
    const items: ConversationItem[] = [
      {
        id: "user-codex-file-summary",
        kind: "message",
        role: "user",
        text: "更新文件",
      },
      {
        id: "tool-codex-file-summary",
        kind: "tool",
        toolType: "fileChange",
        title: "File changes",
        detail: "",
        status: "completed",
        changes: [
          {
            path: "src/App.tsx",
            kind: "modified",
            diff: "@@ -1,1 +1,1 @@\n-old\n+new",
          },
        ],
      },
      {
        id: "assistant-codex-file-summary",
        kind: "message",
        role: "assistant",
        text: "生产代码已改，继续验证。",
        isFinal: true,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-codex-file-summary"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("messages.turnFilesChanged.title")).toBeNull();
    });
  });

  it.each(["claude", "gemini"] as const)(
    "keeps %s working indicator simple when chunk content changes at same length",
    (activeEngine) => {
      const { container, rerender } = render(
        <Messages
          items={[
            {
              id: "user-stream-same-length",
              kind: "message",
              role: "user",
              text: "继续输出",
            },
            {
              id: "assistant-stream-same-length",
              kind: "message",
              role: "assistant",
              text: "aaaa",
            },
          ]}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          activeEngine={activeEngine}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const baselineNode = container.querySelector(".working");
      expect(baselineNode?.className ?? "").toBe("working");

      rerender(
        <Messages
          items={[
            {
              id: "user-stream-same-length",
              kind: "message",
              role: "user",
              text: "继续输出",
            },
            {
              id: "assistant-stream-same-length",
              kind: "message",
              role: "assistant",
              text: "bbbb",
            },
          ]}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          activeEngine={activeEngine}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const afterNode = container.querySelector(".working");
      expect(afterNode?.className ?? "").toBe("working");
      expect(afterNode?.className ?? "").not.toContain("is-ingress");
    },
  );

  it("disables auto-follow scrolling when live auto-follow toggle is off", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const { container, rerender } = render(
      <Messages
        items={[
          {
            id: "assistant-live-scroll-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    const metrics = setScrollerMetrics(scroller, 400, 2_000);
    const baselineWrites = metrics.getScrollTopWriteCount();

    rerender(
      <Messages
        items={[
          {
            id: "assistant-live-scroll-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          {
            id: "assistant-live-scroll-2",
            kind: "message",
            role: "assistant",
            text: "second chunk",
          },
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(metrics.getScrollTopWriteCount()).toBe(baselineWrites);
  });

  it("forces send and settle boundaries to the bottom with live auto-follow off", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const renderWith = (thinking: boolean) => (
      <Messages
        items={[
          {
            id: "boundary-force-assistant",
            kind: "message",
            role: "assistant",
            text: thinking ? "streaming" : "settled",
          },
        ]}
        threadId="thread-boundary-force"
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={thinking ? Date.now() - 1_000 : null}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false));
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2_400;
    setScrollerMetrics(scroller, 400, () => scrollHeight);
    fireEvent.wheel(scroller, { deltaY: -120 });
    fireEvent.scroll(scroller);

    // 边沿前的 user intent 与 preference 不得阻止 send placement。
    rerender(renderWith(true));
    expect(scroller.scrollTop).toBe(scrollHeight - 720);

    // Streaming 期间仍允许用户解除 continuous follow。
    fireEvent.wheel(scroller, { deltaY: -120 });
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(400);

    // settle 是新的 boundary，再次重置旧 ownership 并强制吸底。
    rerender(renderWith(false));
    expect(scroller.scrollTop).toBe(scrollHeight - 720);

    // boundary 之后的新输入拥有控制权，必须能取消迟到 recheck。
    fireEvent.wheel(scroller, { deltaY: -120 });
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);
    scrollHeight = 3_200;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(400);
  });

  it("forces a queued user message to the bottom while the current turn stays working", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const renderWith = (includeQueuedUser: boolean) => (
      <Messages
        items={[
          { id: "queued-send-user-1", kind: "message", role: "user", text: "first" },
          {
            id: "queued-send-assistant-1",
            kind: "message",
            role: "assistant",
            text: "streaming",
          },
          ...(includeQueuedUser
            ? [
                {
                  id: "queued-handoff-message-2",
                  kind: "message" as const,
                  role: "user" as const,
                  text: "second",
                },
              ]
            : []),
        ]}
        threadId="thread-queued-send-boundary"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false));
    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 400, 2400);
    fireEvent.wheel(scroller, { deltaY: -120 });
    fireEvent.scroll(scroller);

    rerender(renderWith(true));

    expect(scroller.scrollTop).toBe(2400 - 720);
  });

  it("does not repeat send placement when working starts after the optimistic user bubble", () => {
    const renderWith = (includeOptimisticUser: boolean, thinking: boolean) => (
      <Messages
        items={[
          { id: "delayed-working-user-1", kind: "message", role: "user", text: "first" },
          {
            id: "delayed-working-assistant-1",
            kind: "message",
            role: "assistant",
            text: "settled",
            isFinal: true,
          },
          ...(includeOptimisticUser
            ? [
                {
                  id: "optimistic-user-delayed-working",
                  kind: "message" as const,
                  role: "user" as const,
                  text: "second",
                },
              ]
            : []),
        ]}
        threadId="thread-delayed-working-boundary"
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={thinking ? Date.now() - 1_000 : null}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false, false));
    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 400, 2400);

    rerender(renderWith(true, false));
    expect(scroller.scrollTop).toBe(2400 - 720);

    // optimistic bubble 后的新用户滚动，不能被随后到达的 working 状态重复覆盖。
    fireEvent.wheel(scroller, { deltaY: -120 });
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);
    rerender(renderWith(true, true));
    expect(scroller.scrollTop).toBe(400);
  });

  it("stops auto-follow after the user scrolls up, then resumes at the bottom", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const renderWith = (extraChunk: boolean) => (
      <Messages
        items={[
          {
            id: "assistant-live-follow-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          ...(extraChunk
            ? [
                {
                  id: "assistant-live-follow-2",
                  kind: "message" as const,
                  role: "assistant" as const,
                  text: "second chunk",
                },
              ]
            : []),
        ]}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false));

    const scroller = getMessagesScroller(container);
    // User scrolls up (wheel 租约 + 离底位置) — auto-follow must release.
    // 仅改 scrollTop 不发 wheel 会被当成内容长高假离底，不得解绑。
    setScrollerMetrics(scroller, 400, 2000);
    fireEvent.wheel(scroller, { deltaY: -120 });
    fireEvent.scroll(scroller);

    rerender(renderWith(true));
    await Promise.resolve();
    expect(scroller.scrollTop).toBe(400);

    // User scrolls back to the bottom — auto-follow re-arms.
    rerender(renderWith(false));
    let scrollHeight = 2000;
    setScrollerMetrics(scroller, 1280, () => scrollHeight); // true bottom
    fireEvent.scroll(scroller);

    rerender(renderWith(true));
    scrollHeight = 2500;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(2500 - 720);
  });

  it("keeps the latest anchor stable at the bottom and tracks the viewport after scroll-away", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { container } = render(
        <Messages
          items={[
            { id: "anchor-user-old", kind: "message", role: "user", text: "older" },
            { id: "anchor-assistant-old", kind: "message", role: "assistant", text: "reply" },
            { id: "anchor-user-latest", kind: "message", role: "user", text: "latest" },
          ]}
          threadId="thread-bottom-anchor-stability"
          workspaceId="ws-1"
          isThinking
          activeEngine="codex"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const scroller = getMessagesScroller(container);
      setMessageOffsetTop(container, "anchor-user-old", 1_760);
      setMessageOffsetTop(container, "anchor-user-latest", 320);

      // At the true bottom, transient virtual-row geometry must not pull the
      // active state back to an older anchor.
      setScrollerMetrics(scroller, 1_680, 2_400);
      for (let index = 0; index < 12; index += 1) {
        fireEvent.scroll(scroller);
      }
      await waitFor(() => expect(getActiveAnchorDashIndex(container)).toBe(1));

      // Once the user leaves the bottom, preserve the existing viewport probe.
      scroller.scrollTop = 400;
      setMessageOffsetTop(container, "anchor-user-old", 480);
      setMessageOffsetTop(container, "anchor-user-latest", 1_760);
      fireEvent.scroll(scroller);
      await waitFor(() => expect(getActiveAnchorDashIndex(container)).toBe(0));

      const updateDepthErrors = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((entry) => String(entry).includes("Maximum update depth exceeded")),
      );
      expect(updateDepthErrors).toHaveLength(0);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("re-arms auto-follow and returns to the bottom when focus follow is re-enabled", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const renderWith = (extraChunk: boolean) => (
      <Messages
        items={[
          {
            id: "assistant-live-rearm-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          ...(extraChunk
            ? [
                {
                  id: "assistant-live-rearm-2",
                  kind: "message" as const,
                  role: "assistant" as const,
                  text: "second chunk",
                },
              ]
            : []),
        ]}
        threadId="thread-live-follow-rearm"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false));

    const scroller = getMessagesScroller(container);
    let scrollHeight = 2000;
    setScrollerMetrics(scroller, 400, () => scrollHeight);
    fireEvent.scroll(scroller);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(MESSAGES_LIVE_CONTROLS_UPDATED_EVENT, {
          detail: { liveAutoFollowEnabled: true },
        }),
      );
    });

    // Re-arming snaps the viewport back to the true bottom.
    expect(scroller.scrollTop).toBe(2000 - 720);

    rerender(renderWith(true));
    scrollHeight = 2500;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(2500 - 720);
  });

  it("cancels pending live rechecks when focus follow is disabled", () => {
    vi.useFakeTimers();
    try {
      window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
      const { container } = render(
        <Messages
          items={[
            {
              id: "assistant-live-cancel-recheck",
              kind: "message",
              role: "assistant",
              text: "streaming",
            },
          ]}
          threadId="thread-live-cancel-recheck"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_000;
      setScrollerMetrics(scroller, 400, () => scrollHeight);
      fireEvent.scroll(scroller);

      act(() => {
        window.dispatchEvent(
          new CustomEvent(MESSAGES_LIVE_CONTROLS_UPDATED_EVENT, {
            detail: { liveAutoFollowEnabled: true },
          }),
        );
      });
      expect(scroller.scrollTop).toBe(2_000 - 720);

      act(() => {
        window.dispatchEvent(
          new CustomEvent(MESSAGES_LIVE_CONTROLS_UPDATED_EVENT, {
            detail: { liveAutoFollowEnabled: false },
          }),
        );
      });
      scrollHeight = 3_000;
      act(() => {
        vi.advanceTimersByTime(2_100);
      });

      expect(scroller.scrollTop).toBe(2_000 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not thrash scrollTop when focus follow chases a fast-growing stream", async () => {
    // 快流：scrollKey + 连续 Resize 不得 cancel/restart 整条收敛；应复用 active run + 有限次写底。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const { container } = render(
      <Messages
        items={[
          {
            id: "fast-stream-assistant",
            kind: "message",
            role: "assistant",
            text: "streaming fast",
          },
        ]}
        threadId="thread-fast-stream-stick"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2_000;
    const metrics = setScrollerMetrics(scroller, 2_000 - 720, () => scrollHeight);
    fireEvent.scroll(scroller);
    notifyContentResized();
    const writesAfterArm = metrics.getScrollTopWriteCount();

    for (let step = 0; step < 12; step += 1) {
      scrollHeight += 80;
      notifyContentResized();
    }
    // 再冲一帧，让可能存在的 live-follow coalesce rAF 落地。
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(scroller.scrollTop).toBe(scrollHeight - 720);
    // 12 次增高：理想是每次约 1 次 write。若每次 cancel/restart 整段 pulse，
    // 会远超 12（首帧 + settle 帧 + recheck 重建）。允许 rAF 与 nudge 偶发双写的余量。
    const writesDuringChase = metrics.getScrollTopWriteCount() - writesAfterArm;
    expect(writesDuringChase).toBeGreaterThan(0);
    expect(writesDuringChase).toBeLessThanOrEqual(28);
  });

  it("keeps stick-to-bottom after settle when focus follow is on and content grows late", () => {
    // 回合结束后思考折叠 / full markdown / 虚拟化 remeasure 会继续改 scrollHeight。
    // 焦点跟随 + 仍停在底部时，必须越过 isWorking 门槛继续追真实底部。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    vi.useFakeTimers();
    try {
      const renderWith = (thinking: boolean) => (
        <Messages
          items={[
            {
              id: "post-settle-stick-user",
              kind: "message",
              role: "user",
              text: "go",
            },
            {
              id: "post-settle-stick-assistant",
              kind: "message",
              role: "assistant",
              text: thinking ? "streaming" : "final answer with taller layout",
            },
          ]}
          threadId="thread-post-settle-stick"
          workspaceId="ws-1"
          isThinking={thinking}
          processingStartedAt={thinking ? Date.now() - 1_000 : null}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );
      const { container, rerender } = render(renderWith(true));
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_400;
      setScrollerMetrics(scroller, 2_400 - 720, () => scrollHeight);
      fireEvent.scroll(scroller);
      notifyContentResized();
      expect(scroller.scrollTop).toBe(2_400 - 720);

      // 回合结束：settle 钉底后预算窗耗尽，模拟迟到测高（思考折叠/全文回刷）。
      rerender(renderWith(false));
      expect(scroller.scrollTop).toBe(scrollHeight - 720);

      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      scrollHeight = 3_600;
      notifyContentResized();
      expect(scroller.scrollTop).toBe(3_600 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps follow armed when settle height jumps and a layout scroll fires without user intent", () => {
    // 回归：尾窗回全量 / 虚拟化 remeasure 让 scrollHeight 暴涨后，浏览器会派发 scroll，
    // 此时 distanceToBottom 已远超 120px。旧逻辑把「假离底」当成用户离开，解除 autoScroll
    // 并 cancel 收敛 → 回合结束瞬间视口停在中上段（用户体感「飞到上面」）。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    vi.useFakeTimers();
    try {
      const renderWith = (thinking: boolean) => (
        <Messages
          items={[
            {
              id: "fake-leave-user",
              kind: "message",
              role: "user",
              text: "go",
            },
            {
              id: "fake-leave-assistant",
              kind: "message",
              role: "assistant",
              text: thinking ? "streaming tail" : "final tall answer after full history restore",
            },
          ]}
          threadId="thread-settle-fake-leave"
          workspaceId="ws-1"
          isThinking={thinking}
          processingStartedAt={thinking ? Date.now() - 1_000 : null}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );
      const { container, rerender } = render(renderWith(true));
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_400;
      setScrollerMetrics(scroller, 2_400 - 720, () => scrollHeight);
      fireEvent.scroll(scroller);
      notifyContentResized();
      expect(scroller.scrollTop).toBe(2_400 - 720);

      // settle：先钉到当时的底
      rerender(renderWith(false));
      expect(scroller.scrollTop).toBe(scrollHeight - 720);

      // 高度阶跃：scrollTop 仍停在旧底（距新底 2880px ≫ 120），只派发 scroll、无 wheel
      scrollHeight = 5_280;
      fireEvent.scroll(scroller);
      // 保护路径必须仍武装；随后 Resize 才能把视口追到真底
      notifyContentResized();
      expect(scroller.scrollTop).toBe(5_280 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-pins when the composer status strip shrinks the container after the settle window", () => {
    vi.useFakeTimers();
    try {
      const renderWith = (thinking: boolean) => (
        <Messages
          items={[
            {
              id: "settle-shrink-user",
              kind: "message",
              role: "user",
              text: "run",
            },
            {
              id: "settle-shrink-assistant",
              kind: "message",
              role: "assistant",
              text: thinking ? "streaming tail" : "final answer",
            },
          ]}
          threadId="thread-settle-shrink"
          workspaceId="ws-1"
          isThinking={thinking}
          processingStartedAt={thinking ? Date.now() - 1_000 : null}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );
      const { container, rerender } = render(renderWith(true));
      const scroller = getMessagesScroller(container);
      const scrollHeight = 2_400;
      let clientHeight = 720;
      setScrollerMetrics(scroller, scrollHeight - 720, scrollHeight);
      Object.defineProperty(scroller, "clientHeight", {
        configurable: true,
        get: () => clientHeight,
      });
      notifyContentResized();

      // settle：先钉到当时的底
      rerender(renderWith(false));
      expect(scroller.scrollTop).toBe(scrollHeight - 720);

      // 让 forced 走完最短保持（6s）并凭真底 + 高度稳定采样退役，
      // 同时越过 settle 死线（finalizing 结束后 2.4s）。
      for (let i = 0; i < 6; i += 1) {
        act(() => {
          vi.advanceTimersByTime(1_400);
        });
        scroller.scrollTop = scrollHeight - clientHeight;
        notifyContentResized();
      }

      // Composer 运行态条（「已编辑 N 个文件」）迟到挂载：容器 clientHeight 被压小，
      // scrollTop / scrollHeight 均不变、不派发 scroll 事件。视口必须被追回新底。
      clientHeight = 620;
      notifyContentResized();
      expect(scroller.scrollTop).toBe(scrollHeight - 620);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not chase late idle growth when the user has scrolled away from the bottom", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    vi.useFakeTimers();
    try {
      const { container } = render(
        <Messages
          items={[
            {
              id: "idle-away-assistant",
              kind: "message",
              role: "assistant",
              text: "done",
            },
          ]}
          threadId="thread-idle-away-stick"
          workspaceId="ws-1"
          isThinking={false}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_400;
      setScrollerMetrics(scroller, 2_400 - 720, () => scrollHeight);
      notifyContentResized();

      fireEvent.wheel(scroller, { deltaY: -120 });
      scroller.scrollTop = 400;
      fireEvent.scroll(scroller);

      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      scrollHeight = 3_600;
      notifyContentResized();
      expect(scroller.scrollTop).toBe(400);

      // 再滚回底部应恢复 stick。
      scroller.scrollTop = 3_600 - 720;
      fireEvent.scroll(scroller);
      scrollHeight = 4_200;
      notifyContentResized();
      expect(scroller.scrollTop).toBe(4_200 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("chases late row measurements so opening a thread lands at the true bottom", async () => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "open-pin-1", kind: "message", role: "user", text: "hello" },
          { id: "open-pin-2", kind: "message", role: "assistant", text: "long answer" },
        ]}
        threadId="thread-open-pin"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);

    // Rows land on estimated heights first; the real measurements (virtualizer
    // ResizeObserver / content-visibility layout) grow scrollHeight afterwards.
    // A one-shot pin would be stranded — the follow window must chase it down.
    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(2400 - 720);

    scrollHeight = 3600;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(3600 - 720);

    // ResizeObserver 已经写到底后，virtualizer 可能在同一收敛窗口里修正 scrollTop，
    // 且不再产生新的 content resize。owner 必须靠后续帧验证追回 true bottom。
    scroller.scrollTop = 900;
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(scroller.scrollTop).toBe(3600 - 720);
    scrollSpy.mockRestore();
  });

  it("finishes history placement on late geometry via ResizeObserver with focus follow off", () => {
    // 全砍：不再靠 100/300/1000/2000ms 定时 recheck；迟到测高只靠 RO。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const renderWith = (items: ConversationItem[], loading: boolean) => (
      <Messages
        items={items}
        threadId="thread-history-focus-off"
        workspaceId="ws-1"
        isThinking={false}
        isHistoryLoading={loading}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const historyItems: ConversationItem[] = [
      { id: "history-focus-off-1", kind: "message", role: "user", text: "hello" },
      {
        id: "history-focus-off-2",
        kind: "message",
        role: "assistant",
        text: "late measured answer",
      },
    ];
    const { container, rerender } = render(renderWith([], true));
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2_400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);

    rerender(renderWith(historyItems, false));
    expect(scroller.scrollTop).toBe(2_400 - 720);

    scrollHeight = 4_000;
    notifyContentResized();

    expect(scroller.scrollTop).toBe(4_000 - 720);
  });

  it("uses settle placement after an active-first history load", () => {
    vi.useFakeTimers();
    try {
      const items: ConversationItem[] = [
        { id: "active-first-user", kind: "message", role: "user", text: "run" },
        {
          id: "active-first-assistant",
          kind: "message",
          role: "assistant",
          text: "working",
        },
      ];
      const renderWith = (thinking: boolean, loading: boolean) => (
        <Messages
          items={items}
          threadId="thread-active-first-history"
          workspaceId="ws-1"
          isThinking={thinking}
          isHistoryLoading={loading}
          processingStartedAt={Date.now() - 1_000}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );
      const { container, rerender } = render(renderWith(true, true));
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_400;
      setScrollerMetrics(scroller, 0, () => scrollHeight);

      rerender(renderWith(true, false));
      expect(scroller.scrollTop).toBe(2_400 - 720);

      fireEvent.wheel(scroller, { deltaY: -120 });
      scroller.scrollTop = 400;
      fireEvent.scroll(scroller);
      rerender(renderWith(false, false));
      scrollHeight = 4_000;
      act(() => {
        vi.advanceTimersByTime(2_100);
      });

      // 这次写入来自 turn-settle，而不是 history-open 重复初始化。
      expect(scroller.scrollTop).toBe(4_000 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("restarts history placement when the same cached thread is closed and reopened", () => {
    vi.useFakeTimers();
    try {
      const historyItems: ConversationItem[] = [
        { id: "reopen-user", kind: "message", role: "user", text: "question" },
        { id: "reopen-assistant", kind: "message", role: "assistant", text: "answer" },
      ];
      const renderWith = (threadId: string | null, items: ConversationItem[]) => (
        <Messages
          items={items}
          threadId={threadId}
          workspaceId="ws-reopen"
          isThinking={false}
          isHistoryLoading={false}
          openTargets={[]}
          selectedOpenAppId=""
        />
      );
      const { container, rerender } = render(renderWith(null, []));
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2_400;
      setScrollerMetrics(scroller, 0, () => scrollHeight);

      rerender(renderWith("thread-reopen", historyItems));
      expect(scroller.scrollTop).toBe(2_400 - 720);

      rerender(renderWith(null, []));
      scroller.scrollTop = 0;
      rerender(renderWith("thread-reopen", historyItems));
      expect(scroller.scrollTop).toBe(2_400 - 720);

      act(() => {
        vi.advanceTimersByTime(1_100);
      });
      scrollHeight = 4_000;
      act(() => {
        vi.advanceTimersByTime(900);
      });
      expect(scroller.scrollTop).toBe(4_000 - 720);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not emit redundant scroll writes for duplicate history resize signals", async () => {
    const { container } = render(
      <Messages
        items={[
          { id: "history-stable-1", kind: "message", role: "user", text: "hello" },
          { id: "history-stable-2", kind: "message", role: "assistant", text: "done" },
        ]}
        threadId="thread-history-stable-resize"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    const metrics = setScrollerMetrics(scroller, 1_680, 2_400);

    notifyContentResized();
    notifyContentResized();
    notifyContentResized();
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(metrics.getScrollTopWriteCount()).toBe(0);
  });

  it("attaches the content observer on the first frame, before history lands", () => {
    // Threads mount with isHistoryLoading=true and an empty timeline. The observer
    // binds to .messages-timeline-root on mount and only rebinds per threadId, so
    // that node must already exist on the loading frame — otherwise follow is dead
    // for the whole session.
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const renderWith = (items: ConversationItem[], loading: boolean) => (
      <Messages
        items={items}
        threadId="thread-loading-then-lands"
        workspaceId="ws-1"
        isThinking={false}
        isHistoryLoading={loading}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith([], true));

    expect(container.querySelector(".messages-timeline-root")).toBeTruthy();
    expect(resizeObserverCallbacks.length).toBeGreaterThan(0);

    const scroller = getMessagesScroller(container);
    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);

    // History lands: the initial pin fires and opens the follow window.
    rerender(
      renderWith(
        [{ id: "landed-1", kind: "message", role: "assistant", text: "history" }],
        false,
      ),
    );
    expect(scroller.scrollTop).toBe(2400 - 720);

    // Late row measurements grow the content inside the follow window.
    scrollHeight = 4000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(4000 - 720);
    scrollSpy.mockRestore();
  });

  it("follows the bottom while streaming text grows without changing items", () => {
    // The regression this guards: live assistant text is externalized through
    // liveAssistantTextChannel, so `items` (and therefore scrollKey) never change
    // during a turn. Only the content height changes — follow must key off that.
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const items: ConversationItem[] = [
      { id: "stream-follow-user", kind: "message", role: "user", text: "go" },
      { id: "stream-follow-assistant", kind: "message", role: "assistant", text: "partial" },
    ];
    const { container } = render(
      <Messages
        items={items}
        threadId="thread-stream-follow"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);

    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);

    // Same `items` identity across every step — only the rendered text grew.
    scrollHeight = 3000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(3000 - 720);

    scrollHeight = 5000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(5000 - 720);
    scrollSpy.mockRestore();
  });

  it("releases follow on wheel-up even before a scroll event lands", () => {
    // The observer writes scrollTop every frame while streaming. If follow only
    // released on `scroll` (async), a height change racing ahead of it would yank
    // the user straight back to the bottom — i.e. they could never scroll away.
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "wheel-release-user", kind: "message", role: "user", text: "go" },
          { id: "wheel-release-assistant", kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId="thread-wheel-release"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);

    // Wheel up only — deliberately no `scroll` event behind it.
    fireEvent.wheel(scroller, { deltaY: -120 });
    scroller.scrollTop = 900;

    scrollHeight = 5000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(900);

    // Scrolling back to the bottom re-arms follow — the guard must not latch.
    scroller.scrollTop = 5000 - 720;
    fireEvent.scroll(scroller);
    scrollHeight = 6000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(6000 - 720);

    scrollSpy.mockRestore();
  });

  it("stops following streaming growth once the user scrolls up", () => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "stream-release-user", kind: "message", role: "user", text: "go" },
          { id: "stream-release-assistant", kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId="thread-stream-release"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);

    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 0, () => scrollHeight);

    // User scrolls up mid-stream to read history: wheel 租约解除跟随。
    fireEvent.wheel(scroller, { deltaY: -120 });
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);

    scrollHeight = 5000;
    notifyContentResized();
    expect(scroller.scrollTop).toBe(400);
    scrollSpy.mockRestore();
  });

  it("keeps following when a programmatic-echo scroll event lands after late geometry growth", () => {
    // 回归：发送消息触发虚拟化翻开/live 尾窗裁剪时总高度先塌缩再回填。WebKit 的
    // scroll 事件异步派发，钉底写入产生的事件可能在高度回填之后才送达——事件位置
    // 离新底部很远，但它是程序化回声而非用户上滚，不能解除跟随并杀掉收敛 run。
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "echo-user", kind: "message", role: "user", text: "go" },
          { id: "echo-assistant", kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId="thread-echo"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);

    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 1000, () => scrollHeight);

    // 内容变化触发真实 write：1000 → 1680，applied value 进入 fingerprint ring。
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);

    // 迟到测高把总高度回填到 6000，随后旧写入的 scroll 事件才送达（位置仍是 1680，
    // 距新底部 3600px）。指纹命中 → 跟随保持武装，不得释放。
    scrollHeight = 6000;
    fireEvent.scroll(scroller);

    // 下一次内容高度信号应把视口追回新的真实底部，而不是滞留在 1680。
    notifyContentResized();
    expect(scroller.scrollTop).toBe(6000 - 720);
    scrollSpy.mockRestore();
  });

  it("keeps following when an actual write echo arrives after convergence completes", () => {
    // 全砍：迟到长高靠 RO 而非 2s checkpoint；write fingerprint + grace 仍保护 echo。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "grace-echo-user", kind: "message", role: "user", text: "go" },
          { id: "grace-echo-assistant", kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId="thread-grace-echo"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);

    let scrollHeight = 2400;
    const metrics = setScrollerMetrics(scroller, 1000, () => scrollHeight);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);

    scrollHeight = 3000;
    const writesBeforeGrow = metrics.getScrollTopWriteCount();
    notifyContentResized();
    expect(scroller.scrollTop).toBe(2280);
    expect(metrics.getScrollTopWriteCount()).toBeGreaterThan(writesBeforeGrow);

    // 刚写入 2280 的 fingerprint 尚在 grace 内；高度再涨后迟到 scroll 不得解除跟随。
    scrollHeight = 6000;
    fireEvent.scroll(scroller);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(6000 - 720);
    scrollSpy.mockRestore();
  });

  it("does not manufacture post-write grace from no-op convergence frames", () => {
    vi.useFakeTimers();
    try {
      const scrollSpy = vi
        .spyOn(HTMLElement.prototype, "scrollIntoView")
        .mockImplementation(() => {});
      const { container } = render(
        <Messages
          items={[
            { id: "noop-user", kind: "message", role: "user", text: "go" },
            { id: "noop-assistant", kind: "message", role: "assistant", text: "partial" },
          ]}
          threadId="thread-noop-echo"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 1_000}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const scroller = getMessagesScroller(container);
      let scrollHeight = 2400;
      const metrics = setScrollerMetrics(scroller, 1680, () => scrollHeight);

      notifyContentResized();
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      expect(metrics.getScrollTopWriteCount()).toBe(0);

      // 用户 wheel 离底（可仍停在旧底坐标）；租约期内不得立刻 re-arm，随后长高也不得吸回。
      fireEvent.wheel(scroller, { deltaY: -120 });
      scroller.scrollTop = 1680;
      fireEvent.scroll(scroller);
      const writesAfterLeave = metrics.getScrollTopWriteCount();
      scrollHeight = 6000;
      notifyContentResized();
      expect(scroller.scrollTop).toBe(1680);
      expect(metrics.getScrollTopWriteCount()).toBe(writesAfterLeave);
      scrollSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["keyboard", (scroller: HTMLDivElement) => fireEvent.keyDown(scroller, { key: "PageUp" })],
    ["touch", (scroller: HTMLDivElement) => fireEvent.touchStart(scroller)],
    [
      "pointer/scrollbar",
      (scroller: HTMLDivElement) =>
        fireEvent.pointerDown(scroller, { button: 0, pointerId: 7 }),
    ],
  ])("lets %s user intent override a matching fingerprint", (_source, signalIntent) => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: `intent-${_source}-user`, kind: "message", role: "user", text: "go" },
          {
            id: `intent-${_source}-assistant`,
            kind: "message",
            role: "assistant",
            text: "partial",
          },
        ]}
        threadId={`thread-intent-${_source}`}
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 1000, () => scrollHeight);

    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);
    signalIntent(scroller);

    // 位置仍命中刚写入的 1680 fingerprint，但 user intent 必须取得所有权。
    scrollHeight = 6000;
    fireEvent.scroll(scroller);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);
    scrollSpy.mockRestore();
  });

  it("does not restart convergence between touch intent and its scroll event", () => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "touch-race-user", kind: "message", role: "user", text: "go" },
          {
            id: "touch-race-assistant",
            kind: "message",
            role: "assistant",
            text: "partial",
          },
        ]}
        threadId="thread-touch-race"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2400;
    setScrollerMetrics(scroller, 1000, () => scrollHeight);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);

    fireEvent.touchStart(scroller);
    scrollHeight = 6000;
    notifyContentResized();

    // touch 已取得 owner、scroll 尚未派发：ResizeObserver 不得抢先写回新底部。
    expect(scroller.scrollTop).toBe(1680);
    scrollSpy.mockRestore();
  });

  it("recognizes a geometry-proven browser clamp as a programmatic echo", () => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          { id: "clamp-user", kind: "message", role: "user", text: "go" },
          { id: "clamp-assistant", kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId="thread-clamp"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );
    const scroller = getMessagesScroller(container);
    let scrollHeight = 6000;
    setScrollerMetrics(scroller, 5280, () => scrollHeight);

    // 建立 collapse 前 geometry，再模拟浏览器将越界位置钳位到新的 maxScrollTop。
    notifyContentResized();
    scrollHeight = 2400;
    scroller.scrollTop = 1680;
    notifyContentResized();

    // 钳位事件迟到时 geometry 已回填；clamp fingerprint 必须保护 follow owner。
    scrollHeight = 6000;
    fireEvent.scroll(scroller);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(5280);
    scrollSpy.mockRestore();
  });

  it("clears echo fingerprints on thread switch so stale positions are not exempted", async () => {
    // 回归：指纹环必须随会话切换清空。会话 A 的写入位置 1680 若残留进环，切到
    // 会话 B 后处于 grace 窗口内的旧位置 scroll 事件会被误判为回声而保持跟随。
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const renderWith = (threadId: string) => (
      <Messages
        items={[
          { id: `clear-${threadId}-user`, kind: "message", role: "user", text: "go" },
          { id: `clear-${threadId}-assistant`, kind: "message", role: "assistant", text: "partial" },
        ]}
        threadId={threadId}
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith("thread-clear-A"));
    const scroller = getMessagesScroller(container);

    // 会话 A：写入 scrollTop=1680，进入回声指纹。
    setScrollerMetrics(scroller, 1200, 2400);
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);

    // 切到会话 B：几何不同（底部 7280），history-open 钉底写入新指纹。
    setScrollerMetrics(scroller, 7000, 8000);
    rerender(renderWith("thread-clear-B"));
    expect(scroller.scrollTop).toBe(7280);

    // 旧会话的指纹位置 1680 处发生 scroll 事件：环已清空 → 不豁免 → 按真实用户
    // 上滚解除跟随（而不是被残留指纹误判成回声）。
    scroller.scrollTop = 1680;
    fireEvent.scroll(scroller);

    // 跟随已解除：后续内容高度信号不得把视口拽回底部。
    notifyContentResized();
    expect(scroller.scrollTop).toBe(1680);
    scrollSpy.mockRestore();
  });

  it("does not synthesize a settle boundary when switching from a working thread", () => {
    const renderWith = (threadId: string, thinking: boolean, messageId: string) => (
      <Messages
        items={[
          { id: messageId, kind: "message", role: "user", text: threadId },
        ]}
        threadId={threadId}
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={thinking ? Date.now() - 1_000 : null}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(
      renderWith("thread-scope-working", true, "scope-working-user"),
    );
    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 400, 2400);

    // 预置新会话的 message jump，使 history-open 明确让位给 pending anchor。
    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "scope-idle-user",
        }),
      );
    });
    rerender(renderWith("thread-scope-idle", false, "scope-idle-user"));

    // working true→false 来自 scope switch，不是同一 turn 的 settle，不能写到底部。
    expect(scroller.scrollTop).toBe(400);
  });

  it("re-pins to the bottom after the conversation settles and the timeline back-fills", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const renderWith = (thinking: boolean, extra: boolean) => (
      <Messages
        items={[
          {
            id: "settle-repin-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          ...(extra
            ? [
                {
                  id: "settle-repin-2",
                  kind: "message" as const,
                  role: "assistant" as const,
                  text: "second chunk",
                },
              ]
            : []),
        ]}
        threadId="thread-settle-repin"
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    // Thread is already open and idle (initial bottom-pin has run, so it will
    // not re-fire on settle), then the user sends a new turn.
    const { container, rerender } = render(renderWith(false, false));
    const scroller = getMessagesScroller(container);
    rerender(renderWith(true, false));
    // User is parked at the bottom while streaming — auto-follow stays armed.
    setScrollerMetrics(scroller, 1680, 2400); // 2400 - 1680 - 720 = 0, at bottom
    fireEvent.scroll(scroller);

    // Conversation settles (isThinking true -> false): opens the settle window.
    rerender(renderWith(false, false));
    // Let the 320ms finalizing window close so the auto-follow finalizing scroll
    // is excluded; the settle re-pin window is still open.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380));
    });

    // The curtain back-fills and the rows measure taller than estimated, so
    // scrollHeight grows after the pin: the re-pin must chase it to the bottom.
    setScrollerMetrics(scroller, 0, 3200);
    rerender(renderWith(false, true));
    notifyContentResized();
    expect(scroller.scrollTop).toBe(3200 - 720);
    scrollSpy.mockRestore();
  });

  it("re-pins on settle back-fill even when the user scrolled up during streaming", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const renderWith = (thinking: boolean, extra: boolean) => (
      <Messages
        items={[
          {
            id: "settle-norepin-1",
            kind: "message",
            role: "assistant",
            text: "first chunk",
          },
          ...(extra
            ? [
                {
                  id: "settle-norepin-2",
                  kind: "message" as const,
                  role: "assistant" as const,
                  text: "second chunk",
                },
              ]
            : []),
        ]}
        threadId="thread-settle-norepin"
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    // Thread is already open and idle (initial bottom-pin has run), then the
    // user sends a new turn and scrolls up mid-stream to read history.
    const { container, rerender } = render(renderWith(false, false));
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2400;
    rerender(renderWith(true, false));
    // User scrolls up to read history during streaming — auto-follow released.
    setScrollerMetrics(scroller, 400, () => scrollHeight); // far from the bottom
    fireEvent.scroll(scroller);

    // settle boundary resets the preceding streaming ownership and snaps bottom.
    rerender(renderWith(false, false));
    expect(scroller.scrollTop).toBe(scrollHeight - 720);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 380));
    });

    // Deferred curtain back-fill remains inside the settle convergence window.
    scrollHeight = 3200;
    rerender(renderWith(false, true));
    notifyContentResized();
    expect(scroller.scrollTop).toBe(scrollHeight - 720);
    scrollSpy.mockRestore();
  });

  it("re-pins after every settlement across multiple turns", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const renderWith = (thinking: boolean, turnCount: number) => (
      <Messages
        items={Array.from({ length: turnCount + 1 }, (_, index) => ({
          id: `multi-turn-assistant-${index}`,
          kind: "message" as const,
          role: "assistant" as const,
          text: index === turnCount && thinking ? "streaming" : `settled ${index}`,
        }))}
        threadId="thread-multi-turn-settle"
        workspaceId="ws-1"
        isThinking={thinking}
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderWith(false, 0));
    const scroller = getMessagesScroller(container);
    let scrollHeight = 2_400;
    setScrollerMetrics(scroller, scrollHeight - 720, () => scrollHeight);
    fireEvent.scroll(scroller);

    for (let turn = 1; turn <= 3; turn += 1) {
      scrollHeight += 400;
      rerender(renderWith(true, turn));
      expect(scroller.scrollTop).toBe(scrollHeight - 720);

      scrollHeight += 600;
      rerender(renderWith(false, turn));
      expect(scroller.scrollTop).toBe(scrollHeight - 720);
    }
  });

  it("ignores duplicate live auto-follow enabled events", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { container } = render(
      <Messages
        items={[
          {
            id: "assistant-live-duplicate-follow",
            kind: "message",
            role: "assistant",
            text: "streaming chunk",
          },
        ]}
        threadId="thread-live-follow-duplicate-event"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 400, 2000);
    fireEvent.scroll(scroller);
    scrollSpy.mockClear();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(MESSAGES_LIVE_CONTROLS_UPDATED_EVENT, {
          detail: { liveAutoFollowEnabled: true },
        }),
      );
    });

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("does not auto-follow static history item changes", () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "1");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const { rerender } = render(
      <Messages
        items={[
          {
            id: "history-static-1",
            kind: "message",
            role: "user",
            text: "历史消息 1",
          },
        ]}
        threadId="thread-history-static"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    // Opening a thread pins the viewport to the bottom once; static item
    // changes afterwards must not trigger any follow-up scrolling.
    scrollSpy.mockClear();

    rerender(
      <Messages
        items={[
          {
            id: "history-static-1",
            kind: "message",
            role: "user",
            text: "历史消息 1",
          },
          {
            id: "history-static-2",
            kind: "message",
            role: "assistant",
            text: "历史消息 2",
          },
        ]}
        threadId="thread-history-static"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("pins to the bottom after a long streaming tail restores full history", async () => {
    window.localStorage.setItem("ccgui.messages.live.autoFollow", "0");
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const longStreamingItems: ConversationItem[] = [
      {
        id: "streaming-tail-user-latest",
        kind: "message",
        role: "user",
        text: "请继续分析这个长会话",
      },
      ...Array.from({ length: 150 }, (_, index) => ({
        id: `streaming-tail-assistant-${index}`,
        kind: "message" as const,
        role: "assistant" as const,
        text: `长回复片段 ${index}`,
        isFinal: index === 149 ? true : undefined,
      })),
    ];
    const renderMessages = (isThinking: boolean) => (
      <Messages
        items={longStreamingItems}
        threadId="thread-long-streaming-tail-bottom-pin"
        workspaceId="ws-1"
        isThinking={isThinking}
        processingStartedAt={Date.now() - 1_000}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />
    );
    const { container, rerender } = render(renderMessages(true));
    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 0, 2400);

    // Still streaming: the initial bottom pin must stay out of the way.
    expect(scroller.scrollTop).toBe(0);

    rerender(renderMessages(false));

    await waitFor(() => {
      expect(scroller.scrollTop).toBe(2400 - 720);
    });
    scrollSpy.mockRestore();
  });

  it("resets to the revealed history head when expanding collapsed history", async () => {
    const items: ConversationItem[] = Array.from({ length: 32 }, (_, index) => ({
      id: `history-reveal-${index + 1}`,
      kind: "message",
      role: index % 2 === 0 ? "user" : "assistant",
      text: `history reveal message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-history-reveal"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    setScrollerMetrics(
      scroller,
      420,
      () => (container.querySelector(".messages-collapsed-indicator") ? 2400 : 2560),
    );

    const indicator = container.querySelector(".messages-collapsed-indicator");
    expect(indicator).toBeTruthy();
    if (!indicator) {
      return;
    }

    fireEvent.click(indicator);

    await waitFor(() => {
      expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
      expect(screen.getByText("history reveal message 1")).toBeTruthy();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it("reveals collapsed history when clicked during streaming", async () => {
    const items: ConversationItem[] = Array.from({ length: 130 }, (_, index) => ({
      id: `live-history-reveal-${index + 1}`,
      kind: "message",
      role: index % 2 === 0 ? "user" : "assistant",
      text: `live history reveal message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-live-history-reveal"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const indicator = container.querySelector(".messages-collapsed-indicator");
    expect(indicator).toBeTruthy();
    expect(screen.queryByText("live history reveal message 1")).toBeNull();
    if (!indicator) {
      return;
    }

    fireEvent.click(indicator);

    await waitFor(() => {
      expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
      expect(screen.getByText("live history reveal message 1")).toBeTruthy();
    });
  });

  it("keeps manual history expansion stable even when scroller metrics are non-finite", async () => {
    const items: ConversationItem[] = Array.from({ length: 32 }, (_, index) => ({
      id: `history-reveal-invalid-${index + 1}`,
      kind: "message",
      role: index % 2 === 0 ? "user" : "assistant",
      text: `history reveal invalid message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-history-reveal-invalid"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const scroller = getMessagesScroller(container);
    setScrollerMetrics(scroller, 420, Number.NaN);

    const indicator = container.querySelector(".messages-collapsed-indicator");
    expect(indicator).toBeTruthy();
    if (!indicator) {
      return;
    }

    fireEvent.click(indicator);

    await waitFor(() => {
      expect(container.querySelector(".messages-collapsed-indicator")).toBeNull();
      expect(screen.getByText("history reveal invalid message 1")).toBeTruthy();
      expect(scroller.scrollTop).toBe(0);
    });
  });

  it("collapses only the causal process run above assistant prose", () => {
    const items: ConversationItem[] = [
      {
        id: "user-live-collapse",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-live-collapse",
        kind: "reasoning",
        summary: "分析中",
        content: "thinking body",
      },
      {
        id: "tool-live-collapse",
        kind: "tool",
        toolType: "fileRead",
        title: "Read causal.ts",
        detail: "causal.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-live-collapse",
        kind: "message",
        role: "assistant",
        text: "最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const chip = container.querySelector(".messages-process-phase-toggle");
    expect(chip).toBeTruthy();
    expect(chip?.classList.contains("is-collapsed")).toBe(true);
    // Hard-unmount: process body is not in the tree while collapsed.
    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").not.toContain("Read causal.ts");
    expect(container.textContent ?? "").toContain("最终输出");
    expect(container.textContent ?? "").toContain("已处理");
  });

  it("collapses a single process step including lone reasoning into the chip", () => {
    const toolItems: ConversationItem[] = [
      {
        id: "user-single-step",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "tool-single",
        kind: "tool",
        toolType: "fileRead",
        title: "Read single.ts",
        detail: "single.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-single",
        kind: "message",
        role: "assistant",
        text: "单步输出",
      },
    ];

    const { container: toolContainer } = render(
      <Messages
        items={toolItems}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(toolContainer.querySelector(".messages-process-phase-toggle")).toBeTruthy();
    expect(toolContainer.textContent ?? "").toContain("已处理");
    expect(toolContainer.textContent ?? "").not.toContain("Read single.ts");
    expect(toolContainer.textContent ?? "").toContain("单步输出");

    const reasoningItems: ConversationItem[] = [
      {
        id: "user-reason-only",
        kind: "message",
        role: "user",
        text: "你是谁",
      },
      {
        id: "reason-alone",
        kind: "reasoning",
        summary: "分析身份",
        content: "thinking body",
      },
      {
        id: "assistant-reason-only",
        kind: "message",
        role: "assistant",
        text: "我是助手",
      },
    ];

    const { container: reasonContainer } = render(
      <Messages
        items={reasoningItems}
        threadId="thread-2"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(reasonContainer.querySelector(".messages-process-phase-toggle")).toBeTruthy();
    expect(reasonContainer.querySelector(".thinking-block")).toBeNull();
    expect(reasonContainer.textContent ?? "").toContain("已处理");
    expect(reasonContainer.textContent ?? "").toContain("我是助手");
  });

  it("keeps trailing open process expanded after earlier multi-step phase collapsed", () => {
    const items: ConversationItem[] = [
      {
        id: "user-live-trailing",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-done",
        kind: "reasoning",
        summary: "done",
        content: "done-thinking",
      },
      {
        id: "tool-done",
        kind: "tool",
        toolType: "fileRead",
        title: "Read done.ts",
        detail: "done.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-done",
        kind: "message",
        role: "assistant",
        text: "第一段输出",
      },
      {
        id: "tool-running",
        kind: "tool",
        toolType: "fileRead",
        title: "Read running.ts",
        detail: "running.ts",
        status: "running",
        output: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".messages-process-phase-toggle")).toBeTruthy();
    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").not.toContain("Read done.ts");
    expect(container.textContent ?? "").toContain("Read running.ts");
    expect(container.textContent ?? "").toContain("第一段输出");
  });

  it("does not show a phase chip for pure shell noise (pwd/ls stay off canvas)", () => {
    const items: ConversationItem[] = [
      {
        id: "user-live-collapse-commands-only",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "tool-live-collapse-commands-only-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: pwd",
        detail: JSON.stringify({ command: "pwd" }),
        status: "completed",
        output: "/repo",
      },
      {
        id: "tool-live-collapse-commands-only-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls -la",
        detail: JSON.stringify({ command: "ls -la" }),
        status: "completed",
        output: "",
      },
      {
        id: "assistant-live-collapse-commands-only",
        kind: "message",
        role: "assistant",
        text: "最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".messages-live-middle-collapsed-indicator")).toBeNull();
    expect(container.textContent ?? "").toContain("最终输出");
    expect(container.textContent ?? "").not.toContain("pwd");
    expect(container.textContent ?? "").not.toContain("ls -la");
  });

  it("collapses the process phase above historical assistant prose", () => {
    const items: ConversationItem[] = [
      {
        id: "user-history-collapse",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-history-collapse",
        kind: "reasoning",
        summary: "分析中",
        content: "thinking",
      },
      {
        id: "tool-history-collapse",
        kind: "tool",
        toolType: "fileRead",
        title: "Read Messages.tsx",
        detail: "Messages.tsx",
        status: "completed",
        output: "",
        durationMs: 63_000,
      },
      {
        id: "assistant-history-collapse",
        kind: "message",
        role: "assistant",
        text: "历史最终输出",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").not.toContain("Read Messages.tsx");
    expect(container.textContent ?? "").toContain("历史最终输出");
    const indicator = container.querySelector(".messages-process-phase-toggle");
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent ?? "").toContain("已处理");
    expect(indicator?.textContent ?? "").not.toMatch(/\d+m\s*\d+s|\d+s/);
  });

  it("expands one causal phase when its process chip is clicked", async () => {
    const items: ConversationItem[] = [
      {
        id: "user-history-expand",
        kind: "message",
        role: "user",
        text: "请继续",
      },
      {
        id: "reasoning-history-expand",
        kind: "reasoning",
        summary: "expand-me-reasoning",
        content: "expand-me-reasoning-body",
      },
      {
        id: "tool-history-expand",
        kind: "tool",
        toolType: "fileRead",
        title: "Read expand-me.ts",
        detail: "expand-me.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-expand",
        kind: "message",
        role: "assistant",
        text: "展开后可见过程",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".thinking-block")).toBeNull();
    const chip = container.querySelector(
      ".messages-process-phase-toggle",
    ) as HTMLButtonElement | null;
    expect(chip).toBeTruthy();
    expect(chip?.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(chip!);

    await waitFor(() => {
      // Remount on expand (hard-unmount model).
      const expandedChip = container.querySelector(
        ".messages-process-phase-toggle.is-expanded",
      );
      expect(expandedChip).toBeTruthy();
      expect(expandedChip?.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector(".thinking-block")).toBeTruthy();
      expect(container.textContent ?? "").toMatch(/expand-me/);
    });
  });

  it("collapses each historical turn phase independently", () => {
    const items: ConversationItem[] = [
      {
        id: "user-history-turn-1",
        kind: "message",
        role: "user",
        text: "第一个问题",
      },
      {
        id: "reasoning-history-turn-1",
        kind: "reasoning",
        summary: "第一轮分析",
        content: "turn-1-thinking",
      },
      {
        id: "tool-history-turn-1",
        kind: "tool",
        toolType: "fileRead",
        title: "Read turn1.ts",
        detail: "turn1.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-turn-1",
        kind: "message",
        role: "assistant",
        text: "第一轮答案",
      },
      {
        id: "user-history-turn-2",
        kind: "message",
        role: "user",
        text: "第二个问题",
      },
      {
        id: "reasoning-history-turn-2",
        kind: "reasoning",
        summary: "第二轮分析",
        content: "turn-2-thinking",
      },
      {
        id: "tool-history-turn-2",
        kind: "tool",
        toolType: "fileRead",
        title: "Read turn2.ts",
        detail: "turn2.ts",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-history-turn-2",
        kind: "message",
        role: "assistant",
        text: "第二轮答案",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.textContent ?? "").toContain("第一轮答案");
    expect(container.textContent ?? "").toContain("第二轮答案");
    expect(container.querySelectorAll(".messages-process-phase-toggle")).toHaveLength(2);
    expect(container.querySelector(".thinking-block")).toBeNull();
    expect(container.textContent ?? "").not.toContain("Read turn1.ts");
    expect(container.textContent ?? "").not.toContain("Read turn2.ts");
  });

  it("shows non-streaming hint for opencode when waiting long for first chunk", () => {
    vi.useFakeTimers();
    try {
      const items: ConversationItem[] = [
        {
          id: "user-latest",
          kind: "message",
          role: "user",
          text: "请解释一下",
        },
      ];

      const { container } = render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const hint = container.querySelector(".working-hint");
      expect(hint).toBeTruthy();
      const hintText = (hint?.textContent ?? "").trim();
      expect(hintText.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates opencode waiting hint only when heartbeat pulse changes", () => {
    const randomSpy = vi
      .spyOn(Math, "random")
      .mockReturnValueOnce(0.05)
      .mockReturnValueOnce(0.85);
    try {
      const items: ConversationItem[] = [
        {
          id: "user-heartbeat",
          kind: "message",
          role: "user",
          text: "继续",
        },
      ];
      const { container, rerender } = render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      const hint1 = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hint1).toMatch(/(心跳|Heartbeat)\s*1/);

      rerender(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={1}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const hintStable = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hintStable).toBe(hint1);

      rerender(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking
          processingStartedAt={Date.now() - 13_000}
          heartbeatPulse={2}
          activeEngine="opencode"
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );
      const hint2 = container.querySelector(".working-hint")?.textContent ?? "";
      expect(hint2).toMatch(/(心跳|Heartbeat)\s*2/);
      expect(hint2).not.toBe(hint1);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("shows latest backend activity while thinking", () => {
    const items: ConversationItem[] = [
      {
        id: "user-latest-activity",
        kind: "message",
        role: "user",
        text: "帮我检查项目",
      },
      {
        id: "tool-running-activity",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n TODO src",
        detail: "/repo",
        status: "running",
        output: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const activity = container.querySelector(".working-activity");
    expect(activity?.textContent ?? "").toContain("Command: rg -n TODO src @ /repo");
  });

  it("hides duplicated working activity when it mirrors reasoning label", () => {
    const items: ConversationItem[] = [
      {
        id: "user-reasoning-dup-1",
        kind: "message",
        role: "user",
        text: "继续执行",
      },
      {
        id: "reasoning-reasoning-dup-1",
        kind: "reasoning",
        summary: '用户回复了 "A"，表示选择了偏保守重构',
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 3_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    // Pure reasoning turn: spinner + timer + fixed status; no first-line echo in working bar.
    expect(container.querySelector(".working")).toBeTruthy();
    expect(container.querySelector(".working-timer-clock")).toBeTruthy();
    expect(container.querySelector(".working-text")?.textContent ?? "").toContain("响应中");
    expect(container.querySelector(".working-activity")).toBeNull();
    expect(container.querySelector(".thinking-content")?.textContent ?? "").toContain(
      "用户回复了",
    );
  });

  it("does not show stale backend activity from previous turns", () => {
    const items: ConversationItem[] = [
      {
        id: "user-old",
        kind: "message",
        role: "user",
        text: "上一轮",
      },
      {
        id: "tool-old",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: ls -la",
        detail: "/old",
        status: "completed",
        output: "",
      },
      {
        id: "assistant-old",
        kind: "message",
        role: "assistant",
        text: "上一轮结果",
      },
      {
        id: "user-new",
        kind: "message",
        role: "user",
        text: "新一轮问题",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".working-activity")).toBeNull();
  });
});
