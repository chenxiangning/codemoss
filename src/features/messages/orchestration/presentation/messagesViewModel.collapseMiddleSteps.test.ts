import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../../types";
import {
  resolveCollapsedTimelineItems,
  resolveVisibleMessageItems,
} from "./messagesViewModel";
import { parseReasoning } from "../../presentation/messagesReasoning";

function user(id: string, text = "你好"): ConversationItem {
  return { id, kind: "message", role: "user", text };
}

function assistant(id: string, text: string): ConversationItem {
  return { id, kind: "message", role: "assistant", text };
}

function reasoning(id: string, content = "thinking"): ConversationItem {
  return { id, kind: "reasoning", summary: content, content };
}

function tool(
  id: string,
  status: "running" | "completed" = "completed",
  durationMs?: number,
): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "fileRead",
    title: "Read foo.ts",
    detail: "foo.ts",
    status,
    output: "",
    durationMs,
  };
}

/** Pure shell noise (not cat/rg/file-IO) — canvas-hidden but used to interrupt merge if left in list. */
function bashTool(id: string, command = "cargo check"): ConversationItem {
  return {
    id,
    kind: "tool",
    toolType: "commandExecution",
    title: `Command: ${command}`,
    detail: command,
    status: "completed",
    output: "",
  };
}

function reasoningMetaMap(items: ConversationItem[]) {
  const map = new Map<string, ReturnType<typeof parseReasoning>>();
  for (const item of items) {
    if (item.kind === "reasoning") {
      map.set(item.id, parseReasoning(item));
    }
  }
  return map;
}

