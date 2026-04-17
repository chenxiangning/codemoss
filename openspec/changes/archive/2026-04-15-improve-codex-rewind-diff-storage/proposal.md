## Why

当前代码库里的 rewind 体验仍然是 `Claude` 专属：入口、确认弹层、受影响文件核对和完整 diff 审查都没有在 `Codex` 会话里复用。与此同时，底层 `export_rewind_files` 已经具备 `codex` engine 的目录协议支持，这意味着 `Codex` 侧已经有存储底座，却缺少面向用户的 rewind review surface，导致用户在执行 Codex 回溯前既无法高效核对受影响文件，也无法把本次回溯涉及的工作区改动稳定导出存档。

## 目标与边界

- 目标：
  - 为 `Codex` 引擎补齐与 Claude 对齐的 rewind review surface，支持受影响文件聚合、单文件 diff 预览与完整 diff 核对。
  - 在 `Codex` rewind 确认流程中复用既有 `chat-diff` 存储协议，支持“存储变更”导出目录与 manifest。
  - 保持 `Codex` 本地 session replay / file change tool facts 的路径语义一致，避免 rewind preview 与历史工具卡片出现双轨文件身份。
- 边界：
  - 本提案只覆盖 `Codex` rewind review surface、必要的数据聚合和导出接线。
  - 优先复用现有 `export_rewind_files`、diff 渲染与确认弹层结构，不重新设计一套独立存储协议。
  - 不在本提案中扩展到 `Gemini`、Git 历史回滚或普通 tool card 的全局 UI 改版。

## What Changes

- 为 `Codex` 会话新增 rewind 入口与确认流程，使其可以像 Claude 一样从可回溯消息锚点进入审查界面。
- 在 `Codex` rewind preview 中按 `filePath` 聚合同一路径的多次 tool/file change，保留用于紧凑预览和完整 diff 的文本内容。
- 在确认弹层中提供左侧文件 rail、右侧 compact diff preview 与 full diff overlay，避免受影响文件过多时撑高主区域。
- 复用现有 `export_rewind_files` Tauri command，将 `Codex` rewind 受影响文件导出到 `~/.ccgui/chat-diff/codex/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/`，并生成 `manifest.json`。
- 明确 `Codex` rewind preview、导出 manifest 与本地 session replay 使用同一源路径契约，避免引入额外 opaque file key。
- 补充前后端测试，覆盖 `Codex` rewind 入口可见性、预览聚合、diff 查看、导出结构与失败回退。
- 同步 Claude 已验证的回溯健壮性修复（kind 推断、无 diff 恢复、fork 失败回滚）到 Codex 实现约束，避免重复踩坑。

## 来自 Claude 代码修复的同步约束（2026-04-14）

- 文件恢复必须支持“缺少 inline diff”的真实数据：
  - 若 kind 可判定（`add/delete/rename/modified`），不得直接跳过；
  - 若存在 structured `old_string/new_string`，应优先结构化反演，再回退到 unified diff。
- kind 决策必须偏向更具体语义：
  - 当远端为 `modified` 而本地推断为 `add/delete/rename` 时，优先使用具体 kind；
  - 解析状态文本 `(A)/(U)/(D) <path>` 作为无 patch 场景的补充输入。
- rewind 执行链路必须具备事务性：
  - 应先应用工作区回溯快照，再触发会话 rewind/fork；
  - 若会话 rewind/fork 失败，必须自动回滚工作区快照。
- 首条消息回溯边界需保持一致：
  - 若目标锚点为首条 user message，应避免无意义 fork；按线程生命周期语义执行删除/重建策略。

## 非目标

- 不改变 `Codex` 现有历史恢复、线程合并或 source/provider unification 的底层协议。
- 不重写共享 diff viewer，也不引入新的云端存储或数据库持久层。
- 不在本提案中承诺跨引擎统一 rewind 交互文案，只要求 `Codex` 获得等价能力。

## 技术方案对比

### 方案 A：完全复刻 Claude 专属实现并做分支复制

- 做法：复制 `ClaudeRewindConfirmDialog`、rewind preview 构建逻辑和导出调用，再在 `Codex` 分支上独立维护。
- 优点：落地快，短期可直接得到功能对齐。
- 缺点：会放大双引擎分叉，后续每次调整 rewind review surface 都要双份维护，长期熵增明显。

### 方案 B：抽象共享 rewind review surface，按引擎注入 preview / action 语义（推荐）

