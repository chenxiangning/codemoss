import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import {
  collectRunStatusSourceItems,
  collectRunStatusSubagentSourceItems,
} from "./collectRunStatusSourceItems";

function tool(id: string, path: string): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "fileChange",
    title: "Edit",
    detail: "",
    status: "completed",
    changes: [{ path, diff: "@@\n+line\n" }],
  } as ConversationItem;
}

function msg(
  id: string,
  role: "user" | "assistant",
  text: string,
): ConversationItem {
  return {
    id,
    kind: "message",
    role,
    text,
    isFinal: role === "assistant",
  } as ConversationItem;
}

describe("collectRunStatusSourceItems", () => {
  it("returns main items when no agent-canvas extras", () => {
    const main = [msg("u1", "user", "hi"), tool("t1", "a.ts")];
    const out = collectRunStatusSourceItems({
      mainItems: main,
      activeThreadId: "shared:abc",
      threadItemsByThread: {},
    });
    expect(out).toBe(main);
  });

  it("fans in only agent-canvas for the active shared session", () => {
    const main = [msg("u1", "user", "task")];
    const canvasItems = [tool("edit-1", "src/A.java")];
    const out = collectRunStatusSourceItems({
      mainItems: main,
      activeThreadId: "shared:uuid-1",
      threadItemsByThread: {
        "agent-canvas:shared:uuid-1:attempt-aa": canvasItems,
        "agent-canvas:shared:other:attempt-bb": [tool("x", "nope.ts")],
        "claude:child-1": [tool("child", "c.ts")],
      },
    });
    expect(out.some((i) => i.id === "edit-1")).toBe(true);
    expect(out.some((i) => i.id === "x")).toBe(false);
    // 子会话不并入（留给 useStatusPanelData 原路径）
    expect(out.some((i) => i.id === "child")).toBe(false);
  });

  it("dedupes by item id", () => {
    const sharedTool = tool("same", "c.ts");
    const out = collectRunStatusSourceItems({
      mainItems: [sharedTool],
      activeThreadId: "shared:p",
      threadItemsByThread: {
        "agent-canvas:shared:p:a1": [sharedTool],
      },
    });
    expect(out.filter((i) => i.id === "same")).toHaveLength(1);
  });

  it("does not mutate mainItems reference when empty extras", () => {
    const main = [msg("u1", "user", "x")];
    const out = collectRunStatusSourceItems({
      mainItems: main,
      activeThreadId: "shared:p",
      threadItemsByThread: {
        "agent-canvas:shared:other:a": [tool("z", "z.ts")],
      },
    });
    expect(out).toBe(main);
  });
});

describe("collectRunStatusSubagentSourceItems", () => {
  function agentTool(id: string, description: string): ConversationItem {
    return {
      id,
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({ description, subagent_type: "general-purpose" }),
      status: "completed",
    } as ConversationItem;
  }

  it("fans in subagent tools from the active shared session agent-canvas", () => {
    const main = [msg("u1", "user", "启动子代理")];
    const out = collectRunStatusSubagentSourceItems({
      mainItems: main,
      activeThreadId: "shared:uuid-1",
      threadItemsByThread: {
        "agent-canvas:shared:uuid-1:attempt-aa": [
          agentTool("spawn-1", "子代理1号"),
          agentTool("spawn-2", "子代理2号"),
        ],
        "agent-canvas:shared:uuid-1:attempt-bb": [
          agentTool("spawn-3", "子代理3号"),
        ],
      },
    });
    expect(out.some((i) => i.id === "spawn-1")).toBe(true);
    expect(out.some((i) => i.id === "spawn-3")).toBe(true);
  });

  it("ignores other sessions, non-subagent tools and child threads", () => {
    const main = [msg("u1", "user", "x")];
    const out = collectRunStatusSubagentSourceItems({
      mainItems: main,
      activeThreadId: "shared:uuid-1",
      threadItemsByThread: {
        "agent-canvas:shared:other:attempt": [agentTool("s-other", "别的")],
        "agent-canvas:shared:uuid-1:attempt": [tool("edit-1", "a.ts")],
        "grok:child-1": [agentTool("s-child", "子代理")],
      },
    });
    expect(out.some((i) => i.id === "s-other")).toBe(false);
    expect(out.some((i) => i.id === "edit-1")).toBe(false);
    expect(out.some((i) => i.id === "s-child")).toBe(false);
    expect(out).toBe(main);
  });

  it("dedupes by item id and keeps main reference when no extras", () => {
    const shared = agentTool("same", "dup");
    const out = collectRunStatusSubagentSourceItems({
      mainItems: [shared],
      activeThreadId: "shared:p",
      threadItemsByThread: {
        "agent-canvas:shared:p:a1": [shared],
      },
    });
    expect(out.filter((i) => i.id === "same")).toHaveLength(1);

    const bare = [msg("u1", "user", "y")];
    expect(
      collectRunStatusSubagentSourceItems({
        mainItems: bare,
        activeThreadId: "shared:p",
        threadItemsByThread: {
          "agent-canvas:shared:other:a": [agentTool("z", "z")],
        },
      }),
    ).toBe(bare);
  });
});
