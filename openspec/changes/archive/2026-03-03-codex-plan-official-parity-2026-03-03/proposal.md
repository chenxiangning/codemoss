## Why

当前项目的 Codex Plan 能力已经具备基础可用性，但与官方 `Codex.app` 在三处关键语义仍存在偏差：
1) `collaborationMode` 与默认模式语义；
2) Plan 流式 item 时间线语义；
3) `requestUserInput` 的弹窗判定（`completed` 生命周期）。

这些偏差会造成“行为看似相近但边界不一致”，在复杂会话里容易出现错误弹窗、计划时间线缺失或模式解释冲突。现在推进对齐，可以在不影响其他引擎的前提下，提升 Codex 结果可预测性与可回归性。

## 目标与边界

- 仅调整 `activeEngine === "codex"` 的前后端行为。
- 对齐官方 `turn/start.collaborationMode`、Plan 流式语义、`requestUserInput.completed` 判定。
- 保留当前项目本地增强能力，但下沉为 Codex 专属可切换策略，不外溢到其他引擎。

## 非目标

- 不修改 `claude`、`opencode`、`gemini` 的任何消息链路与 UI 渲染。
- 不改上游 `Codex.app`/`codex-cli` 源码与协议定义。
- 不在本提案中实现多引擎统一模式系统重构。

## What Changes

- 收敛 Codex 模式语义：用户层 `Plan Mode/Default`，运行时层 `plan/code`，并在 `turn/start` 透出确定性 mode 元信息。
- 引入 Plan item 时间线映射：`plan -> proposed-plan`、`planImplementation -> plan-implementation`、`implement-plan:*`。
- 统一 `requestUserInput` 弹窗条件：仅当 `type=userInput && completed != true` 时进入待处理队列。
- 将当前“模式阻断/合成请求”收敛为 Codex 策略层 profile：
  - `official-compatible`（默认）
  - `strict-local`（保留本地增强）
- 建立“不影响非 Codex 引擎”的回归门禁矩阵。

## 技术方案选项与取舍

### 方案 A：直接移除本地增强，完全仿官方

- 优点：语义最接近官方，实现路径短。
- 缺点：会丢失当前项目已有的本地安全增强与运营策略开关，回退粒度不足。

### 方案 B：策略分层（`official-compatible` + `strict-local`）

- 优点：默认官方语义，同时保留本地增强能力，具备低风险切换与回滚。
- 缺点：实现复杂度略高，需要增加策略分支测试。

**选择**：方案 B。原因：在“官方对齐”与“本地可控”之间取得最小风险平衡，且满足仅 Codex 影响的治理要求。

## Capabilities

### New Capabilities
- `codex-chat-canvas-plan-streaming-contract`: 定义 Codex Plan 流式 item 到前端时间线的规范映射与兼容顺序。

### Modified Capabilities
- `codex-chat-canvas-collaboration-mode`: 调整 Codex 默认/显式模式与 `turn/start` 语义对齐规则。
- `codex-chat-canvas-user-input-elicitation`: 增加 `completed` 驱动的弹窗与队列判定规则。
- `codex-collaboration-mode-runtime-enforcement`: 调整 `requestUserInput` 模式阻断为 profile 化策略，默认官方兼容。

## Acceptance Criteria

1. Codex 线程消息启动时，`collaborationMode` 与线程最终生效模式可观测且可验证。
2. Codex Plan 流式事件可稳定映射为 `proposed-plan` / `plan-implementation` 时间线项。
3. 仅 `completed != true` 的 `requestUserInput` 触发待处理卡片，`completed=true` 不弹窗。
4. 默认策略下（`official-compatible`）不出现项目特有强阻断偏差；切换 `strict-local` 后行为可复现现有增强。
5. `activeEngine !== "codex"` 的发送、渲染、工具请求、弹窗行为保持不变。

## Impact

- Frontend（仅 Codex 分支）：
  - `src/features/composer/components/ComposerInput.tsx`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/utils/threadItems.ts`
  - `src/features/messages/components/Messages.tsx`
- Backend（仅 Codex 通道）：
  - `src-tauri/src/shared/codex_core.rs`
  - `src-tauri/src/codex/collaboration_policy.rs`
  - `src-tauri/src/backend/app_server.rs`
- 验证：新增 Codex 专项测试与 non-codex 不变性回归测试。