- 做法：复用现有 Claude 已落地的 diff preview、full diff overlay 和导出底座，把引擎差异收敛在 preview 构建、入口可见性和回溯执行 handler 上。
- 优点：可以直接复用 `export_rewind_files` 与现有 UI 资产，减少重复实现；后续 Claude/Codex 的 rewind 审查体验可以一处演进。
- 缺点：需要先整理现有 Claude 专属命名与状态模型，避免抽象层泄漏引擎细节。

取舍：采用方案 B，优先做共享 review surface 抽象，再让 `Codex` 接入。

## Capabilities

### New Capabilities

- `codex-rewind-review-surface`: 定义 Codex rewind 确认流程中的文件核对、diff 预览、完整 diff 查看与导出语义。

### Modified Capabilities

- `conversation-tool-card-persistence`: 约束 Codex rewind preview、导出 manifest 与本地 session replay 继续共享同一 `sourcePath` 身份契约。

## Impact

- Frontend
  - `src/features/composer/components/Composer.tsx`
  - `src/features/composer/components/ClaudeRewindConfirmDialog.tsx` 或其共享抽象拆分文件
  - `src/features/composer/components/ChatInputBox/ContextBar.tsx`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/styles/composer.part1.css`
- Backend
  - `src-tauri/src/workspaces/rewind_export.rs`（复用现有导出协议，仅补 Codex 接线时必要调整）
  - `src-tauri/src/command_registry.rs`
- Specs / Tests
  - `openspec/specs/codex-rewind-review-surface/spec.md`
  - `openspec/specs/conversation-tool-card-persistence/spec.md`
  - 相关前端 rewind 测试与 Rust 导出测试

## 验收标准

- `Codex` 会话中存在可回溯目标时，用户 MUST 能进入 rewind 确认流程；非 `Codex`/`Claude` 引擎不得误显示该入口。
- 当 `Codex` rewind preview 包含多个受影响文件时，文件区 MUST 使用独立滚动 rail，主体区域不得被线性撑高。
- 用户点击任意文件后，确认弹层 MUST 显示该文件的 compact diff 预览；并且可以继续打开完整 diff overlay。
- 点击“存储变更”后，系统 MUST 将文件导出到 `~/.ccgui/chat-diff/codex/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/` 并生成 `manifest.json`。
- `Codex` rewind preview、导出 manifest 与本地 session replay MUST 对同一文件保持一致的 `sourcePath` 语义。
- 导出失败时，rewind 确认流程 MUST 保持可恢复，用户仍可继续查看 diff、取消或确认回溯。
- 当工具记录缺少 inline diff 但可从 kind 或 structured `old_string/new_string` 推断恢复信息时，Codex rewind MUST 仍可完成文件恢复。
- 当 kind 存在冲突时，系统 MUST 优先具体语义（`add/delete/rename`）而非笼统 `modified`，并保证恢复结果可预测。
- 当 Codex rewind/fork 失败时，系统 MUST 回滚已应用的工作区文件快照，避免残留半回溯状态。
- 当回溯目标命中首条 user message 时，系统 MUST 遵循首条锚点专用生命周期策略，不得生成无意义 fork。

## 分阶段交付与质量门禁

- Phase 1（入口与模型收敛）：
  - 范围：`Codex` rewind 入口可见性矩阵、rewind preview 共享模型、目标消息锚点传递。
  - 门禁：`Codex` 可见、`Gemini`/`Opencode` 不可见；无可回溯目标时入口可恢复隐藏。
- Phase 2（审查面与导出接线）：
  - 范围：文件 rail、compact preview、full diff overlay 复用，以及 `export_rewind_files` 的 Codex 接线。
  - 门禁：导出目录和 manifest 符合既有协议；导出失败不阻断确认流程。
- Phase 3（回归与可观测性）：
  - 范围：前端交互测试、Rust 导出测试、最小验证脚本（目标测试 + typecheck）。
  - 门禁：通过目标测试，且不破坏 Claude 既有 rewind 行为。

## 兼容性与回滚口径

- 兼容性：
  - 保持现有 `export_rewind_files` 协议与目录规则不变，只增加 Codex 侧调用链路。
  - 保持 `conversation-tool-card-persistence` 既有 requirement 语义，并在此基础上扩展 Codex rewind 对齐。
- 回滚口径：
  - 若上线后出现高风险回退，可先将 rewind 入口重新收敛到 Claude-only，同时保留导出命令和共享组件改造。
  - 本变更无数据迁移，可按前端入口与接线代码回滚，不影响历史持久化数据可读性。
