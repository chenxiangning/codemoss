import { describe, expect, it } from "vitest";
import { parseGrokHistoryMessages } from "./grokHistoryParser";

describe("parseGrokHistoryMessages", () => {
  it("returns empty items for non-array payloads", () => {
    expect(parseGrokHistoryMessages(null)).toEqual([]);
    expect(parseGrokHistoryMessages({ messages: [] })).toEqual([]);
  });

  it("maps user and assistant messages to conversation items", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "hello",
        images: ["/tmp/demo.png"],
      },
      {
        id: "grok-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "hello",
        images: ["/tmp/demo.png"],
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        id: "grok-assistant-1",
        kind: "message",
        role: "assistant",
        text: "hi",
        isFinal: true,
      }),
    );
  });

  it("strips image-only CLI fallback text and keeps images", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-image-only",
        kind: "message",
        role: "user",
        text: "Please analyze the attached image(s).",
        images: ["/tmp/only.png"],
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-user-image-only",
        kind: "message",
        role: "user",
        text: "",
        images: ["/tmp/only.png"],
      }),
    );
  });

  it("keeps real user text that includes the analyze phrase", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-real",
        kind: "message",
        role: "user",
        text: "Please analyze the attached image(s). Focus on the red box.",
        images: ["/tmp/a.png"],
      },
    ]);

    expect(items[0]).toEqual(
      expect.objectContaining({
        text: "Please analyze the attached image(s). Focus on the red box.",
        images: ["/tmp/a.png"],
      }),
    );
  });

  it("maps reasoning rows and merges adjacent reasoning text", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-1",
        kind: "message",
        role: "user",
        text: "question",
      },
      {
        id: "grok-reasoning-1",
        kind: "reasoning",
        role: "assistant",
        text: "first thought",
      },
      {
        id: "grok-reasoning-2",
        kind: "reasoning",
        role: "assistant",
        text: "second thought",
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[1]).toEqual(
      expect.objectContaining({
        kind: "reasoning",
        content: "first thought\n\nsecond thought",
      }),
    );
  });

  it("attaches tool result rows to the matching tool call", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-tool-1",
        kind: "tool",
        role: "assistant",
        toolType: "write_file",
        title: "write_file",
        toolInput: {
          path: "src/a.ts",
          content: "const a = 1;",
        },
      },
      {
        id: "grok-tool-1-result",
        kind: "tool",
        role: "assistant",
        toolType: "result",
        title: "Result",
        text: "done",
        toolOutput: {
          ok: true,
        },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-tool-1",
        kind: "tool",
        toolType: "fileChange",
        status: "completed",
        output: "done",
      }),
    );
  });

  it("preserves flat Grok tool names for canvas classification", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "call-flat-1",
        kind: "tool",
        role: "assistant",
        toolType: "read_file",
        title: "read_file",
        toolInput: {
          target_file: "src/a.ts",
        },
      },
      {
        id: "call-flat-1-result",
        kind: "tool",
        role: "assistant",
        toolType: "result",
        title: "Result",
        text: "contents",
        toolOutput: "contents",
      },
      {
        id: "call-flat-2",
        kind: "tool",
        role: "assistant",
        toolType: "search_replace",
        title: "search_replace",
        toolInput: {
          target_file: "src/a.ts",
          old_string: "a",
          new_string: "b",
        },
      },
    ]);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "call-flat-1",
        kind: "tool",
        title: "read_file",
        status: "completed",
        output: "contents",
      }),
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        id: "call-flat-2",
        kind: "tool",
        title: "search_replace",
      }),
    );
    // Must not collapse known names into generic Tool
    expect(items.every((item) => item.kind !== "tool" || item.title !== "Tool")).toBe(
      true,
    );
  });

  it("does not infer specialized tool types from command or write substrings", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "call-output-1",
        kind: "tool",
        role: "assistant",
        toolType: "get_command_or_subagent_output",
        title: "get_command_or_subagent_output",
        toolInput: {
          task_ids: ["task-1"],
          timeout_ms: 1000,
        },
      },
      {
        id: "todo-1",
        kind: "tool",
        role: "assistant",
        toolType: "todo_write",
        title: "todo_write",
        toolInput: {
          merge: false,
          todos: [],
        },
      },
      {
        id: "command-1",
        kind: "tool",
        role: "assistant",
        toolType: "run_terminal_command",
        title: "run_terminal_command",
        toolInput: {
          command: "pwd",
          description: "Inspect working directory",
        },
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        id: "call-output-1",
        kind: "tool",
        toolType: "get_command_or_subagent_output",
        title: "get_command_or_subagent_output",
      }),
      expect.objectContaining({
        id: "todo-1",
        kind: "tool",
        toolType: "todo_write",
        title: "todo_write",
      }),
      expect.objectContaining({
        id: "command-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: Inspect working directory",
      }),
    ]);
  });

  it("marks error tool results as failed on the source tool call", () => {
    const items = parseGrokHistoryMessages([
      {
        id: "grok-tool-2",
        kind: "tool",
        role: "assistant",
        toolType: "Grep",
        title: "Grep",
        toolInput: {
          pattern: "foo",
        },
      },
      {
        id: "grok-tool-2-result",
        kind: "tool",
        role: "assistant",
        toolType: "error",
        title: "Error",
        toolOutput: {
          error: "permission denied",
        },
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "grok-tool-2",
        kind: "tool",
        status: "failed",
        output: "permission denied",
      }),
    );
  });

  it("hydrates final completion time and duration from message timestamps", () => {
    const startedAt = "2026-04-01T09:00:00.000Z";
    const completedAt = "2026-04-01T09:00:12.000Z";
    const items = parseGrokHistoryMessages([
      {
        id: "grok-user-timing-1",
        kind: "message",
        role: "user",
        text: "hello",
        timestamp: startedAt,
      },
      {
        id: "grok-assistant-timing-1",
        kind: "message",
        role: "assistant",
        text: "done",
        timestamp: completedAt,
      },
    ]);

    const assistant = items.find(
      (item) => item.kind === "message" && item.role === "assistant",
    );
    expect(assistant).toEqual(
      expect.objectContaining({
        isFinal: true,
        finalCompletedAt: Date.parse(completedAt),
        finalDurationMs: 12_000,
      }),
    );
  });
});
