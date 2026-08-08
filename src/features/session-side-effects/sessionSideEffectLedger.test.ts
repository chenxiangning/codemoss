import { beforeEach, describe, expect, it } from "vitest";
import type { ConversationItem } from "../../types";
import {
  __resetSessionSideEffectLedgerForTests,
  getSessionSideEffectRecord,
  ingestFileEditsFromConversationItems,
  listLedgerSubagents,
  removeFileEditPaths,
  upsertLedgerSubagent,
} from "./sessionSideEffectLedger";

function fileTool(id: string, path: string): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "fileChange",
    title: "Edit",
    detail: "",
    status: "completed",
    changes: [{ path, diff: "@@ -0,0 +1,2 @@\n+a\n+b\n" }],
  } as ConversationItem;
}

function finalAssistant(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: "done",
    isFinal: true,
  } as ConversationItem;
}

describe("sessionSideEffectLedger", () => {
  beforeEach(() => {
    __resetSessionSideEffectLedgerForTests();
  });

  it("ingests file edits and keeps them when later scan is empty", () => {
    const threadId = "shared:t1";
    const first = ingestFileEditsFromConversationItems({
      threadId,
      mainItems: [finalAssistant("a1"), fileTool("e1", "src/A.ts")],
      threadItemsByThread: {},
    });
    expect(first?.files.some((f) => f.path === "src/A.ts")).toBe(true);

    const second = ingestFileEditsFromConversationItems({
      threadId,
      mainItems: [finalAssistant("a2")],
      threadItemsByThread: {},
    });
    // 空扫描不得抹掉账本
    expect(second?.files.some((f) => f.path === "src/A.ts")).toBe(true);
    expect(getSessionSideEffectRecord(threadId)?.fileEdits.length).toBe(1);
  });

  it("fans in agent-canvas edits into ledger", () => {
    const threadId = "shared:uuid-1";
    const summary = ingestFileEditsFromConversationItems({
      threadId,
      mainItems: [finalAssistant("a1")],
      threadItemsByThread: {
        "agent-canvas:shared:uuid-1:attempt-1": [
          fileTool("e-canvas", "src/B.java"),
        ],
      },
    });
    expect(summary?.files.some((f) => f.path === "src/B.java")).toBe(true);
  });

  it("removes paths after revert", () => {
    const threadId = "shared:t2";
    ingestFileEditsFromConversationItems({
      threadId,
      mainItems: [finalAssistant("a1"), fileTool("e1", "x.ts")],
    });
    removeFileEditPaths(threadId, ["x.ts"]);
    expect(getSessionSideEffectRecord(threadId)?.fileEdits ?? []).toEqual([]);
  });

  it("upserts subagents under parent session", () => {
    upsertLedgerSubagent({
      id: "claude:child-1",
      name: "文档助手",
      parentSessionId: "shared:p1",
      status: "completed",
      updatedAt: 1,
    });
    expect(listLedgerSubagents("shared:p1")).toHaveLength(1);
    expect(listLedgerSubagents("shared:p1")[0]?.name).toBe("文档助手");
  });
});
