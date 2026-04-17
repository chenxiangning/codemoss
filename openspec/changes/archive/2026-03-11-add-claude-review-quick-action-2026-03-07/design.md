## Summary

本变更采用“同一套 UI，不同执行后端”策略：复用已有 `ReviewInlinePrompt`，仅在 review 启动层按引擎分流，确保 codex 逻辑零回归。

## Goals

- Claude 引擎具备与 Codex 一致的 Review 快捷入口和 preset 交互体验。
- Codex review 执行链路保持原样。
- 新增逻辑边界清晰，避免对非目标引擎造成行为漂移。

## Non-Goals

- 不为 OpenCode/Gemini 新增 review GUI 快捷入口。
- 不重构 `ReviewInlinePrompt` UI/交互。
- 不修改 codex daemon / tauri review RPC 协议。

## Architecture

### 1) UI 可见性边界

- `ConfigSelect`：`Review` 项由 `isCodexProvider` 扩展为 `isCodexProvider || isClaudeProvider`。
- `Speed` 继续保持 `codex` 可见，不改其任何判断。
- `Composer`：`ReviewInlinePrompt` 渲染条件扩展至 claude/codex。

### 2) Review 执行分流

在 `useThreadMessaging.startReviewTarget` 中新增执行引擎决策：

- `reviewExecutionEngine = activeEngine === "claude" ? "claude" : "codex"`
- 当 `reviewExecutionEngine === "codex"`：保持原 `start_review` RPC 分支与 codex rebind 逻辑。
- 当 `reviewExecutionEngine === "claude"`：
  - 确保 thread 与 `claude` 兼容，不兼容时 rebind 到 claude 线程。
  - 将 `ReviewTarget` 序列化为 slash 命令文本并通过现有 `sendMessageToThread` 发送。

命令序列化规则：

- `uncommittedChanges` -> `/review`
- `baseBranch` -> `/review base <branch>`
- `commit` -> `/review commit <sha> [title]`
- `custom` -> `/review custom <instructions>`

### 3) 兼容性与回归防护

- Codex 分支保持原函数调用顺序和错误提示逻辑。
- Claude 分支仅复用现有消息发送能力，不新增后端接口。
- 非 claude/codex 引擎保持旧行为（不展示 Review 快捷入口）。

## Risks & Mitigations

- 风险：slash 命令透传格式不一致。
  - 缓解：统一在 hook 内做 `ReviewTarget -> command` 序列化，避免多处拼接。
- 风险：线程引擎与 threadId 前缀不兼容。
  - 缓解：复用现有 `isThreadIdCompatibleWithEngine` + `startThreadForWorkspace` rebind。
- 风险：Codex 既有流程被误改。
  - 缓解：保留 codex 分支代码路径，新增测试断言 codex 仍调用 `startReviewService`。

## Validation Plan

- `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx`
- `pnpm vitest run src/features/threads/hooks/useThreadMessaging.test.tsx`
- `pnpm tsc --noEmit`
