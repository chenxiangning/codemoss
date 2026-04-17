# Chat Canvas Curtain Sample Set

## 固化样本清单

> 日期：2026-02-27

| Engine | 样本 ID | 覆盖点 | 来源 |
| --- | --- | --- | --- |
| Codex | `codex-realtime-tool-001` | `item/started` tool 映射、`item/completed` usage 透传 | `src/features/threads/adapters/realtimeAdapters.test.ts` |
| Codex | `codex-history-plan-001` | `resume thread -> normalized snapshot` + 计划归一化 | `src/features/threads/loaders/historyLoaders.test.ts` |
| Codex | `codex-realtime-history-parity-001` | Tool/Reasoning/Plan/UserInput 实时与历史一致性门禁 | `src/features/threads/contracts/realtimeHistoryParity.test.ts` |
| Claude | `claude-history-tool-result-001` | JSONL tool call + result 合并、终态映射 | `src/features/threads/loaders/historyLoaders.test.ts` |
| Claude | `claude-realtime-history-parity-001` | Reasoning + tool 语义序列对齐 | `src/features/threads/contracts/realtimeHistoryParity.test.ts` |
| OpenCode | `opencode-text-delta-heartbeat-001` | `text:delta` 归一化与 heartbeat presentation-only | `src/features/threads/adapters/realtimeAdapters.test.ts` |
| OpenCode | `opencode-history-missing-thread-001` | 历史缺失 fallback warning 可观测 | `src/features/threads/loaders/historyLoaders.test.ts` |
| OpenCode | `opencode-realtime-history-parity-001` | Tool/Reasoning/Plan/UserInput 实时与历史一致性门禁 | `src/features/threads/contracts/realtimeHistoryParity.test.ts` |
| Cross Engine | `chat-canvas-smoke-001` | 消息/工具/计划/提问/历史恢复冒烟 | `src/features/messages/components/chatCanvasSmoke.test.tsx` |

## 最小回放命令

```bash
pnpm vitest run \
  src/features/threads/adapters/realtimeAdapters.test.ts \
  src/features/threads/loaders/historyLoaders.test.ts \
  src/features/threads/contracts/realtimeHistoryParity.test.ts \
  src/features/messages/components/chatCanvasSmoke.test.tsx
```

## 说明

- 样本均包含至少一个工具或计划相关语义。
- 样本以测试用例形式固化，可重复回放并用于回归门禁。
