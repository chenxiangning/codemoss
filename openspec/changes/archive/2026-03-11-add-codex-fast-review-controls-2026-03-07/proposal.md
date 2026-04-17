## Why

Codex CLI 已支持 `/fast` 与 `/review`，但 CodeMoss 当前主要依赖用户手输命令，配置面板里没有等价入口，导致功能可发现性和触达效率都偏低。现在补齐 Codex 引擎配置模块入口，可以把“知道命令的人才能用”升级为“可视化可切换可验证”的默认体验。

## 目标与边界

### 目标

- 在 Codex 引擎的配置面板（设置按钮弹层）增加 `/fast` 的可视化切换入口。
- 在同一面板增加 `/review` 的快捷入口，直接拉起现有 Review preset 流程。
- 让入口行为与 CLI 语义一致：本质仍是触发 Codex 原生命令能力，而不是造一套平行协议。
- 保持现有 `/review` 文本命令链路继续可用，不回归。

### 边界

- 仅改 Codex 引擎 UI 与前端命令分发，不改非 Codex 引擎（Claude/OpenCode/Gemini）。
- 不修改 Codex CLI 上游协议，不 fork/patch CLI 行为。
- 不重做整个 slash command 架构，只补入口与必要状态同步。

## 非目标

- 不在本次提案中实现 `/permissions`、`/experimental`、`/model` 的完整 GUI 面板化。
- 不做跨线程全局 Fast Mode 统一中心（只做当前会话可用且状态一致）。
- 不做 Review UI 视觉重构（复用现有 `ReviewInlinePrompt`）。

## 技术方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 命令桥接（推荐） | 配置面板点击后走现有命令分发：`/fast` 触发 fast 切换，`/review` 触发现有 review preset 流程 | 与 CLI 语义一致、改动面小、可复用现有 `useQueuedSend/useThreadMessaging` | 需要补一层 UI 状态与命令回执同步 | 采用 |
| B. 本地模拟 | 不发 slash command，直接用前端状态模拟 fast/review | 前端可控性强 | 容易与 CLI 真正状态漂移，语义不一致 | 不采用 |
| C. 后端新增专用 IPC | 为 fast/review 单独新增 Tauri command | 状态可强校验 | 改动链路长、协议扩展成本高、收益不成比例 | 暂不采用 |

取舍：优先 A，先把“入口可用 + 行为一致 + 可回归测试”做实，再评估是否需要 B/C 级别增强。

## What Changes

- 在 Codex 配置面板新增 `Fast mode` 开关项（仅 Codex 可见）。
- 在 Codex 配置面板新增 `Review` 快捷入口（仅 Codex 可见），点击后直接进入“Select a review preset”。
- 补充 `/fast` 命令在前端命令分发层的显式路由与状态反馈（避免仅靠自由文本输入）。
- 保持 `/review` 现有文本命令能力，同时新增 GUI 快捷触发入口。
- 新增中英文文案与测试覆盖（可见性、交互触发、非 Codex 隔离、回归）。

## Capabilities

### New Capabilities

- `codex-chat-canvas-command-quick-actions`: 在 Codex 聊天输入配置面板提供 `/fast` 与 `/review` 的可视化快捷入口，并与现有命令执行链路保持一致。

### Modified Capabilities

- `codex-chat-canvas-usage-overview`: 扩展 Codex 配置面板 contract，从“实时用量 + 计划模式”扩展为“实时用量 + 计划模式 + fast/review 快捷动作”的同域可见性与交互一致性要求。

## 验收标准

- 可见性
  - Codex 引擎下，配置面板 MUST 显示 `Fast mode` 与 `Review` 两个新入口。
  - 非 Codex 引擎下，以上入口 MUST NOT 显示。
- 行为
  - 点击 `Fast mode` 开关 MUST 触发 `/fast` 对应命令链路，并给出可观察反馈（状态变化或消息回执）。
  - 点击 `Review` 入口 MUST 打开 review preset 选择（4 项：base branch / uncommitted / commit / custom）。
  - 手输 `/review` 旧流程 MUST 继续可用。
- 质量
  - 相关单测与组件测试通过，且不引入 TypeScript 错误。
  - 不影响 Claude/OpenCode/Gemini 现有交互行为。

## Impact

- 前端 UI
  - `src/features/composer/components/ChatInputBox/selectors/ConfigSelect.tsx`
  - `src/features/composer/components/ChatInputBox/ButtonArea.tsx`
  - `src/features/composer/components/ChatInputBox/ChatInputBoxFooter.tsx`
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
- 命令/线程编排
  - `src/features/threads/hooks/useQueuedSend.ts`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/composer/components/ReviewInlinePrompt.tsx`（复用，不做重构）
- i18n 与测试
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
  - `src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx`
  - `src/features/threads/hooks/useQueuedSend.test.tsx`
