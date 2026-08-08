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

/**
 * 内置协作模板（用户可任意修改后保存为本地覆盖，无只读限制）。
 * - rolePrompt：本步流程指令（喂模型）
 * - 展示名/描述/环节标题：i18n `multiAgent.builtin.<id>.*`
 * - target 仅默认建议；model 可空，发送时与会话 target 合并
 */
export const BUILTIN_TEMPLATES: CollaborationTemplate[] = [
  {
    id: "bug-fix",
    name: "修 Bug",
    description: "复现定位 → 修复 → 回归加固 → 审查收口。适合日常缺陷修复。",
    builtin: true,
    version: 2,
    updatedAt: NOW,
    stages: [
      {
        id: "diagnose",
        title: "复现定位",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: true,
        rolePrompt:
          "你是缺陷诊断环节。只读分析：复现路径、根因假设、最小改动面、验收标准。禁止改代码/写文件。输出 SUMMARY + 结构化计划，等待人工批准。",
      },
      {
        id: "fix",
        title: "修复",
        target: target("codex", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "按已批准的诊断实施最小修复。允许改代码与跑相关测试；禁止 commit / push / deploy。结束用简短 Markdown 说明改了什么、如何验证。",
      },
      {
        id: "harden",
        title: "回归加固",
        target: target("claude", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "针对本次修复补边界/回归用例或最小手测清单；能跑则跑相关测试。禁止无关重构与 commit/push。输出覆盖点与结果。",
      },
      {
        id: "review",
        title: "审查收口",
        target: target("grok", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "只输出给用户的短汇总：根因、关键改动、如何验证、残留风险。禁止再开工具大扫仓、禁止改文件。",
      },
    ],
  },
  {
    id: "feat",
    name: "加功能",
    description: "方案批准 → 实现 → 审查。适合新能力与增强。",
    builtin: true,
    version: 2,
    updatedAt: NOW,
    stages: [
      {
        id: "plan",
        title: "方案",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: true,
        rolePrompt:
          "你是方案规划环节。只产出：目标/非目标、步骤、风险、验收标准。不写实现代码、不改仓库。输出 SUMMARY + Markdown 计划，等待批准。",
      },
      {
        id: "implement",
        title: "实现",
        target: target("codex", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "按已批准方案在工作区落地。允许改代码与跑测试；禁止 commit / push / deploy。结束简要说明改动与验证方式。",
      },
      {
        id: "review",
        title: "审查",
        target: target("grok", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "对照方案做短汇总：完成了什么 / 关键改动 / 如何验证 / 剩余风险。禁止大段贴码与全仓扫描，禁止改文件。",
      },
    ],
  },
  {
    id: "docs",
    name: "写文档",
    description: "大纲批准 → 起草 → 润色定稿。适合 README、设计说明与文案。",
    builtin: true,
    version: 2,
    updatedAt: NOW,
    stages: [
      {
        id: "outline",
        title: "大纲",
        target: target("claude", null, "medium"),
        accessMode: "read-only",
        requiresApproval: true,
        rolePrompt:
          "只规划文档：读者、结构、必写章节、待确认事实。不写长正文、不改代码。输出 SUMMARY + 大纲，等待批准。",
      },
      {
        id: "draft",
        title: "起草",
        target: target("claude", null, "medium"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "按已批大纲撰写正文；可编辑仓库内文档文件。禁止无关代码大改与 commit/push。结束后说明写了哪些文件。",
      },
      {
        id: "polish",
        title: "润色定稿",
        target: target("claude", null, "high"),
        accessMode: "current",
        requiresApproval: false,
        rolePrompt:
          "统一术语、压缩冗余、修正事实与验收口径。可改文档文件；禁止无关代码改动与 commit/push。输出短交付说明。",
      },
    ],
  },
  {
    id: "research",
    name: "调研",
    description: "摸底 → 深挖 → 决策 briefing。适合摸清能力与选型，全程只读。",
    builtin: true,
    version: 2,
    updatedAt: NOW,
    stages: [
      {
        id: "survey",
        title: "摸底",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "只读摸底：现有代码/契约/能力清单，附证据路径。不做实现、不改文件。输出结构化发现列表。",
      },
      {
        id: "deep-dive",
        title: "深挖",
        target: target("claude", null, "high"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "针对缺口与关键机制深挖对比；假设与不确定点单列。只读；禁止改文件与实现。",
      },
      {
        id: "brief",
        title: "结论",
        target: target("grok", null, "medium"),
        accessMode: "read-only",
        requiresApproval: false,
        rolePrompt:
          "给决策的短 briefing：结论 / 选项权衡 / 建议下一步（可衔接到「加功能」或「修 Bug」模板）。禁止改文件。",
      },
    ],
  },
];

/** 产品默认选用：修 Bug */
export const DEFAULT_TEMPLATE_ID = "bug-fix";

/** 历史内置 id → 新 id（本地 selectedId/defaultId 迁移） */
export const LEGACY_BUILTIN_TEMPLATE_IDS: Record<string, string> = {
  default: "bug-fix",
  fix4: "bug-fix",
  docs2: "docs",
};
