import { describe, expect, it } from "vitest";

import {
  composeStageRolePrompt,
  mergeTarget,
  normalizeAgentTargetSource,
  templateToStageBindings,
  type CollaborationTemplate,
} from "./types";
import type { AgentExecutionTarget } from "../types";

const sessionCodex: AgentExecutionTarget = {
  engine: "codex",
  providerProfileId: null,
  modelCatalogEntryId: "gpt-5.3-codex",
  model: "gpt-5.3-codex",
  reasoningEffort: "medium",
  providerProfileNameSnapshot: "本地配置",
  providerProfileSource: "disk",
  runtimeCapabilityFingerprint: null,
};

const completeClaude: AgentExecutionTarget = {
  engine: "claude",
  providerProfileId: null,
  modelCatalogEntryId: "claude-sonnet-4-6",
  model: "claude-sonnet-4-6",
  reasoningEffort: "high",
  providerProfileNameSnapshot: "本地配置",
  providerProfileSource: "disk",
  runtimeCapabilityFingerprint: null,
};

describe("mergeTarget", () => {
  it("keeps complete stage target", () => {
    const merged = mergeTarget(completeClaude, sessionCodex);
    expect(merged.engine).toBe("claude");
    expect(merged.model).toBe("claude-sonnet-4-6");
  });

  it("does not mix cross-engine incomplete target with session model", () => {
    const incompleteClaude = {
      ...completeClaude,
      model: null,
      modelCatalogEntryId: null,
      providerProfileNameSnapshot: null,
      providerProfileSource: null,
      engine: "claude" as const,
    };
    const merged = mergeTarget(incompleteClaude, sessionCodex);
    // 安全回退会话 target，避免 claude+codex 非法组合
    expect(merged.engine).toBe("codex");
    expect(merged.model).toBe("gpt-5.3-codex");
  });

  it("fills same-engine gaps from session", () => {
    const partial = {
      ...sessionCodex,
      model: null,
      modelCatalogEntryId: null,
      reasoningEffort: "high" as string | null,
    };
    const merged = mergeTarget(partial, sessionCodex);
    expect(merged.engine).toBe("codex");
    expect(merged.model).toBe("gpt-5.3-codex");
    expect(merged.reasoningEffort).toBe("high");
  });
});

describe("normalizeAgentTargetSource", () => {
  it("maps disk to local for backend validate", () => {
    const next = normalizeAgentTargetSource(sessionCodex);
    expect(next.providerProfileSource).toBe("local");
  });
});

describe("templateToStageBindings", () => {
  it("emits N stages without collapsing to 3", () => {
    const tpl: CollaborationTemplate = {
      id: "fix4",
      name: "修复流水线",
      description: "",
      builtin: true,
      version: 1,
      updatedAt: 0,
      stages: [
        {
          id: "plan",
          title: "规划",
          rolePrompt: "plan me",
          accessMode: "read-only",
          requiresApproval: true,
          target: { engine: "claude" } as AgentExecutionTarget,
        },
        {
          id: "implement",
          title: "实现",
          rolePrompt: "",
          accessMode: "current",
          requiresApproval: false,
          target: { engine: "codex" } as AgentExecutionTarget,
        },
        {
          id: "test-harden",
          title: "测试加固",
          rolePrompt: "tests",
          accessMode: "current",
          requiresApproval: false,
          target: { engine: "claude" } as AgentExecutionTarget,
        },
        {
          id: "review",
          title: "审查",
          rolePrompt: "",
          accessMode: "read-only",
          requiresApproval: false,
          target: { engine: "grok" } as AgentExecutionTarget,
        },
      ],
    };
    const bindings = templateToStageBindings(tpl, sessionCodex);
    expect(bindings).toHaveLength(4);
    expect(bindings.map((b) => b.id)).toEqual([
      "plan",
      "implement",
      "test-harden",
      "review",
    ]);
    expect(bindings[0]?.requiresApproval).toBe(true);
    expect(bindings[0]?.rolePrompt).toBe("plan me");
    // 首段默认 full；非首段默认 summary
    expect(bindings[0]?.upstreamFeedMode).toBe("full");
    expect(bindings[1]?.upstreamFeedMode).toBe("summary");
    expect(bindings[3]?.upstreamFeedMode).toBe("summary");
    // incomplete cross-engine → 回退会话 target 且 source 归一 local
    expect(bindings[0]?.target.engine).toBe("codex");
    expect(bindings[0]?.target.providerProfileSource).toBe("local");
  });

  it("sends persona prompt separately from rolePrompt (not merged into role)", () => {
    const tpl: CollaborationTemplate = {
      id: "with-agent",
      name: "带智能体",
      description: "",
      builtin: false,
      version: 1,
      updatedAt: 0,
      stages: [
        {
          id: "plan",
          title: "规划",
          rolePrompt: "只做计划",
          accessMode: "read-only",
          requiresApproval: true,
          personaAgentId: "agent-xz",
          personaAgentName: "小张",
          personaAgentIcon: "codicon-robot",
          personaAgentPrompt: "你是资深工程师，偏可验证交付。",
          target: completeClaude,
        },
      ],
    };
    const bindings = templateToStageBindings(tpl, sessionCodex);
    expect(bindings[0]?.rolePrompt).toBe("只做计划");
    expect(bindings[0]?.personaPrompt).toBe("你是资深工程师，偏可验证交付。");
    expect(bindings[0]?.personaAgentName).toBe("小张");
    // 禁止把正文拼进 rolePrompt（幕布/投影泄漏）
    expect(bindings[0]?.rolePrompt).not.toContain("你是资深工程师");
  });
});

describe("composeStageRolePrompt", () => {
  it("returns null when empty", () => {
    expect(
      composeStageRolePrompt({
        id: "a",
        title: "t",
        rolePrompt: "",
        accessMode: "current",
        requiresApproval: false,
        target: { engine: "claude" } as AgentExecutionTarget,
      }),
    ).toBeNull();
  });

  it("returns stage body only without agent name header", () => {
    expect(
      composeStageRolePrompt({
        id: "a",
        title: "t",
        rolePrompt: "本步约束",
        accessMode: "current",
        requiresApproval: false,
        personaAgentName: "小张",
        personaAgentPrompt: "人设正文",
        target: { engine: "claude" } as AgentExecutionTarget,
      }),
    ).toBe("本步约束");
  });
});