describe("resolveCollapsedTimelineItems causal phase collapse", () => {
  it("keeps full process visible while tools are still running before any assistant text", () => {
    const items = [user("u1"), reasoning("r1"), tool("t1", "running")];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "r1", "t1"]);
  });

  it("collapses only the process run immediately above assistant prose when count > 1", () => {
    const items = [
      user("u1"),
      reasoning("r1"),
      tool("t1", "completed", 1_000),
      assistant("a1", "最终结论"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    // Hard-unmount: process rows leave the timeline when collapsed.
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]).toMatchObject({
      phaseKey: "a1",
      insertBeforeItemId: "r1",
      assistantItemId: "a1",
      expanded: false,
      durationMs: 1_000,
      breakdown: { reasoningCount: 1, toolCount: 1, exploreCount: 0 },
    });
    expect(result.phases[0]!.count).toBeGreaterThan(1);
    expect(result.phases[0]!.hiddenItemIds).toEqual(["r1", "t1"]);
  });

  it("folds Agent/Task subagent tools into the process phase chip when collapsed", () => {
    const agentTool: ConversationItem = {
      id: "agent-1",
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({ description: "并行排查", subagent_type: "explore" }),
      status: "completed",
    };
    const items: ConversationItem[] = [
      user("u1"),
      reasoning("r1"),
      tool("t1", "completed", 500),
      agentTool,
      assistant("a1", "最终结论"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });
    // reasoning + read + Agent 一并折叠；收起后幕布只剩 user + assistant（chip 在投影层）
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]?.hiddenItemIds).toEqual(["r1", "t1", "agent-1"]);
    expect(result.phases[0]?.hiddenItemIds).toContain("agent-1");
  });

  it("remounts Agent/Task subagent tools inside the phase when expanded", () => {
    const agentTool: ConversationItem = {
      id: "agent-1",
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({ description: "并行排查", subagent_type: "explore" }),
      status: "completed",
    };
    const items: ConversationItem[] = [
      user("u1"),
      reasoning("r1"),
      tool("t1", "completed", 500),
      agentTool,
      assistant("a1", "最终结论"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
      expandedPhaseKeys: new Set(["a1"]),
    });
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "r1",
      "t1",
      "agent-1",
      "a1",
    ]);
    expect(result.phases[0]?.expanded).toBe(true);
    expect(result.phases[0]?.hiddenItemIds).toContain("agent-1");
  });

  it("collapses a single process step including lone reasoning into the chip", () => {
    const toolOnly = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: [user("u1"), tool("t1"), assistant("a1", "最终结论")],
    });
    expect(toolOnly.phases).toHaveLength(1);
    expect(toolOnly.phases[0]).toMatchObject({
      phaseKey: "a1",
      count: 1,
      breakdown: { reasoningCount: 0, toolCount: 1, exploreCount: 0 },
      hiddenItemIds: ["t1"],
      expanded: false,
    });
    expect(toolOnly.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);

    // Shared/Native simple Q&A: reasoning only → "已处理 · 思考 1 次", no orphan 思考过程 row.
    const reasoningOnly = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: [
        user("u2", "你是谁"),
        reasoning("r-alone"),
        assistant("a2", "我是助手"),
      ],
    });
    expect(reasoningOnly.phases).toHaveLength(1);
    expect(reasoningOnly.phases[0]).toMatchObject({
      phaseKey: "a2",
      count: 1,
      breakdown: { reasoningCount: 1, toolCount: 0, exploreCount: 0 },
      hiddenItemIds: ["r-alone"],
      expanded: false,
    });
    expect(reasoningOnly.timelineItems.map((item) => item.id)).toEqual(["u2", "a2"]);
  });

  it("merges the whole user-turn process onto the final assistant (no orphan)", () => {
    const items: ConversationItem[] = [
      user("u1"),
      tool("t1"),
      assistant("a1", "第一段"),
      {
        id: "t2",
        kind: "tool",
        toolType: "fileRead",
        title: "Read a.ts",
        detail: "a.ts",
        status: "completed",
        output: "",
      },
      {
        id: "t3",
        kind: "tool",
        toolType: "toolCall",
        title: "Tool: Grep",
        detail: "pattern",
        status: "completed",
        output: "",
      },
      assistant("a2", "第二段"),
      tool("t4", "running"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    // Turn-final ownership (fig3): t1+t2+t3 fold into a2; a1 plan text stays;
    // trailing t4 (no following prose) stays live.
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "a1",
      "a2",
      "t4",
    ]);
    expect(result.phases.map((phase) => phase.phaseKey)).toEqual(["a2"]);
    expect(result.phases[0]!.hiddenItemIds).toEqual(["t1", "t2", "t3"]);
    expect(result.phases[0]!.count).toBeGreaterThanOrEqual(2);
  });

  it("absorbs leading orphan reasoning across mid-turn assistant plan text", () => {
    // Native Claude/Grok stream shape (fig1/fig2):
    //   reasoning → assistant(plan) → tools/reasoning → assistant(final)
    // Shared history already projects process-before-prose (fig3) without the orphan.
    const items = [
      user("u1", "简单项目分析"),
      reasoning("r-orphan"),
      assistant("a-plan", "先做快速项目体检：读入口文档与目录结构。"),
      reasoning("r2"),
      tool("t1", "completed", 100),
      tool("t2", "completed", 200),
      assistant("a-final", "mossx / ccgui - 简单项目分析"),
    ];
    const collapsed = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(collapsed.phases).toHaveLength(1);
    expect(collapsed.phases[0]).toMatchObject({
      phaseKey: "a-final",
      insertBeforeItemId: "r-orphan",
      expanded: false,
      breakdown: { reasoningCount: 2, toolCount: 2, exploreCount: 0 },
    });
    expect(collapsed.phases[0]!.hiddenItemIds).toEqual([
      "r-orphan",
      "r2",
      "t1",
      "t2",
    ]);
    // Orphan reasoning + tools leave the surface; plan + final stay.
    expect(collapsed.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "a-plan",
      "a-final",
    ]);
    expect(collapsed.timelineItems.some((item) => item.id === "r-orphan")).toBe(
      false,
    );

    const expanded = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      expandedPhaseKeys: new Set(["a-final"]),
      timelineSourceItems: items,
    });
    expect(expanded.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "r-orphan",
      "a-plan",
      "r2",
      "t1",
      "t2",
      "a-final",
    ]);
  });

  it("does not collapse when assistant message exists but text is still empty", () => {
    const items = [user("u1"), tool("t1"), assistant("a1", "   ")];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "t1", "a1"]);
  });

  it("remounts the turn-final phase when expanded", () => {
    const items: ConversationItem[] = [
      user("u1"),
      reasoning("r1"),
      tool("t1"),
      assistant("a1", "计划说明"),
      reasoning("r2"),
      tool("t2"),
      assistant("a2", "最终结论"),
    ];
    const collapsed = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });
    // Single turn-final phase on a2 owns r1/t1/r2/t2; a1 stays as plan text.
    expect(collapsed.phases.map((phase) => phase.phaseKey)).toEqual(["a2"]);
    expect(collapsed.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "a1",
      "a2",
    ]);

    const expanded = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      expandedPhaseKeys: new Set(["a2"]),
      timelineSourceItems: items,
    });
    expect(expanded.phases.find((phase) => phase.phaseKey === "a2")?.expanded).toBe(
      true,
    );
    expect(expanded.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "r1",
      "t1",
      "a1",
      "r2",
      "t2",
      "a2",
    ]);
  });

  it("strips pure shell noise and skips empty noise-only phases", () => {
    const items = [
      user("u1"),
      {
        id: "cmd-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: pwd",
        detail: JSON.stringify({ command: "pwd" }),
        status: "completed" as const,
        output: "/repo",
      },
      {
        id: "cmd-2",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: ls -la",
        detail: JSON.stringify({ command: "ls -la" }),
        status: "completed" as const,
        output: "",
      },
      assistant("a1", "最终输出"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "codex",
      timelineSourceItems: items,
    });

    // Pure shell noise leaves the canvas entirely — no chip, no remount on expand.
    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
  });

  it("collapses file-read process only and excludes pure shell from chip counts", () => {
    const items = [
      user("u1"),
      {
        id: "cmd-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: ls -la",
        detail: JSON.stringify({ command: "ls -la" }),
        status: "completed" as const,
        output: "",
      },
      {
        id: "read-1",
        kind: "tool" as const,
        toolType: "mcpToolCall",
        title: "Read README.md",
        detail: JSON.stringify({ path: "README.md" }),
        status: "completed" as const,
        output: "hello",
      },
      {
        id: "read-2",
        kind: "tool" as const,
        toolType: "mcpToolCall",
        title: "Read package.json",
        detail: JSON.stringify({ path: "package.json" }),
        status: "completed" as const,
        output: "{}",
      },
      assistant("a1", "最终输出"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "codex",
      timelineSourceItems: items,
    });

    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]).toMatchObject({
      phaseKey: "a1",
      expanded: false,
      breakdown: { reasoningCount: 0, toolCount: 2, exploreCount: 0 },
    });
    expect(result.phases[0]!.hiddenItemIds).toEqual(["read-1", "read-2"]);
    expect(result.phases[0]!.hiddenItemIds).not.toContain("cmd-1");
  });

  it("keeps Codex shell-form cat/apply_patch on canvas and collapses them as file IO", () => {
    const patch =
      "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-old\n+new\n*** End Patch\n";
    const items = [
      user("u1"),
      {
        id: "cat-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: cat README.md",
        detail: JSON.stringify({ command: ["cat", "README.md"] }),
        status: "completed" as const,
        output: "# Hello\n",
      },
      {
        id: "patch-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: apply_patch",
        detail: JSON.stringify({ command: `apply_patch <<'EOF'\n${patch}EOF` }),
        status: "completed" as const,
        output: "Success. Updated the following files:\nM src/a.ts",
      },
      {
        id: "noise-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: pwd",
        detail: JSON.stringify({ command: "pwd" }),
        status: "completed" as const,
        output: "/repo\n",
      },
      assistant("a1", "最终输出"),
    ];
    const collapsed = resolveCollapsedTimelineItems({
      activeEngine: "codex",
      timelineSourceItems: items,
    });

    // pwd noise filtered; cat + apply_patch remain as collapsible process.
    expect(collapsed.phases).toHaveLength(1);
    expect(collapsed.phases[0]!.count).toBeGreaterThanOrEqual(2);
    expect(collapsed.phases[0]!.breakdown.toolCount).toBeGreaterThanOrEqual(2);
    expect(collapsed.phases[0]!.hiddenItemIds).toContain("cat-1");
    expect(collapsed.phases[0]!.hiddenItemIds).not.toContain("noise-1");
    // When collapsed only user + assistant remain on timeline.
    expect(collapsed.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);

    // Expand must remount file-IO process rows (not an empty chip body).
    const expanded = resolveCollapsedTimelineItems({
      activeEngine: "codex",
      expandedPhaseKeys: new Set(["a1"]),
      timelineSourceItems: items,
    });
    expect(expanded.phases[0]?.expanded).toBe(true);
    const expandedIds = expanded.timelineItems.map((item) => item.id);
    expect(expandedIds).toContain("cat-1");
    expect(expandedIds).not.toContain("noise-1");
    expect(expandedIds).toContain("a1");
  });

  it("collapses multi-step phases that include command tools and counts them in breakdown", () => {
    const items = [
      user("u1"),
      reasoning("r1"),
      {
        id: "cmd-1",
        kind: "tool" as const,
        toolType: "commandExecution" as const,
        title: "Command: rg --files",
        detail: "/tmp",
        status: "completed" as const,
        output: "",
        durationMs: 400,
      },
      assistant("a1", "最终输出"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]).toMatchObject({
      phaseKey: "a1",
      expanded: false,
      breakdown: { reasoningCount: 1, toolCount: 1, exploreCount: 0 },
      durationMs: 400,
    });
    expect(result.phases[0]!.hiddenItemIds).toEqual(["r1", "cmd-1"]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
  });
});

