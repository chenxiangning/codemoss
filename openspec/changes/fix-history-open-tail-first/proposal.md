# Proposal: fix-history-open-tail-first

> OpenSpec change id: `fix-history-open-tail-first`  
> 关联：`fix-shared-history-projection-nonblocking`（V0 先画）、`windowed-transcript-load`（Claude tail 80）、用户视频 `47ef7f02…`（2026-08-13）

## Why

`f0ef034` 卸掉 Shared 历史 curtain 后，打开中断 / 锁定 / 失败长会话不再卡 58%，但用户立刻看到画布**从最早一条往最新演**（「刷」），再从头回看工具卡墙会很卡。根因不是 V0 first-paint 本身，而是 `dispatchThreadItemsProgressively` 按 **prefix**（`items.slice(0, 80/160/…)`）灌店，叠加 stick-to-bottom，把「拆主线程 commit」做成了历史回放。迟到 projection 再走一遍 hydrate 还会二次刷。

## What Changes

- 历史 hydrate 默认改为 **tail-first**：首包必须是最新 N 条；后续只允许向上 prepend 更早批次，禁止从 index 0 递增覆盖。
- Shared 迟到 projection merge：**禁止再走 prefix/progressive 重放**；已有画布时原子替换或按当前窗口补差。
- 长会话首屏只钉最新窗口；向上滚动 / 回顶时再加载更早历史（复用已有 `prependThreadItems` + `historyWindowByThread`）。
- **不**回滚 `f0ef034`；**不**恢复消息行 `content-visibility`（已有 jetbrains 跳底事故禁令）；**不**恢复 streaming virtualization。

## 目标与边界

- **目标**：打开中断 / 锁定 / 失败 / 长 Shared 会话，首屏落在最新回合；不得把全量历史当录像播放；回看更早上下文按批 prepend，而不是一打开就全量 DOM。
- **边界**：只改打开 hydrate 方向、迟到 merge、以及「更早历史」进店方式。发送锁 / recovery / V0+12s 软超时合同不变。

## 非目标

- 不恢复时间线 TanStack Virtual（streaming 与 stick-to-bottom 冲突仍在）。
- 不给消息行加 `content-visibility`（`messages.part1.css` 明确禁用）。
- 不改 SharedEventWriter / projection 权威 / Claude 磁盘 windowed IO 契约。
- 不把搜索做成 FTS，不要求 fork/compact 路径也窗口化（那些路径可 atomic 全量）。

## Capabilities

### New Capabilities

- `history-open-tail-first`: 会话打开 / 历史 hydrate 必须以最新窗口 first-paint；progressive 只允许 tail 扩展；迟到 merge 不得从头重放。

### Modified Capabilities

- `shared-history-open-nonblocking`（active change，尚未进 main specs）：迟到 projection 必须与 live 画布合并且不得二次 prefix 播放。
- `transcript-windowed-load`（active change）：明确 Shared / 非 Claude 打开路径在内存侧也遵守「先最新窗口」。

## Impact

- Frontend: `dispatchThreadItemsProgressively.ts`、`useThreadActionsResumeThread.ts`、Messages 上滚/回顶加载更早、相关 vitest。
- State: 复用 `setThreadHistoryWindow` / `prependThreadItems`（reducer 已有，此前无画布消费方）。
- 无后端 API 变更；Shared 仍一次取出 V0，窗口切在 dispatch 层。

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 回滚 `f0ef034` | 把 curtain 找回来挡住刷 | 用户已确认改善；回滚只藏问题 |
| **B. tail-first + 上滚 prepend（推荐）** | 首屏最新 N；更早历史按需/分批向上补 | 对症；复用已有 reducer |
| C. 恢复 idle virtualization / content-visibility | 全量进店但少画 | 与 2026-08 stick-to-bottom 事故冲突，禁 |

采用 **B**。

## 验收标准

1. 打开工具卡很多的中断 / 失败 Shared 会话：首屏可见最新回合（失败条 / 「继续」），**不得**从会话开头连续翻到最新。
2. 迟到 projection 合并后画布不二次从头播放；live 新消息不被整表冲掉。
3. 向上滚动或点回顶：更早批次 prepend，滚动锚点不跳到底。
4. 短会话（≤ batch size）仍一次 `setThreadItems`，行为与现网一致。
5. 相关 vitest 绿；不 commit，交用户手测。
