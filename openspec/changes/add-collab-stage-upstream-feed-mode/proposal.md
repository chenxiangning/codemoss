## Why

协作跨节点注入当前固定用 `shortOutcome`（约 160 字）。定稿/审查类节点常需要看上游「润色/实现」全文，但模板无法声明该策略；用户在 Inspector 看到的上游截断与「模型是否吃全文」容易混淆。需要在**模板创建**时为第 2 个起的环节声明：吃上游摘要还是吃上游全文。

## 目标与边界

- **首段（index=0）**：固定吃用户任务全文（`requestText` / 注入后的 model text），**不**展示上游 feed 开关。
- **第 2 段起**：模板编辑器每行增加 **摘要 / 全文** 滑动单选（默认 **摘要**，兼容现网）。
- 运行时 `start_stage_attempt` 按**当前段**配置选择上游材料：
  - `summary` → 前序已成功段的 `short_outcome`（现状）
  - `full` → 前序已成功段的 `full_outcome`（无则回退 short；全文仍受 body 安全阀截断）
- Inspector「注入上下文 · 上游」展示与运行时策略对齐（全文模式展示更长内容，UI 仍可 clamp）。
- 配置持久化在协作模板与 stageBindings / projection。

## What Changes

- 模板模型：`CollaborationTemplateStage.upstreamFeedMode?: "summary" | "full"`
- 模板管理 UI：第 2 行起单选滑动（与「需批准」同排视觉语言）
- `templateToStageBindings` / 后端 `AgentStageBindingInput` / stage projection 贯通字段
- `last_succeeded_notes`（或等价）按当前段 mode 组装上游
- 内置模板：默认可不写字段（= summary）；文档双人组等审查段可后续按需改 full
- i18n + 单测 + OpenSpec delta

## 非目标

- 不改首段用户全文策略以外的 Context Fan-in（skill/记忆/图）。
- 不做「只吃直接前驱 / 吃全部前驱」的多选（仍为全部已成功前序拼接，与现网一致）。
- 不取消 short/full 的安全字数上限。
- 不在本次重做 Inspector B+C 布局。

## 方案取舍

| 选项 | 说明 | 取舍 |
|------|------|------|
| A 全局 run 级开关 | 所有后续段同一策略 | 太粗，起草→润色与定稿需求不同 |
| **B 每段声明（选定）** | 从第 2 段起 per-stage | 与模板心智一致，截图位也在行尾 |
| C 仅审查段写死 full | 无配置 | 无法服务「中间段也要全文」 |

## Capabilities

### New Capabilities

- `collab-stage-upstream-feed-mode`: 模板与运行时「上游摘要/全文」策略契约。

### Modified Capabilities

- `multi-agent-orchestration`: 跨段 prompt 组装 MUST 尊重 stage 的 upstream feed mode；缺省 summary。
- `multi-agent-inspector-inject-context`（若已入库）: 上游分区展示材料 MUST 与 feed mode 对齐。

## Impact

- FE: `templates/types.ts`、`templateStore`、`TemplateManagerModal`、`templateToStageBindings`、`buildStageInjectContext`、i18n
- BE: `AgentStageBindingInput` / projection / `start_stage_attempt` notes 组装
- 无新依赖

## 验收标准

- 旧模板无字段 → 行为与现网一致（summary）
- 第 2 段起 UI 可切换 summary/full 并保存回读
- 首段无该控件
- full 模式：后续段 worker prompt 含前序 full_outcome 片段（受 cap）
- summary 模式：仅 short_outcome
- Inspector 上游区与 mode 一致
- 相关 TS/Rust 单测通过
