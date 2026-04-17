## Why

`/review` 的 GUI 快捷入口和预设流程当前只在 `Codex` 引擎显式提供。`Claude Code` 虽然支持命令式工作流，但缺少同等入口，并且现有 review 启动链路会强制重绑到 codex 线程，导致跨引擎体验割裂。

## What Changes

- 在配置面板中将 `Review` 快捷入口扩展到 `Claude Code`（保持 `Speed` 仍为 Codex-only）。
- 在 `Claude Code` 引擎下允许渲染并使用现有 `ReviewInlinePrompt` 预设面板（四项 preset + 两条三级列表）。
- 调整 review 执行分支：
  - `Codex` 保持现有 `start_review` RPC 流程不变。
  - `Claude Code` 改为在 claude 线程透传 `/review ...` 命令文本，不再强制 rebinding 到 codex。
- 保持非目标引擎（如 OpenCode/Gemini）行为不变，不新增 review 快捷入口。

## Capabilities

### New Capabilities

- `claude-chat-canvas-review-quick-action`: 在 Claude 配置面板提供 Review 快捷入口，并将 preset 结果转换为 `/review` 命令透传到 Claude 会话。

### Modified Capabilities

- 无。

## Impact

- 前端 UI
  - `src/features/composer/components/ChatInputBox/selectors/ConfigSelect.tsx`
  - `src/features/composer/components/Composer.tsx`
- 命令与线程编排
  - `src/features/threads/hooks/useThreadMessaging.ts`
- 适配层与透传
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
- 测试
  - `src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx`
  - `src/features/threads/hooks/useThreadMessaging.test.tsx`
