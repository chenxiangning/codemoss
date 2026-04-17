# Chat Canvas Curtain Rollout Record

## 执行时间

- 2026-02-27

## 阶段启用记录

### Phase A: `chatCanvasUseNormalizedRealtime`

- 验证目标：实时事件统一由 adapter 路由，关闭开关时保持旧路径兼容。
- 验证证据：
  - `src/features/app/hooks/useAppServerEvents.test.tsx`
  - 用例：
    - `routes opencode text:delta through normalized realtime adapters when enabled`
    - `does not route opencode text:delta when normalized realtime adapters are disabled`
    - `keeps token usage updates when normalized realtime adapters handle item/completed`
- 结果：通过，实时链路稳定且可独立回退。

### Phase B: `chatCanvasUseUnifiedHistoryLoader`

- 验证目标：历史恢复统一走 loader，Plan/UserInput 可恢复且可观测 fallback。
- 验证证据：
  - `src/features/threads/loaders/historyLoaders.test.ts`
  - `src/features/threads/hooks/useThreadActions.test.tsx`
  - `src/features/threads/hooks/useThreadsReducer.test.ts`
- 关键覆盖：
  - Codex/OpenCode 历史快照 Plan 与 userInputQueue 提取
  - unified loader 路径下 `setThreadPlan`、`clearUserInputRequestsForThread`、`addUserInputRequest`
  - fallback warning debug 可观测
- 结果：通过，历史恢复与实时语义收敛。

### Phase C: `chatCanvasUsePresentationProfile`

- 验证目标：引擎视觉差异由 profile 注入，不改语义分发。
- 验证证据：
  - `src/features/messages/presentation/presentationProfile.test.ts`
  - `src/features/messages/components/Messages.test.tsx`
  - `src/features/plan/components/PlanPanel.test.tsx`
- 关键覆盖：
  - codex markdown/live-dot 与 opencode heartbeat hint 受 profile gate 控制
  - `conversationState` 计划源优先用于 quick view
  - 长计划列表完整渲染（40 steps）
- 结果：通过，视觉差异可控且语义不变。

## 阶段差异报告（8.4）

- 一致性门禁：
  - `src/features/threads/contracts/realtimeHistoryParity.test.ts`
  - 覆盖 Codex/Claude/OpenCode 的 Tool/Reasoning/Plan/UserInput 语义对齐
  - 非白名单差异（示例：tool status 回退）会被测试捕获
- 冒烟门禁：
  - `src/features/messages/components/chatCanvasSmoke.test.tsx`
  - 覆盖消息、工具分组、Plan quick view、request user input、历史恢复

## 冗余兼容清理（8.5）

- 已清理 unified history 路径中的陈旧队列兼容问题：
  - 新增 `clearUserInputRequestsForThread`，恢复历史前清空目标线程旧请求
  - 按 snapshot `userInputQueue` 重新注入，避免双路径残留与跨轮次泄漏
- 相关文件：
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/features/threads/loaders/historyLoaderUtils.ts`

## 结论

- 三个 feature flag 已具备分阶段启用、独立验证和独立回退能力。
- 阶段差异与回滚路径已留痕，满足 rollout 门禁要求。
