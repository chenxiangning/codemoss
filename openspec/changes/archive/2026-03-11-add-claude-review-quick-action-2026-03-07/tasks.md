## 1. Claude Review 入口扩展（P0）

- [x] 1.1 `ConfigSelect` 将 `Review` 快捷入口可见性扩展到 `claude`，并保持 `Speed` 仅 `codex` 可见。
- [x] 1.2 `Composer` 放开 `ReviewInlinePrompt` 渲染引擎限制（支持 `claude` + `codex`）。
- [x] 1.3 `Composer` 快捷命令桥接允许在 `claude` 引擎下触发 `/review`（保持原 `onCodexQuickCommand` 接口不变，仅扩展执行边界）。

## 2. Review 执行分流（P0）

- [x] 2.1 在 `useThreadMessaging.startReviewTarget` 新增执行引擎决策，不再对 `claude` 强制切到 codex。
- [x] 2.2 增加 `ReviewTarget` 到 `/review ...` 文本命令的序列化函数，并在 claude 分支透传发送。
- [x] 2.3 保留 codex 分支现有 `startReviewService` 链路与错误处理逻辑。

## 3. 测试与回归（P1）

- [x] 3.1 更新 `ConfigSelect.test.tsx`：断言 Review 在 claude 下可见、Speed 仍不可见。
- [x] 3.2 更新 `useThreadMessaging.test.tsx`：断言 claude review 走命令透传，codex review 仍走 RPC。
- [x] 3.3 执行 `pnpm tsc --noEmit`。

## 执行记录（2026-03-07）

- 自动化验证通过：
  - `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ConfigSelect.test.tsx src/features/threads/hooks/useThreadMessaging.test.tsx`
  - `pnpm tsc --noEmit`
- 边界确认：
  - `Speed` 仍为 `codex` 独占入口。
  - `Review` 扩展到 `claude + codex`，且 `codex` 执行链路未改为 CLI 透传。
