## Why

当前 rewind 在执行会话回溯时默认同时执行 workspace 文件回退。对于只想回退对话上下文、但希望保留本地文件改动的用户，这会造成不必要的工作区扰动与恢复成本。需要增加一个显式开关，让用户在回溯时自行决定是否回退文件。

## 目标与边界

### 目标

- 在 rewind 确认弹层新增“回退工作区文件”开关，默认开启。
- 开关开启时保持现有行为：会话回溯 + workspace 文件回退。
- 开关关闭时仅执行会话回溯，不执行 workspace 文件回退；其余回溯链路保持不变。
- 统一 `Claude` 与 `Codex` 的该交互语义，避免引擎行为分叉。

### 边界

- 不改变 rewind 入口位置与整体审查布局（target/impact/files/diff 结构保持不变）。
- 不改变会话回溯成功语义（会话层回溯仍按现有引擎契约执行）。
- 不调整 chat-diff 导出协议；导出继续仅是审查/存档能力，不等价于执行回退。

## 非目标

- 不引入“记住上次开关状态”的持久偏好，首版始终默认开启。
- 不新增第三种执行模式（例如仅部分文件回退）。
- 不改变 `Gemini` 的 rewind 支持范围（本次仅覆盖已有支持引擎 `Claude/Codex`）。

## What Changes

- 在 rewind 确认弹层增加工作区文件回退开关，默认 `ON`。
- `ON`：执行会话回溯前后按现有逻辑执行 workspace 文件恢复与失败回滚。
- `OFF`：跳过 workspace 文件恢复步骤，仅执行会话回溯与会话状态更新链路。
- 前端回调链路新增可选参数（如 `restoreWorkspaceFiles`）用于显式传递用户选择，保持向后兼容。
- 增加 `Claude/Codex` 双引擎回归用例，覆盖开关两种状态下的行为一致性。

## 技术方案对比

### 方案 A：在运行时做隐式规则（例如按 dirty 状态自动决定是否回退文件）

- 优点：交互改动少。
- 缺点：不可预测，用户心智不稳定，难以解释“这次为什么没回退文件/回退了文件”。

### 方案 B：在确认弹层提供显式开关（推荐）

- 优点：行为可预期，用户可控，测试矩阵清晰。
- 缺点：需要新增参数透传与双分支回归用例。

取舍：采用方案 B。该需求属于用户意图控制，必须显式交互而非隐式策略。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `claude-rewind-review-surface`: 新增/修改 rewind 确认弹层的工作区文件回退开关与执行语义。
- `codex-rewind-review-surface`: 新增/修改 rewind 确认弹层的工作区文件回退开关与执行语义。

## Impact

- Frontend
  - `src/features/composer/components/ClaudeRewindConfirmDialog.tsx`
  - `src/features/composer/components/Composer.tsx`
  - `src/features/threads/hooks/useThreadActions.ts`
- Tests
  - `src/features/composer/components/Composer.rewind-confirm.test.tsx`
  - `src/features/threads/hooks/useThreadActions.test.tsx`
  - `src/features/threads/hooks/useThreadActions.codex-rewind.test.tsx`
  - `src/features/threads/utils/claudeRewindRestore.test.ts`

## 验收标准

- rewind 确认弹层 MUST 显示“回退工作区文件”开关，且首次打开默认 `ON`。
- 当开关为 `ON` 时，rewind 行为 MUST 与当前版本一致（包含文件回退与失败回滚）。
- 当开关为 `OFF` 时，rewind MUST 仅回退会话，不得改写当前 workspace 文件。
- `Claude` 与 `Codex` 在开关 `ON/OFF` 下的行为 MUST 一致。
- 开关关闭不得影响会话回溯成功判定与后续 reopen/replay/send 主链路。
