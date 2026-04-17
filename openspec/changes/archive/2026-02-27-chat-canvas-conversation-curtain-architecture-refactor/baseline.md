# Chat Canvas Curtain Baseline

## 目标

记录会话幕布关键链路的可回归基线，覆盖消息、工具、计划、用户输入、历史恢复五条主路径。

## 基线路径

| 链路 | 基线行为 | 证据 |
| --- | --- | --- |
| Realtime message delta | `item/agentMessage/delta` 与 `text:delta` 统一映射为 `appendAgentMessageDelta` | `src/features/app/hooks/useAppServerEvents.ts` + `src/features/app/hooks/useAppServerEvents.test.tsx` |
| Tool item lifecycle | `item/started/updated/completed` 通过 adapter 输出标准 `tool` 语义 | `src/features/threads/adapters/sharedRealtimeAdapter.ts` + `src/features/threads/adapters/realtimeAdapters.test.ts` |
| Plan source | 历史恢复后通过统一 loader 更新 `setThreadPlan`，与实时路径一致 | `src/features/threads/hooks/useThreadActions.ts` + `src/features/threads/hooks/useThreadActions.test.tsx` |
| Request user input | `requestUserInput` 保持线程隔离、FIFO、去重和提交回传语义，历史恢复可重建 queue | `src/features/app/components/RequestUserInputMessage.test.tsx` + `src/features/threads/hooks/useThreadUserInput.test.tsx` + `src/features/threads/hooks/useThreadActions.test.tsx` |
| History restore | Codex/Claude/OpenCode 历史恢复统一为 `NormalizedHistorySnapshot`，缺失字段显式告警 | `src/features/threads/loaders/*.ts` + `src/features/threads/loaders/historyLoaders.test.ts` |
| Realtime/history parity | 三引擎 `ConversationItem` 序列一致性门禁，非白名单差异可被测试拦截 | `src/features/threads/contracts/realtimeHistoryParity.test.ts` |

## 回归检查命令

```bash
pnpm vitest run \
  src/features/threads/contracts/conversationCurtainContracts.test.ts \
  src/features/threads/adapters/realtimeAdapters.test.ts \
  src/features/threads/loaders/historyLoaders.test.ts \
  src/features/app/hooks/useAppServerEvents.test.tsx \
  src/features/threads/hooks/useThreadActions.test.tsx
```
