## Why

当前 Codex chat 的计划展示存在 4 个体验断层：

1. 全局 Plan 在 Code 模式下被提示文案覆盖，用户明明已有计划数据却看不到内容。
2. 批量编辑文件卡片下方的 Plan 快览存在可视区域截断，步骤展示不完整。
3. 右侧 Plan 面板没有关闭入口，用户无法在不切换布局的情况下收起面板。
4. Codex 的 Code/Plan 默认模式为 Code，和当前用户主要使用习惯（先规划再执行）不匹配。

这些问题叠加后会导致计划信息“存在但不可见”，降低提案型工作流的可用性与信任感。

## Goals

- 让已有计划内容在 Code 模式也可查看（模式不应阻断阅读）。
- 修复批量编辑卡片内 Plan 快览截断，保证内容完整可读。
- 为右侧 Plan 面板提供明确关闭按钮与可恢复入口。
- 将 Codex 会话默认协作模式改为 Plan。
- 收敛 Codex 幕布中的“实时活动标题”和“详情卡片”信息分裂，合并为一致且更完整的展示。

## Non-Goals

- 不改动 `update_plan` 工具协议本身。
- 不重构整个右侧面板系统（仅补齐 Plan 面板交互闭环）。
- 不变更 Claude/OpenCode 的默认协作模式。
- 不改变 Claude/OpenCode 的工具卡片与实时活动展示策略。

## What Changes

- 调整 Plan 面板空态语义：
    - 若当前线程已有计划数据，则无论 Code/Plan 模式都显示计划内容。
    - 仅在“无计划数据”时按模式展示提示文案。
- 调整批量编辑卡片内 Plan 快览：
    - 修复高度/溢出策略，允许完整展示或滚动查看全部步骤。
- 在右侧 Plan 面板增加关闭按钮：
    - 支持关闭当前 Plan 面板并保留可重新打开入口。
- 将 Codex 的协作模式默认值从 Code 切换为 Plan（仅首进/未显式选择时）。
- 合并 Codex 幕布中的实时活动与详情信息：
    - 当存在 `commandExecution` 等 tool 事实数据时，实时活动区优先展示可读命令摘要。
    - 同时保留 reasoning 信息作为补充文本，避免“意图与执行”割裂。
    - 详情面板与实时活动使用同源摘要规则，减少文案偏差。
    - 该合并逻辑仅在 `activeEngine === "codex"` 下生效。

## Impact

- 前端：
    - `src/features/plan/components/*`
    - `src/features/messages/components/*`（批量编辑卡片 Plan 快览）
    - `src/features/messages/components/Messages.tsx`（实时活动标签合并策略）
    - `src/features/messages/components/toolBlocks/*`（详情摘要统一）
    - `src/features/collaboration/*`（默认模式初始化）
    - `src/App.tsx`（右侧 Plan 面板开合状态接线）
- 规范：
    - 修改 `codex-chat-canvas-plan-visibility`
    - 修改 `codex-chat-canvas-execution-cards-visual-refactor`
    - 修改 `codex-chat-canvas-collaboration-mode`

## Acceptance Criteria

- 在 Code 模式下，只要线程存在计划数据，右侧 Plan 与全局 Plan 快览都能看到完整计划。
- 批量编辑卡片内 Plan 快览不再出现内容被裁切不可见。
- 右侧 Plan 面板存在可点击关闭按钮，关闭后用户可再次打开。
- 新建 Codex 会话时默认模式为 Plan（用户后续主动切换仍被尊重）。
- Codex 幕布中同一步骤的实时活动文案与详情卡片不再明显割裂，且展示信息量不少于当前实现。
