# Chat Canvas Curtain Verification Report

## 执行时间

- 2026-02-27

## 验收命令与结果

### 全量验收回归（本次）

```bash
pnpm vitest run \
  src/features/messages/presentation/presentationProfile.test.ts \
  src/features/messages/components/Messages.test.tsx \
  src/features/plan/components/PlanPanel.test.tsx \
  src/features/messages/components/toolBlocks/GenericToolBlock.test.tsx \
  src/features/messages/components/toolBlocks/EditToolGroupBlock.test.tsx \
  src/features/app/components/RequestUserInputMessage.test.tsx \
  src/features/messages/components/chatCanvasSmoke.test.tsx \
  src/features/opencode/components/OpenCodeControlPanel.test.tsx \
  src/features/threads/hooks/useThreadUserInput.test.tsx \
  src/features/threads/hooks/useThreadActions.test.tsx \
  src/features/threads/hooks/useThreadsReducer.test.ts \
  src/features/threads/contracts/conversationAssembler.test.ts \
  src/features/threads/contracts/conversationCurtainContracts.test.ts \
  src/features/threads/contracts/realtimeHistoryParity.test.ts \
  src/features/threads/adapters/realtimeAdapters.test.ts \
  src/features/threads/loaders/historyLoaders.test.ts \
  src/features/app/hooks/useAppServerEvents.test.tsx
pnpm tsc --noEmit
```

- 结果：`17 files / 167 tests` 全通过 + `tsc --noEmit` 通过

## 关键新增验证点

### 6.1 / 6.5 / 7.4 / 9.1 一致性门禁

- 文件：`src/features/threads/contracts/realtimeHistoryParity.test.ts`
- 覆盖：
  - Codex/Claude/OpenCode 实时 vs 历史语义对齐
  - Tool 状态与输出语义一致
  - Reasoning 标题/正文一致
  - 非白名单差异（items）可被门禁捕获

### 6.2 Plan 同源

- 文件：
  - `src/features/messages/components/Messages.test.tsx`
  - `src/features/plan/components/PlanPanel.test.tsx`
- 覆盖：
  - quick view 以 `conversationState.plan` 为单一来源
  - 长计划（40 steps）完整渲染无缺项

### 6.3 UserInput 一致性

- 代码链路：
  - `src/features/threads/loaders/historyLoaderUtils.ts`
  - `src/features/threads/loaders/codexHistoryLoader.ts`
  - `src/features/threads/loaders/opencodeHistoryLoader.ts`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
- 测试覆盖：
  - `historyLoaders.test.ts`：历史快照 userInputQueue 提取
  - `useThreadActions.test.tsx`：统一 loader 恢复 queue
  - `useThreadsReducer.test.ts`：线程维度清理与隔离
  - `RequestUserInputMessage.test.tsx`：FIFO + 失败重试语义
  - `useThreadUserInput.test.tsx`：提交成功移除、失败保留

### 7.5 / 9.2 冒烟链路

- 文件：`src/features/messages/components/chatCanvasSmoke.test.tsx`
- 覆盖：
  - 消息
  - 工具分组
  - Plan quick view
  - request user input 往返
  - 历史快照恢复渲染

## Rollout / Rollback / DoD 文档留痕

- rollout 记录：`rollout.md`
- rollback 预案与演练：`rollback.md`
- 任务状态：`tasks.md`（已勾选至 9.4）

## 已知环境问题

- `src/features/threads/hooks/useThreads.integration.test.tsx` 在本机仍可能触发 Node OOM（历史已知问题）。
- 本次验收未纳入该用例，其他目标门禁均通过。

## 最终结论

- P0/P1/P2 任务已收口，`6.1~9.4` 对应能力与门禁均有代码与测试证据。
- 当前变更满足“实时/历史一致性 + 分阶段 rollout/rollback + 文档齐备”的整体验收条件。
