import { describe, expect, it } from "vitest";
import {
  buildSubagentCardFromToolItem,
  buildSubagentCardsFromToolItems,
  resolveClaudeSubagentSessionFromContext,
  resolveSubagentProgress,
} from "./subagentViewModel";
import type { ConversationItem } from "../../../types";

function makeAgentTool(
  id: string,
  overrides?: Partial<Extract<ConversationItem, { kind: "tool" }>>,
): Extract<ConversationItem, { kind: "tool" }> {
  return {
    id,
    kind: "tool",
    toolType: "agent",
    title: "Tool: Agent",
    detail: JSON.stringify({
      description: "排查 session catalog",
      subagent_type: "explore",
    }),
    status: "completed",
    output: "done report",
    ...overrides,
  };
}

describe("subagentViewModel", () => {
  it("builds a persona card from an agent tool item", () => {
    const card = buildSubagentCardFromToolItem(makeAgentTool("tool-1"));
    expect(card.id).toBe("tool-1");
    expect(card.description).toContain("session catalog");
    expect(card.status).toBe("completed");
    expect(card.progress).toBe(1);
    expect(card.displayName).toBe("Subagent");
    expect(card.outputText).toContain("done report");
    // 固定身份：不再绑定贡献者头像 / GitHub
    expect(card.githubProfileUrl).toBeNull();
    expect(card.avatarSrc).toBeNull();
  });

  it("parses output_file path and agentId from agent launch ack text", () => {
    const card = buildSubagentCardFromToolItem(
      makeAgentTool("tool-path", {
        output:
          "Async agent launched successfully.\noutput_file: /tmp/claude/tasks/abc/agent.output\nagentId: a59c91e328c6a6c61",
      }),
      { parentThreadId: "claude:parent-session-id" },
    );
    expect(card.taskOutput?.outputFilePath).toBe(
      "/tmp/claude/tasks/abc/agent.output",
    );
    expect(card.taskOutput?.outputFileName).toBe("agent.output");
    expect(card.agentId).toBe("a59c91e328c6a6c61");
    expect(card.sessionThreadId).toBe(
      "claude:subagent:parent-session-id:a59c91e328c6a6c61",
    );
  });

  it("keeps running progress below full", () => {
    expect(resolveSubagentProgress("running", 3)).toBeLessThan(1);
    expect(resolveSubagentProgress("completed", 3)).toBe(1);
  });

  it("assigns distinct-ish names for a squad of tools", () => {
    const cards = buildSubagentCardsFromToolItems([
      makeAgentTool("a"),
      makeAgentTool("b", { status: "running", output: undefined }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.indexLabel).toBe("01");
    expect(cards[1]?.indexLabel).toBe("02");
    expect(cards[1]?.status).toBe("running");
    expect(cards[1]?.progress).toBeLessThan(1);
  });

  it("expands Codex collab spawn into one card per receiver", () => {
    const collabSpawn: Extract<ConversationItem, { kind: "tool" }> = {
      id: "spawn-1",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: spawn Agent",
      detail: "From thread-root → agent-a, agent-b",
      status: "completed",
      output: "Audit panel",
      receiverThreadIds: ["agent-a", "agent-b"],
    };
    const cards = buildSubagentCardsFromToolItems([collabSpawn], {
      parentThreadId: "thread-root",
    });
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.sessionThreadId)).toEqual(["agent-a", "agent-b"]);
    expect(cards[0]?.indexLabel).toBe("01");
    expect(cards[1]?.indexLabel).toBe("02");
  });

  it("expands agent swarm result XML into multiple cards without double-counting items", () => {
    const swarm: Extract<ConversationItem, { kind: "tool" }> = {
      id: "swarm-1",
      kind: "tool",
      toolType: "tool",
      title: "Launching agent swarm: greet",
      detail: JSON.stringify({
        items: ["1", "2", "3"],
        subagent_type: "explore",
      }),
      status: "completed",
      output: `<agent_swarm_result><summary>completed: 3</summary>
<subagent agent_id="agent-0" item="1" outcome="completed">## 1号报告</subagent>
<subagent agent_id="agent-1" item="2" outcome="completed">## 2号报告</subagent>
<subagent agent_id="agent-2" item="3" outcome="completed">## 3号报告</subagent>
</agent_swarm_result>`,
    };
    const cards = buildSubagentCardsFromToolItems([swarm], {
      parentThreadId: "kimi:parent",
    });
    // items=3 且 XML=3 时只计 XML 结果，禁止 6 张
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.description.length > 0)).toBe(true);
  });

  it("isolates each AgentSwarm card body so detail is not the full XML envelope (Kimi)", () => {
    const swarm: Extract<ConversationItem, { kind: "tool" }> = {
      id: "swarm-iso",
      kind: "tool",
      toolType: "tool",
      title: "Launching agent swarm: greet",
      detail: JSON.stringify({
        items: ["1号", "2号", "3号"],
        subagent_type: "coder",
      }),
      status: "completed",
      output: `<agent_swarm_result>
<summary>completed: 3</summary>
<subagent agent_id="agent-0" item="1号" outcome="completed">## 任务执行总结

### 任务内容
1号独立正文
</subagent>
<subagent agent_id="agent-1" item="2号" outcome="completed">## 完整任务总结

2号独立正文
</subagent>
<subagent agent_id="agent-2" item="3号" outcome="completed">任务完成。
3号独立正文
</subagent>
</agent_swarm_result>`,
    };
    const cards = buildSubagentCardsFromToolItems([swarm], {
      parentThreadId: "kimi:session_parent",
    });
    expect(cards).toHaveLength(3);

    // 每张卡只含自己的 body，不含 XML 外壳与其它 agent 正文
    expect(cards[0]?.outputText).toContain("1号独立正文");
    expect(cards[0]?.outputText).not.toContain("2号独立正文");
    expect(cards[0]?.outputText).not.toContain("<agent_swarm_result>");
    expect(cards[0]?.outputText).not.toContain("<subagent");
    expect(cards[0]?.agentId).toBe("agent-0");

    expect(cards[1]?.outputText).toContain("2号独立正文");
    expect(cards[1]?.outputText).not.toContain("1号独立正文");
    expect(cards[1]?.agentId).toBe("agent-1");

    expect(cards[2]?.outputText).toContain("3号独立正文");
    expect(cards[2]?.outputText).not.toContain("1号独立正文");

    // 禁止映射成不可加载的 kimi:agent-0（history 只读 agents/main）
    expect(cards.every((card) => card.sessionThreadId == null)).toBe(true);
    // 换行应保留，详情 pre-wrap 才能正常排版
    expect(cards[0]?.outputText).toMatch(/任务执行总结[\s\S]*任务内容/);
  });

  it("dedupes launch items + separate result tool in one squad (Kimi 3+3)", () => {
    const launch: Extract<ConversationItem, { kind: "tool" }> = {
      id: "launch",
      kind: "tool",
      toolType: "tool",
      title: "Launching agent swarm: greet",
      detail: JSON.stringify({ items: ["1", "2", "3"], subagent_type: "explore" }),
      status: "completed",
      output: "started",
    };
    const result: Extract<ConversationItem, { kind: "tool" }> = {
      id: "result",
      kind: "tool",
      toolType: "tool",
      title: "Launching agent swarm: greet",
      detail: "{}",
      status: "completed",
      output: `<agent_swarm_result>
<subagent agent_id="agent-0" item="1" outcome="completed">## 1号报告</subagent>
<subagent agent_id="agent-1" item="2" outcome="completed">## 2号报告</subagent>
<subagent agent_id="agent-2" item="3" outcome="completed">## 3号报告</subagent>
</agent_swarm_result>`,
    };
    const cards = buildSubagentCardsFromToolItems([launch, result], {
      parentThreadId: "kimi:parent",
    });
    expect(cards).toHaveLength(3);
    expect(cards.some((card) => card.description.includes("#1"))).toBe(false);
    // 结果卡应带隔离 body
    expect(cards[0]?.outputText).toBe("## 1号报告");
    expect(cards[1]?.outputText).toBe("## 2号报告");
    expect(cards[2]?.outputText).toBe("## 3号报告");
  });

  it("does not suppress Claude Agent sessionThreadId (non-swarm regression guard)", () => {
    const agentTool: Extract<ConversationItem, { kind: "tool" }> = {
      id: "claude-agent-1",
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({
        description: "explore catalog",
        subagent_type: "explore",
      }),
      status: "completed",
      output:
        "Async agent launched successfully.\nagentId: a59c91e328c6a6c61\noutput_file: /tmp/claude/tasks/abc/agent.output",
    };
    const cards = buildSubagentCardsFromToolItems([agentTool], {
      parentThreadId: "claude:parent-session-id",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.sessionThreadId).toBe(
      "claude:subagent:parent-session-id:a59c91e328c6a6c61",
    );
    expect(cards[0]?.outputText).toContain("Async agent launched successfully");
  });

  it("resolves Shared Claude Agent launch to claude:subagent via nativeThreadIds", () => {
    const agentTool: Extract<ConversationItem, { kind: "tool" }> = {
      id: "call-claude-agent",
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({
        description: "问候测试 4 号",
        subagent_type: "agent",
      }),
      status: "completed",
      output:
        "Async agent launched successfully.\nagentId: ad284bfdf0aa8384f\noutput_file: /tmp/x.output",
    };
    const cards = buildSubagentCardsFromToolItems([agentTool], {
      parentThreadId: "shared:shared-session-1",
      nativeThreadIds: ["claude:parent-native-session"],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.agentId).toBe("ad284bfdf0aa8384f");
    expect(cards[0]?.sessionThreadId).toBe(
      "claude:subagent:parent-native-session:ad284bfdf0aa8384f",
    );
  });

  it("uses task_name instead of encrypted message for Codex spawn_agent cards", () => {
    const spawn: Extract<ConversationItem, { kind: "tool" }> = {
      id: "spawn-enc",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: spawn_agent",
      detail: JSON.stringify({
        task_name: "greeting_one",
        message:
          "gAAAAABqbyCy4OfSzmv9XIaXZpVaHUL1uXiAfFJQZ3XiLWVaozcSOLO0QjL3WuvKrNbTA_lHBW7kN_upxg",
      }),
      status: "completed",
      output:
        "gAAAAABqbyCy4OfSzmv9XIaXZpVaHUL1uXiAfFJQZ3XiLWVaozcSOLO0QjL3WuvKrNbTA_lHBW7kN_upxg",
    };
    const cards = buildSubagentCardsFromToolItems([spawn], {
      parentThreadId: "019fc217-9f8f-73e3-b82a-d9f88bb7ab27",
      childThreads: [
        { id: "019fc217-d91b-7bc1-9438-8b6b0ba80621", name: "Nietzsche" },
        { id: "019fc217-ccb1-7371-a7ee-1d796bf11b9e", name: "Avicenna" },
        { id: "019fc217-b7fd-7111-aff7-44792e4c6985", name: "Aristotle" },
      ],
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.description).not.toMatch(/^gAAAAA/);
    expect(cards[0]?.description).toMatch(/greeting_one|Nietzsche|Subagent/i);
    expect(cards[0]?.sessionThreadId).toBe(
      "019fc217-d91b-7bc1-9438-8b6b0ba80621",
    );
    expect(cards[0]?.outputText).toBeNull();
  });

  it("does not force grok: prefix on Codex UUID under Shared parent", () => {
    const collab: Extract<ConversationItem, { kind: "tool" }> = {
      id: "spawn-codex",
      kind: "tool",
      toolType: "collabToolCall",
      title: "Collab: spawn_agent",
      detail: "From parent → 019fc217-4b28-7c03-94b4-b1be16d1045a",
      status: "completed",
      output: "Euler ready",
      receiverThreadIds: ["019fc217-4b28-7c03-94b4-b1be16d1045a"],
    };
    const cards = buildSubagentCardsFromToolItems([collab], {
      parentThreadId: "shared:shared-codex-1",
      nativeThreadIds: ["019fc217-9f8f-73e3-b82a-d9f88bb7ab27"],
    });
    expect(cards[0]?.sessionThreadId).toBe(
      "019fc217-4b28-7c03-94b4-b1be16d1045a",
    );
    expect(cards[0]?.sessionThreadId?.startsWith("grok:")).toBe(false);
  });

  it("resolves Shared Claude Agent when bindings empty using output_file path parent UUID", () => {
    const agentTool: Extract<ConversationItem, { kind: "tool" }> = {
      id: "call-claude-agent-2",
      kind: "tool",
      toolType: "agent",
      title: "Tool: Agent",
      detail: JSON.stringify({ description: "问候测试 4 号" }),
      status: "completed",
      output: [
        "Async agent launched successfully.",
        "agentId: ad284bfdf0aa8384f",
        "output_file: /private/tmp/claude-501/-Users-chenxiangning-code-----/0dfedf87-33ef-407f-b018-e07168420e16/tasks/ad284bfdf0aa8384f.output",
      ].join("\n"),
    };
    const cards = buildSubagentCardsFromToolItems([agentTool], {
      parentThreadId: "shared:shared-session-empty-bind",
      nativeThreadIds: [], // 本地扫描：近期 Shared meta bindings 常为空
    });
    expect(cards[0]?.sessionThreadId).toBe(
      "claude:subagent:0dfedf87-33ef-407f-b018-e07168420e16:ad284bfdf0aa8384f",
    );
  });

  it("resolves DeepSeek/Shared Claude session from parent items when card output lacks output_file", () => {
    const parentItems: ConversationItem[] = [
      {
        id: "agent-tool-1",
        kind: "tool",
        toolType: "agent",
        title: "Tool: Agent",
        detail: JSON.stringify({ description: "Greeting agent 1" }),
        status: "completed",
        output: [
          "Async agent launched successfully.",
          "agentId: af1c547e815ebbbc6",
          "output_file: /private/tmp/claude-501/ws/0dfedf87-33ef-407f-b018-e07168420e16/tasks/af1c547e815ebbbc6.output",
        ].join("\n"),
      },
    ];
    // 卡上只有 agentId + 精简 launch 文案（Strip 常见），无 output_file
    const resolved = resolveClaudeSubagentSessionFromContext({
      agentId: "af1c547e815ebbbc6",
      outputText: "Async agent launched successfully.\nagentId: af1c547e815ebbbc6",
      nativeThreadIds: [],
      childThreadIds: [],
      parentItems,
    });
    expect(resolved).toBe(
      "claude:subagent:0dfedf87-33ef-407f-b018-e07168420e16:af1c547e815ebbbc6",
    );
  });

  it("resolves Claude subagent from childThreadIds ending with agentId", () => {
    const resolved = resolveClaudeSubagentSessionFromContext({
      agentId: "af1c547e815ebbbc6",
      outputText: "Async agent launched successfully.\nagentId: af1c547e815ebbbc6",
      nativeThreadIds: [],
      childThreadIds: [
        "claude:subagent:owner-session-uuid:af1c547e815ebbbc6",
      ],
      parentItems: [],
    });
    expect(resolved).toBe(
      "claude:subagent:owner-session-uuid:af1c547e815ebbbc6",
    );
  });

  it("maps Grok Spawn Subagent tools with subagent_id to grok session thread", () => {
    const grokTool: Extract<ConversationItem, { kind: "tool" }> = {
      id: "g1",
      kind: "tool",
      toolType: "spawn_subagent",
      title: "Spawn Subagent",
      detail: JSON.stringify({
        description: "SubAgent 1 问候测试",
        prompt: "你是一个友好的中文助手",
        subagent_type: "general-purpose",
      }),
      status: "completed",
      output:
        "Subagent started in background.\nsubagent_id: 019fc1e0-fcf7-76e3-8c10-d55ef5fff9cd\ntype: general-purpose",
    };
    const cards = buildSubagentCardsFromToolItems([grokTool], {
      parentThreadId: "grok:parent-session",
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]?.description).toContain("问候");
    expect(cards[0]?.agentId).toBe("019fc1e0-fcf7-76e3-8c10-d55ef5fff9cd");
    expect(cards[0]?.sessionThreadId).toBe(
      "grok:019fc1e0-fcf7-76e3-8c10-d55ef5fff9cd",
    );
  });
});
