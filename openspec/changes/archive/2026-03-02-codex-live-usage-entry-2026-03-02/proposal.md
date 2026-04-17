## Why

当前 ChatInputBox 新链路中，Codex 用户只能通过输入 `/status` 文本命令查看 5h/Weekly 限制与 credits。该入口可用但隐藏较深，导致“明明有能力、但日常不可见”的体验断层。

同时，旧 `ComposerInput` 已存在 usage popover 交互，但新 `ChatInputBox` 路径未接入，形成体验回退。

另外，Codex 的协作模式目前主要通过下拉项切换（`code/plan`），在输入区主视图缺少“default/plan”显式开关，不利于快速确认当前执行策略。

## 目标与边界

- 目标：在 ChatInputBox 的配置下拉中新增“实时用量”入口与面板。
- 目标：该入口仅在 `codex` 引擎下显示。
- 目标：面板展示 `5h limit`、`Weekly limit`、重置时间，并支持刷新。
- 目标：数据与 `/status` 使用同一份 `accountRateLimits` 快照来源，避免双逻辑漂移。
- 目标：在 `ComposerInput` 输入区增加 `default/plan` 切换，仅对 `codex` 引擎可见。
- 边界：不改 `/status` 命令输出文本结构。
- 边界：不影响 `claude/opencode/gemini` 现有 UI 与发送链路。

## 非目标

- 不新增后端 IPC。
- 不重做 Sidebar 的 usage 展示。
- 不改会话 token usage ring（ContextUsageIndicator）。

## What Changes

- 在 `ConfigSelect` 新增 Codex 条件项“实时用量”，并提供右侧 usage 面板。
- 将旧 `ComposerInput` 的 usage 计算与刷新逻辑迁移/复用到 ChatInputBox selector 体系。
- 打通 `Composer -> ChatInputBoxAdapter -> ChatInputBoxFooter -> ButtonArea -> ConfigSelect` 的 `accountRateLimits / usageShowRemaining / onRefreshAccountRateLimits` 透传。
- 新增最小样式，保证入口与面板在桌面端和窄宽度下可用。
- 在 `ComposerInput` 增加 Codex 专属“计划模式”开关（`default/plan`）及同步状态徽标。

## Capabilities

### New Capabilities

- `codex-chat-canvas-usage-overview`: 定义 Codex 聊天输入区实时用量入口与展示契约。

## 验收标准

1. 当前引擎为 `codex` 时，配置下拉 MUST 显示“实时用量”入口。
2. 当前引擎非 `codex` 时，该入口 MUST NOT 渲染。
3. 打开面板后 MUST 展示 `5h limit` 与（若存在）`Weekly limit`。
4. 显示百分比逻辑 MUST 与 `usageShowRemaining` 设置一致（已用/剩余）。
5. 点击刷新 MUST 调用统一刷新回调，并更新 loading 状态。
6. `/status` 命令输出与行为 MUST 保持兼容。
7. 当前引擎为 `codex` 时，输入区 MUST 显示 `default/plan` 开关。
8. 当前引擎非 `codex` 时，该开关 MUST NOT 渲染。
9. 用户切换开关后，`onSelectCollaborationMode` MUST 被调用并在 `default/plan` 间切换。

## Impact

- 前端：`src/features/composer/components/ChatInputBox/*`、`src/features/composer/components/Composer.tsx`、`src/features/composer/components/ComposerInput.tsx`
- 样式：`src/styles/composer.css`
- i18n：`src/i18n/locales/zh.ts`、`src/i18n/locales/en.ts`
- 测试：`ConfigSelect` 与 `ComposerInput` 相关回归