describe("resolveVisibleMessageItems / collapse after hidden shell tools", () => {
  it("merges reasoning runs that only look adjacent after pure shell tools are filtered", () => {
    const items: ConversationItem[] = [
      reasoning("r1", "Need handleUnstageRepositoryAll in layout"),
      bashTool("bash-1", "pwd"),
      reasoning("r2", "Need handleUnstageRepositoryFiles in app-shell"),
      bashTool("bash-2", "cargo check"),
      reasoning("r3", "Cargo is in src-tauri"),
    ];

    const visible = resolveVisibleMessageItems({
      items,
      activeEngine: "claude",
      hideClaudeReasoning: false,
      latestTitleOnlyReasoningId: null,
      presentationProfile: null,
      reasoningMetaById: reasoningMetaMap(items),
    });

    const reasoningRows = visible.filter((item) => item.kind === "reasoning");
    expect(reasoningRows).toHaveLength(1);
    expect(visible.some((item) => item.kind === "tool")).toBe(false);
    if (reasoningRows[0]?.kind === "reasoning") {
      expect(reasoningRows[0].content).toContain("handleUnstageRepositoryAll");
      expect(reasoningRows[0].content).toContain("handleUnstageRepositoryFiles");
      expect(reasoningRows[0].content).toContain("src-tauri");
    }
  });

  it("keeps reasoning split when a visible file tool interrupts the run", () => {
    const items: ConversationItem[] = [
      reasoning("r1", "先读文件"),
      tool("read-1"),
      reasoning("r2", "再继续分析"),
    ];

    const visible = resolveVisibleMessageItems({
      items,
      activeEngine: "claude",
      hideClaudeReasoning: false,
      latestTitleOnlyReasoningId: null,
      presentationProfile: null,
      reasoningMetaById: reasoningMetaMap(items),
    });

    expect(visible.map((item) => item.kind)).toEqual([
      "reasoning",
      "tool",
      "reasoning",
    ]);
  });

  it("merges shell-separated reasoning on expanded completed timeline", () => {
    const items: ConversationItem[] = [
      user("u1"),
      reasoning("r1", "段一"),
      bashTool("bash-1"),
      reasoning("r2", "段二"),
      bashTool("bash-2"),
      reasoning("r3", "段三"),
      assistant("a1", "最终结论"),
    ];

    const expanded = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      expandedPhaseKeys: new Set(["a1"]),
      timelineSourceItems: items,
    });

    const reasoningRows = expanded.timelineItems.filter(
      (item) => item.kind === "reasoning",
    );
    expect(reasoningRows).toHaveLength(1);
    if (reasoningRows[0]?.kind === "reasoning") {
      expect(reasoningRows[0].content).toContain("段一");
      expect(reasoningRows[0].content).toContain("段二");
      expect(reasoningRows[0].content).toContain("段三");
    }
    // Shell stays off canvas even when phase is expanded.
    expect(expanded.timelineItems.some((item) => item.id.startsWith("bash-"))).toBe(
      false,
    );
    // Chip counts one merged thinking run, not three fragments.
    expect(expanded.phases[0]?.breakdown.reasoningCount).toBe(1);
  });
});

