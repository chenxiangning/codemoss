## Context

- 现状：`useQueuedSend` 的 auto-drain effect 仅读 `activeThreadId`、`isProcessing`、`activeTerminalPulse`、`hasPendingUserInput`（均 active 作用域）。
- 存储已是 `queuedByThread`；`sendUserMessageToThread` 与 `threadStatusById[t].isProcessing` 已存在。
- Codex 为填「queue 摘掉到 history 落地」空窗引入 `queuedHandoff`，但 **先 handoff、后异步删 queue**，长窗口双显（图1）。

## Goals / Non-Goals

**Goals**

1. Per-thread ready 判定 + 全局调度循环（S1）。
2. `MAX_BACKGROUND_QUEUE_DRAIN = 3`；active 优先且不计入后台配额。
3. Drain 原子：claim → 乐观出队 → handoff（Codex）→ dispatch → success 保持出队 / fail 回队。
4. Handoff state 在等价 user item 可见时主动 clear。
5. 不串线：非 active 禁止走 active-bound `sendUserMessage`。

**Non-Goals**

- S2 UI、设置项、Toast 产品流
- Backend contract
- 可配置并发（常量 3）

## Decisions

### D1: 调度落点

**决策**：扩展 `useQueuedSend`，不新建独立 scheduler 包。  
**原因**：队列/inFlight/fusion/handoff 状态已内聚；拆包成本高于收益。

### D2: 并发模型

**决策**：`MAX_BACKGROUND_QUEUE_DRAIN = 3`。  
- active thread drain 不占配额  
- 后台 in-flight 计数 = 非 active 且 `inFlightByThread[t]` 非空 的数量  
**备选**：1（更保守）→ 用户指定 3。

### D3: 乐观出队（修残留）

**决策**：进入 inFlight 的同一同步段内从 `queuedByThread` 移除 item。  
Fail/blocked：`prepend` 回队（保留原 `id`），clear handoff。  
**备选**：仅 MessageQueue 过滤 inFlight → 不足，state 仍脏。

### D4: 不串线

**决策**：

1. `QueuedMessage` 在 enqueue 时写入 `ownerWorkspaceId` + 使用 enqueue 时的 `threadId`。  
2. Drain 时 `sendUserMessageToThread` 使用 **item 的 owner**，不是 `activeWorkspace`/`activeThreadId`（除非 active 且一致）。  
3. 若 owner workspace 不可解析 → 不 drain，item 留队（或仅当仍是 active 时 fallback 旧路径）。

### D5: Per-thread 门闩来源

| 信号 | 来源 |
|---|---|
| isProcessing | `threadStatusById[t].isProcessing` |
| terminalPulse | 扩展传入 `terminalPulseByThread`；active 的现有 pulse 写入 map |
| pendingUserInput | `pendingUserInputByThread`；至少 active 正确；未知 thread 默认 false |
| fusion / inFlight | 已有 per-thread state |
| shared idle | 仅 shared session thread；用该 thread 的 shared send state |

### D6: UI

**决策**：无 S2 UI。残留修复只改错误双显。不新增角标/Toast。

### D7: 应急闸

```ts
const ENABLE_BACKGROUND_QUEUE_DRAIN = true;
const MAX_BACKGROUND_QUEUE_DRAIN = 3;
```

常量级，非 Settings。

## Risks / Trade-offs

| 风险 | 缓解 |
|---|---|
| 多会话 high demand | maxBg=3；失败回队不丢 |
| 误发错 thread | owner 字段 + 单测 |
| 乐观出队丢消息 | fail prepend 同 id + 测试 |
| jank | 不增 delta 频率；复用 batching |
| reviewing 全局 | 若仅 active reviewing，后台仍可 drain；与今日「非焦点本就不跑」比可接受 |

## Migration

无持久化迁移。内存队列语义：从「切走暂停」变为「后台继续」。

## Open Questions

无。

## Post-incident safe S1 (2026-08-11)

见 `INCIDENT.md`。默认后台 **开**、cap=**1**；防重发三闸永开；drain 触发用 `queueDrainSignal` 而非整表 `threadStatusById`。
