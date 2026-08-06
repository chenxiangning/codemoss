import type { CollaborationTemplate } from "./types";
import { emptyTarget } from "./types";

const NOW = 0;

function target(
  engine: "claude" | "codex" | "grok" | "kimi" | "opencode",
  model: string | null,
  effort: string | null,
) {
  return {
    ...emptyTarget(engine),
    engine,
    model,
    reasoningEffort: effort,
  };
}

/** 内置模板：结构对齐 v4；target 仅作默认建议，用户可在管理器中用真实 picker 改。 */
export const BUILTIN_TEMPLATES: CollaborationTemplate[] = [
  {
    id: "default",
    name: "默认三步",
    description: "通用修复 / 实现流程：先规划并批准，再实现，最后审查。",
    builtin: true,
    version: 1,
    updatedAt: NOW,
    stages: [
      {
        id: "plan",
        title: "规划",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: true,
        rolePrompt:
          "你是规划者。只做根因分析与实施计划，不改代码。输出：任务理解 / 根因假设 / 步骤 / 验收标准。完成后等待人工批准。",
      },
      {
        id: "implement",
        title: "实现",
        target: target("codex", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "按已批准的规划实施。允许 apply_patch 与跑测试；失败先自纠一次再上报。",
      },
      {
        id: "review",
        title: "审查",
        target: target("grok", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "审查 diff 与测试结果。输出 verdict: APPROVE / REQUEST_CHANGES + nit 清单。",
      },
    ],
  },
  {
    id: "fix4",
    name: "修复流水线",
    description: "bug 修复专用：实现后加一道测试加固。",
    builtin: true,
    version: 1,
    updatedAt: NOW,
    stages: [
      {
        id: "plan",
        title: "规划",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: true,
        rolePrompt: "同默认三步规划。",
      },
      {
        id: "implement",
        title: "实现",
        target: target("codex", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt: "同默认三步实现。",
      },
      {
        id: "test-harden",
        title: "测试加固",
        target: target("claude", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "针对实现 diff 补充边界与回归用例，给出覆盖率变化。",
      },
      {
        id: "review",
        title: "审查",
        target: target("grok", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt: "同默认三步审查。",
      },
    ],
  },
  {
    id: "docs2",
    name: "文档双人组",
    description: "起草 + 润色，适合文档与文案。",
    builtin: true,
    version: 1,
    updatedAt: NOW,
    stages: [
      {
        id: "draft",
        title: "起草",
        target: target("claude", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt: "根据主题快速起草结构化初稿。",
      },
      {
        id: "polish",
        title: "润色",
        target: target("claude", null, "high"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt: "润色初稿：统一术语、压缩冗余、修正事实。",
      },
      {
        id: "check",
        title: "定稿检查",
        target: target("claude", null, "low"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt: "快速检查一致性与遗漏，输出短汇总。",
      },
    ],
  },
];

export const DEFAULT_TEMPLATE_ID = "default";
