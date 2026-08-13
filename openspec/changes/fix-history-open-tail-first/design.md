## Context

打开 Shared / 长会话的 hydrate 链：

```text
loader.load → hydrateHistory → dispatchThreadItemsProgressively
  → setThreadItems(items.slice(0, 80))
  → yield → slice(0, 160) → … → 全量
useMessagesCanvasFollow stick-to-bottom 每批钉底
```

`f0ef034` 让 V0 立刻卸 curtain，用户看见 prefix 增长 = 「从头刷到最新」。  
迟到 `onSharedProjectionMerged` 再调 `hydrateHistorySnapshot` = 二次刷。  
时间线已永久全量 DOM；消息行禁止 `content-visibility`。  
reducer 已有 `prependThreadItems` + `historyWindowByThread`，画布尚未消费。

## Goals / Non-Goals

**Goals**

1. 首屏 hydrate 的第一帧必须是最新窗口（tail）。
2. 后续扩展只允许向上补更早条目。
3. 迟到 projection 不得从头 progressive 重放。
4. 回看更早历史按批 prepend，并保住 scrollTop 锚点。

**Non-Goals**

- 恢复 virtualization / content-visibility。
- 改 Shared 后端 projection API。
- 改 recovery 发送锁。

## Decisions

### D1 — Progressive 默认 tail-first（采用）

`dispatchThreadItemsProgressively`：

| 阶段 | 行为 |
|------|------|
| ≤ batchSize | 一次 `setThreadItems(items)`（与现网相同） |
| 首包 | `setThreadItems(items.slice(-N))` |
| 后续 | `prependThreadItems(下一段更早 batch)`，或等价地 `setThreadItems(items.slice(-grown))` |

默认 N = 现网 `THREAD_ITEMS_PROGRESSIVE_BATCH_SIZE`（80）。  
禁止再 `slice(0, end)` 递增。

备选（否决）：保持 prefix，只加快 batch — 刷还在。

### D2 — 迟到 merge 走 atomic（采用）

`onSharedProjectionMerged` → `hydrateHistorySnapshot(..., { mode: "atomic" })`：

- 已有 live items：`mergeHistoryProjectionItems` 后单次 `setThreadItems`。
- 线程正在 live turn：保持现网「丢弃迟到 merge」。
- generation / threadId 守卫不变。

备选（否决）：迟到 merge 再跑一遍 progressive — 二次刷。

### D3 — 超长会话：首屏 tail + 顶上芯片分页（采用）

当 `items.length > N`：

1. 首包只进店 tail，并记住更早缓存。
2. 复用幕布已有 `messages-collapsed-indicator`（「上方还有 N 条」），**不**改 `VISIBLE_MESSAGE_WINDOW` / `STREAMING_VISIBLE_WINDOW`（避免动吸底）。
3. 点击芯片只 prepend 一批；用 expansion scroll snapshot 保阅读锚点；先 `pauseFollow()`，**不得**改 `useMessagesCanvasFollow` 吸底算法，**不得**在 `onScroll` / 回顶里自动加载。
4. `messagesPresentationMode` / `followSignal` 仍只跟原 render-window 计数，不把 pending 数混进 presentation 模式。

fork / compact 可传 `mode: "atomic"` 拿全量。

### D4 — 不碰渲染层禁令

不改 `STREAMING_VISIBLE_WINDOW=0`、不恢复 virtualization、不加消息行 `content-visibility`。卡顿靠「店里先少挂」而不是「挂了再藏」。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 搜索 / 大纲只看见已加载窗口 | 可接受；与 Claude `limit=80` 同语义。需要全文时再 prepend |
| 上滚 prepend 高度暴涨跳视口 | 复用 expansion scroll snapshot |
| 迟到 merge 与窗口不一致 | merge 针对缓存全量，再按当前窗口切片进店 |
| 用户以为历史被截断 | 顶部接近时自动补更早；回顶触发加载 |

## Migration

无数据迁移。行为：打开长会话先看到最新。回滚：恢复 prefix slice 即可，不回滚 `f0ef034`。

## Open Questions

- 回顶是一次 prepend 一批，还是连续补到顶：本波「接近顶部则再补一批」，避免一次灌满。