describe("resolveCollapsedTimelineItems trailing live window", () => {
  it("keeps trailing process fully expanded at the threshold boundary", () => {
    // 5 张卡（工具与思考交错，均不成组）→ 不触发折叠。
    const items = [
      user("u1"),
      tool("t1"),
      reasoning("r1"),
      tool("t2"),
      reasoning("r2"),
      tool("t3"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "t1",
      "r1",
      "t2",
      "r2",
      "t3",
    ]);
  });

  it("counts a consecutive batch card as one entry, not by its inner nodes", () => {
    // 6 个连续 fileRead 合并成 1 张「批量读取」卡 → 卡数未超阈值，不折叠。
    const items = [
      user("u1"),
      tool("t1"),
      tool("t2"),
      tool("t3"),
      tool("t4"),
      tool("t5"),
      tool("t6"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toEqual([]);
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
      "t6",
    ]);
  });

  it("folds older trailing cards into a chip and keeps the last 3 cards visible", () => {
    // 6 张卡 > 阈值 5 → 折叠前 3 张，保留末尾 3 张。
    const items = [
      user("u1"),
      tool("t1"),
      reasoning("r1"),
      tool("t2"),
      reasoning("r2"),
      tool("t3"),
      reasoning("r3"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toHaveLength(1);
    const phase = result.phases[0];
    expect(phase?.phaseKey).toBe("trailing:u1");
    expect(phase?.expanded).toBe(false);
    expect(phase?.hiddenItemIds).toEqual(["t1", "r1", "t2"]);
    expect(phase?.count).toBe(3);
    expect(phase?.collapsedAnchorItemId).toBe("r2");
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "r2",
      "t3",
      "r3",
    ]);
  });

  it("folds a whole batch card as one hidden entry when the window trips", () => {
    // 批量读取卡(3 节点) + 6 张单卡 = 7 张卡 → 批量卡整体进 chip。
    const items = [
      user("u1"),
      tool("batch-1"),
      tool("batch-2"),
      tool("batch-3"),
      reasoning("r0"),
      tool("t1"),
      reasoning("r1"),
      tool("t2"),
      reasoning("r2"),
      tool("t3"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toHaveLength(1);
    const phase = result.phases[0];
    expect(phase?.hiddenItemIds).toEqual([
      "batch-1",
      "batch-2",
      "batch-3",
      "r0",
      "t1",
      "r1",
    ]);
    expect(phase?.collapsedAnchorItemId).toBe("t2");
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "t2",
      "r2",
      "t3",
    ]);
  });

  it("keeps trailing process mounted while the trailing chip is expanded", () => {
    const items = [
      user("u1"),
      tool("t1"),
      reasoning("r1"),
      tool("t2"),
      reasoning("r2"),
      tool("t3"),
      reasoning("r3"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      expandedPhaseKeys: new Set(["trailing:u1"]),
      timelineSourceItems: items,
    });

    expect(result.phases[0]?.expanded).toBe(true);
    expect(result.timelineItems.map((item) => item.id)).toEqual([
      "u1",
      "t1",
      "r1",
      "t2",
      "r2",
      "t3",
      "r3",
    ]);
  });

  it("hands the trailing run to the turn phase once assistant prose lands", () => {
    const items = [
      user("u1"),
      tool("t1"),
      reasoning("r1"),
      tool("t2"),
      reasoning("r2"),
      tool("t3"),
      reasoning("r3"),
      assistant("a1", "最终结论"),
    ];
    const result = resolveCollapsedTimelineItems({
      activeEngine: "claude",
      timelineSourceItems: items,
    });

    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]?.phaseKey).toBe("a1");
    expect(result.phases[0]?.hiddenItemIds).toEqual([
      "t1",
      "r1",
      "t2",
      "r2",
      "t3",
      "r3",
    ]);
    expect(result.timelineItems.map((item) => item.id)).toEqual(["u1", "a1"]);
  });
});
