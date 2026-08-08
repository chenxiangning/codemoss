// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  collectScopedToolEntries,
  getFallbackParentById,
  useStatusPanelData,
} from "./useStatusPanelData";

function createCollabTool(
  id: string,
  detail: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "collabToolCall",
    title: "Collab: spawn_agent",
    detail,
    status: "completed",
    receiverThreadIds: ["agent-7"],
  };
}

function createTodoTool(
  id: string,
  content: string,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "todo",
    title: "Tool: TodoWrite",
    detail: JSON.stringify({
      todos: [{ content, status: "in_progress" }],
    }),
    status: "completed",
  };
}

function createTaskTool(
  id: string,
  args: Record<string, unknown>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "task",
    title: "Tool: Task",
    detail: JSON.stringify(args),
    output: "Task output",
    status: "completed",
  };
}

describe("useStatusPanelData helpers", () => {
  it("caches fallback parent derivation by itemsByThread identity", () => {
    const itemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-1", "From thread-root -> agent-7")],
      "agent-7": [],
    };

    const first = getFallbackParentById(itemsByThread);
    const second = getFallbackParentById(itemsByThread);

    expect(first).toBe(second);
    expect(first["agent-7"]).toBe("thread-root");
  });

  it("rebuilds fallback parent derivation when itemsByThread identity changes", () => {
    const firstItemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-1", "From thread-root -> agent-7")],
    };
    const secondItemsByThread: Record<string, ConversationItem[]> = {
      root: [createCollabTool("spawn-2", "From thread-root -> agent-8")],
    };

    expect(getFallbackParentById(firstItemsByThread)).not.toBe(
      getFallbackParentById(secondItemsByThread),
    );
    expect(getFallbackParentById(secondItemsByThread)["agent-8"]).toBe(
      "thread-root",
    );
  });

  it("collects only active root subtree tool entries", () => {
    const rootTool = createCollabTool("spawn-1", "From root -> agent-7");
    const childTool = createCollabTool("wait-1", "From root -> agent-7");
    const unrelatedTool = createCollabTool("spawn-2", "From other -> agent-x");
    const entries = collectScopedToolEntries([childTool], {
      activeThreadId: "agent-7",
      itemsByThread: {
        root: [rootTool],
        "agent-7": [childTool],
        other: [unrelatedTool],
      },
      threadParentById: {
        "agent-7": "root",
      },
    });

    expect(entries.rootThreadId).toBe("root");
    expect(entries.entries.map((entry) => entry.item.id).sort()).toEqual([
      "spawn-1",
      "wait-1",
    ]);
  });

  it("defers status summary inputs during active typing and converges after idle", () => {
    const firstItems = [createTodoTool("todo-1", "old todo")];
    const nextItems = [createTodoTool("todo-2", "new todo")];
    const { result, rerender } = renderHook(
      ({
        items,
        deferSummary,
      }: {
        items: ConversationItem[];
        deferSummary: boolean;
      }) => useStatusPanelData(items, { deferSummary }),
      {
        initialProps: {
          items: firstItems,
          deferSummary: false,
        },
      },
    );

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "old todo",
    ]);

    rerender({
      items: nextItems,
      deferSummary: true,
    });

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "old todo",
    ]);

    rerender({
      items: nextItems,
      deferSummary: false,
    });

    expect(result.current.todos.map((todo) => todo.content)).toEqual([
      "new todo",
    ]);
  });

  it("attributes subagent task output to the real active engine instead of a binary fallback", () => {
    const taskTool = createTaskTool("task-tool-1", {
      task_id: "task-123",
      description: "Review task",
    });

    const { result } = renderHook(() =>
      useStatusPanelData([taskTool], {
        activeEngine: "kimi",
      }),
    );

    const taskSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "task-tool-1",
    );

    expect(taskSubagent?.taskOutput?.engine).toBe("kimi");
  });

  it("falls back to the legacy codex-or-claude boolean when no real engine is provided", () => {
    const taskTool = createTaskTool("task-tool-1", {
      task_id: "task-123",
      description: "Review task",
    });

    const { result } = renderHook(() =>
      useStatusPanelData([taskTool], {
        isCodexEngine: true,
      }),
    );

    const taskSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "task-tool-1",
    );

    expect(taskSubagent?.taskOutput?.engine).toBe("codex");
  });

  it("keeps task and collab subagent navigation targets correct after scoped caching", () => {
    const taskTool = createTaskTool("task-tool-1", {
      task_id: "task-123",
      description: "Review task",
    });
    const spawnTool = createCollabTool("spawn-1", "From root -> agent-7");
    const childTool = createCollabTool("wait-1", "From root -> agent-7");

    const { result } = renderHook(() =>
      useStatusPanelData([taskTool], {
        isCodexEngine: true,
        activeThreadId: "agent-7",
        itemsByThread: {
          root: [taskTool, spawnTool],
          "agent-7": [childTool],
        },
        threadParentById: {
          "agent-7": "root",
        },
        threadStatusById: {
          "agent-7": { isProcessing: true },
        },
      }),
    );

    const taskSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "task-tool-1",
    );
    const collabSubagent = result.current.subagents.find(
      (subagent) => subagent.id === "agent-7",
    );

    expect(taskSubagent?.taskOutput).toMatchObject({
      toolUseId: "task-tool-1",
      taskId: "task-123",
      recentOutput: "Task output",
    });
    expect(taskSubagent?.navigationTarget).toBeNull();
    expect(collabSubagent?.status).toBe("running");
    expect(collabSubagent?.taskOutput).toMatchObject({
      threadId: "agent-7",
      toolUseId: "wait-1",
    });
    expect(collabSubagent?.navigationTarget).toEqual({
      kind: "thread",
      threadId: "agent-7",
    });
  });

  it("seeds Codex Agents from child tree when wait collab has no receiver ids", () => {
    const waitTool: ConversationItem = {
      id: "wait-1",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: wait",
      detail: "",
      status: "running",
      // no receiverThreadIds — live wait 残缺
    };

    const { result } = renderHook(() =>
      useStatusPanelData([waitTool], {
        isCodexEngine: true,
        activeEngine: "codex",
        activeThreadId: "parent-root",
        itemsByThread: {
          "parent-root": [waitTool],
          "agent-a": [],
          "agent-b": [],
        },
        threadParentById: {
          "agent-a": "parent-root",
          "agent-b": "parent-root",
        },
        threadStatusById: {
          "agent-a": { isProcessing: true },
          "agent-b": { isProcessing: false },
        },
      }),
    );

    expect(result.current.subagentTotal).toBe(2);
    expect(result.current.subagents.map((entry) => entry.id).sort()).toEqual([
      "agent-a",
      "agent-b",
    ]);
    expect(
      result.current.subagents.find((entry) => entry.id === "agent-a")?.status,
    ).toBe("running");
  });

  it("seeds child-tree subagents for non-Codex engines when tool scan is empty", () => {
    // Claude/Grok/Shared：主线无 task-like tool 时仍应用 parent→child 补 Strip
    const { result } = renderHook(() =>
      useStatusPanelData([], {
        isCodexEngine: false,
        activeEngine: "claude",
        activeThreadId: "parent-root",
        itemsByThread: {
          "parent-root": [],
          "child-1": [],
        },
        threadParentById: {
          "child-1": "parent-root",
        },
      }),
    );

    expect(result.current.subagentTotal).toBe(1);
    expect(result.current.subagents[0]?.id).toBe("child-1");
  });

  it("uses S10-wide isSubagentTool for description-as-title history tools", () => {
    // Shared/历史：title 是问候文案，payload 才带 subagent_type
    const payloadTool: ConversationItem = {
      id: "spawn-hist-1",
      kind: "tool",
      toolType: "toolCall",
      title: "问候测试代理1",
      detail: JSON.stringify({
        description: "问候测试代理1",
        subagent_type: "general-purpose",
        subagent_id: "agent-hist-1",
      }),
      status: "completed",
      output: "Subagent completed.",
    };

    const { result } = renderHook(() =>
      useStatusPanelData([payloadTool], {
        isCodexEngine: false,
        activeEngine: "claude",
        activeThreadId: "shared:session-1",
      }),
    );

    expect(result.current.subagentTotal).toBe(1);
    // 应用 payload 内 subagent_id，禁止用 tool 行 id（否则 inspector 无法 load 子会话）
    expect(result.current.subagents[0]?.id).toBe("agent-hist-1");
    expect(result.current.subagents[0]?.taskOutput?.threadId).toBe("agent-hist-1");
    expect(result.current.subagents[0]?.description).toContain("问候");
  });

  it("seeds from childSubagentThreadIds when parent map is empty (S10 canvas children)", () => {
    const { result } = renderHook(() =>
      useStatusPanelData([], {
        isCodexEngine: false,
        activeEngine: "claude",
        activeThreadId: "shared:abc",
        itemsByThread: {
          "shared:abc": [],
          "claude:subagent:owner:agent-9": [],
        },
        threadParentById: {},
        childSubagentThreadIds: ["claude:subagent:owner:agent-9"],
      }),
    );

    expect(result.current.subagentTotal).toBe(1);
    expect(result.current.subagents[0]?.id).toBe("claude:subagent:owner:agent-9");
  });
});
