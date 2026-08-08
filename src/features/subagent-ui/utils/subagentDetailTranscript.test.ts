import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../../../types";
import {
  appendAssistantReplyIfMissing,
  buildTranscriptItemsFromSubagentFallback,
  conversationHasAssistantReply,
  extractSubagentAssistantFromParentItems,
  isSyntheticSubagentMetaOutput,
} from "./subagentDetailTranscript";

describe("subagentDetailTranscript", () => {
  it("detects synthetic meta blocks", () => {
    expect(
      isSyntheticSubagentMetaOutput(
        "Subagent completed.\nsubagent_id: 019fc217-4b28\ntype: general-purpose\ndescription: Euler\nstatus: completed\n你好",
      ),
    ).toBe(true);
    expect(isSyntheticSubagentMetaOutput("just a greeting")).toBe(false);
  });

  it("builds user+assistant items from synthetic meta + greeting", () => {
    const items = buildTranscriptItemsFromSubagentFallback({
      cardId: "c1",
      description: "Euler",
      outputText: [
        "Subagent completed.",
        "subagent_id: 019fc217-4b28-7c03-94b4-b1be16d1045a",
        "type: general-purpose",
        "description: Euler",
        "status: completed",
        "你好! 我是子 agent 3 号 很高兴为你服务",
      ].join("\n"),
    });
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "message", role: "user", text: "Euler" });
    expect(items[1]).toMatchObject({
      kind: "message",
      role: "assistant",
    });
    expect(String((items[1] as { text?: string }).text)).toContain("子 agent 3");
  });

  it("does not dump raw tool envelope JSON as assistant body", () => {
    const items = buildTranscriptItemsFromSubagentFallback({
      cardId: "c2",
      description: "子代理2问候测试",
      outputText: JSON.stringify({
        _input: {
          background: true,
          description: "子代理2问候测试",
          prompt: "你是子代理 #2，请问候用户",
          subagent_type: "general-purpose",
        },
        _output:
          "Subagent started in background.\nsubagent_id: 019fc1ed-c621\ntype: general-purpose\nstatus: running",
      }),
    });
    expect(items.some((item) => item.kind === "message" && item.role === "user")).toBe(
      true,
    );
    const user = items.find((item) => item.kind === "message" && item.role === "user");
    expect(String((user as { text?: string }).text)).toContain("问候");
    // 不得把整个 _input JSON 喷成正文
    const joined = items
      .filter((item): item is Extract<typeof item, { kind: "message" }> => item.kind === "message")
      .map((item) => item.text)
      .join("\n");
    expect(joined).not.toContain('"_input"');
  });

  it("appends assistant when transcript only has user prompt", () => {
    const onlyUser: ConversationItem[] = [
      {
        id: "u1",
        kind: "message",
        role: "user",
        text: "你是子代理 #3，请打招呼",
      },
    ];
    expect(conversationHasAssistantReply(onlyUser)).toBe(false);
    const merged = appendAssistantReplyIfMissing(
      onlyUser,
      "湘宁大兄弟你好！我是子代理 #3",
      "card-3",
    );
    expect(conversationHasAssistantReply(merged)).toBe(true);
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      kind: "message",
      role: "assistant",
    });
  });

  it("extracts assistant reply from parent get_command_or_subagent_output", () => {
    const parentItems: ConversationItem[] = [
      {
        id: "spawn-1",
        kind: "tool",
        toolType: "spawn_subagent",
        title: "Spawn Subagent",
        detail: JSON.stringify({ subagent_id: "019fc1ed-c622-7dc2" }),
        status: "completed",
        output: "Subagent started.\nsubagent_id: 019fc1ed-c622-7dc2",
      },
      {
        id: "poll-1",
        kind: "tool",
        toolType: "get_command_or_subagent_output",
        title: "get_command_or_subagent_output",
        detail: JSON.stringify({
          task_ids: ["019fc1ed-c622-7dc2-923d-847a5482d23a"],
        }),
        status: "completed",
        output:
          "湘宁大兄弟你好。我是子代理 #3，很高兴为你服务。",
      },
    ];
    const reply = extractSubagentAssistantFromParentItems(parentItems, [
      "019fc1ed-c622-7dc2-923d-847a5482d23a",
    ]);
    expect(reply).toContain("子代理 #3");
  });
});
