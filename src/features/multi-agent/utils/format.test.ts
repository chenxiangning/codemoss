import { describe, expect, it } from "vitest";

import type { AgentStageProjection } from "../types";
import {
  stageInspectorTypeLine,
  stageTargetLabel,
} from "./format";

const baseStage: AgentStageProjection = {
  id: "implement",
  title: "实现",
  role: "implementer",
  target: {
    engine: "codex",
    model: "deepseek-v4-flash",
    providerProfileNameSnapshot: "DeepSeek-codex",
    providerProfileSource: "managed",
    reasoningEffort: "medium",
  },
  status: "succeeded",
  accessMode: "current",
};

describe("stageTargetLabel", () => {
  it("joins engine · model · effort", () => {
    expect(stageTargetLabel(baseStage)).toBe(
      "codex · deepseek-v4-flash · medium",
    );
  });
});

describe("stageInspectorTypeLine (contract 4: target + persona)", () => {
  it("returns target only when persona missing", () => {
    expect(stageInspectorTypeLine(baseStage)).toBe(
      "codex · deepseek-v4-flash · medium",
    );
  });

  it("appends persona agent name without rewriting target", () => {
    const withPersona: AgentStageProjection = {
      ...baseStage,
      personaAgentName: "小张",
      personaAgentId: "a1",
    };
    // 测试环境 mock 无 multiAgent 映射时走 defaultValue「智能体 {{name}}」
    expect(stageInspectorTypeLine(withPersona)).toBe(
      "codex · deepseek-v4-flash · medium · 智能体 小张",
    );
    // persona 不得改写 target 字段本身
    expect(withPersona.target.engine).toBe("codex");
    expect(withPersona.target.model).toBe("deepseek-v4-flash");
  });

  it("trims empty persona to target-only line", () => {
    const emptyPersona: AgentStageProjection = {
      ...baseStage,
      personaAgentName: "   ",
    };
    expect(stageInspectorTypeLine(emptyPersona)).toBe(
      stageTargetLabel(emptyPersona),
    );
  });
});
