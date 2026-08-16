/**
 * 回归：S10 合成 tool 必须进入 useStatusPanelData 扫得到的 itemsByThread 槽位。
 */
import { describe, expect, it } from "vitest";
import { enrichTimelineWithSyntheticSubagentsBeforeCollapse } from "@mossx/plugin-subagent-ui/runtime";
import { collectScopedToolEntries } from "@mossx/plugin-status/runtime";
import type { ConversationItem, ThreadSummary } from "../../../../types";

function userMsg(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "user",
    text: "启动子代理",
  } as ConversationItem;
}

function assistantFinal(id: string): ConversationItem {
  return {
    id,
    kind: "message",
    role: "assistant",
    text: "done",
    isFinal: true,
  } as ConversationItem;
}

describe("run-status subagent wire (S10 synthetic → scoped entries)", () => {
  it("puts synthetic spawn tools into activeThread itemsByThread slot", () => {
    const sharedId = "shared:sess-1";
    const children: ThreadSummary[] = [
      {
        id: "claude:subagent:owner:a1",
        name: "问候 1 号",
        updatedAt: 1,
        engineSource: "claude",
        parentThreadId: sharedId,
      },
      {
        id: "claude:subagent:owner:a2",
        name: "问候 2 号",
        updatedAt: 1,
        engineSource: "claude",
        parentThreadId: sharedId,
      },
    ];
    const mainItems = [userMsg("u1"), assistantFinal("a1")];
    const enriched = enrichTimelineWithSyntheticSubagentsBeforeCollapse({
      items: mainItems,
      ownThreadId: sharedId,
      canvasThreadId: sharedId,
      activeEngine: "claude",
      childThreads: children,
      itemsByThread: {},
    });
    // 应注入 2 条 synthetic spawn
    const syntheticTools = enriched.filter(
      (i) => i.kind === "tool" && String(i.id).startsWith("synthetic-"),
    );
    expect(syntheticTools.length).toBe(2);

    // 模拟 Composer：写回 itemsByThread[active]
    const itemsByThread = { [sharedId]: enriched };
    const scoped = collectScopedToolEntries(enriched, {
      activeThreadId: sharedId,
      itemsByThread,
      threadParentById: {
        "claude:subagent:owner:a1": sharedId,
        "claude:subagent:owner:a2": sharedId,
      },
    });
    expect(scoped.entries.length).toBeGreaterThanOrEqual(2);
    expect(
      scoped.entries.every(({ item }) => item.kind === "tool"),
    ).toBe(true);
  });

  it("does not inject when no child threads (same as S10 eligibility)", () => {
    const sharedId = "shared:sess-2";
    const enriched = enrichTimelineWithSyntheticSubagentsBeforeCollapse({
      items: [userMsg("u1")],
      ownThreadId: sharedId,
      canvasThreadId: sharedId,
      activeEngine: "claude",
      childThreads: [],
    });
    expect(enriched.filter((i) => i.kind === "tool")).toHaveLength(0);
  });
});
