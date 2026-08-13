## Why

Shared Session 在 `liveTextExternalization` 开启时只把首个 assistant delta 写入根 reducer；后续正文停留在内存 live channel。当前 `turn/completed` 又因 `seenDelta=true` 跳过完整 final settlement，导致 Shared snapshot 永久落盘为“我是”或 `Cl` 等前缀。这说明实时性能基石只完成了 render 降频，没有闭合 terminal durability contract。

## 目标与边界

- Shared Turn 完成时，provider terminal final 必须覆盖同一 assistant item 的流式壳文本。
- Shared snapshot 持久化只能观察已收敛的完整 final，不得把 live channel 首段当作完成态。
- canonical/Legacy dual-read 合并时，canonical metadata 可覆盖身份，但较短正文不得降级较完整正文。
- 对已经截断且 Native binding 仍可读取的当前受影响会话执行一次可回滚恢复。

## 非目标

- 不让 Shared history loader 常态读取或拼接 Native CLI 历史。
- 不恢复逐 delta dispatch 到根 reducer。
- 不改变 Native Session 的 DataSource 或 Shared/Native 存储隔离。
- 不引入新的 dependency 或全量历史迁移框架。

## What Changes

- Shared `turn/completed` 在存在 provider final 时，不再被 `seenDelta` 单独阻断；final 使用当前流式 assistant item identity 完成 settlement。
- 扩展 assistant event tracker，保存每个 thread 最近的流式 assistant item ID，保证 final 替换而非新增第二条消息。
- dual-read 合并增加“正文完整度单调性”：metadata overlay 不得把长正文覆盖成短前缀。
- 增加“首 delta + terminal final + snapshot reload”回归测试。
- 备份并追加修复当前受影响 Shared snapshot，不重写既有日志。

## 技术方案对比

1. **推荐：terminal final 原位收敛 + history 单调合并。** 保留 A4 性能收益，仅在回合完成时进行一次 reducer settlement；符合现有设计“终稿一次性落 reducer”。
2. **备选：turn completed 时 drain live channel。** 可以保留已累计文本，但仍可能缺少 provider authoritative final，且无法处理 runtime 对正文的最终改写。
3. **拒绝：Shared history 常态读取 Native transcript。** 能掩盖持久化错误，但破坏 Shared/Native DataSource 隔离并增加 I/O、归属和 Provider 切换复杂度。

## 验收标准

- Claude Shared Turn 收到 `Cl` 流式前缀和完整 `turn/completed.result.text` 后，幕布只保留一条完整 assistant final。
- 320ms Shared snapshot sync 后重载，assistant 正文与 terminal final 一致。
- canonical assistant 为 Legacy assistant 的短前缀时，最终正文保留较完整 Legacy 文本，同时保留 canonical execution target。
- reasoning、工具项和 Provider badge 不回退。
- 只运行受影响 Vitest、TypeScript typecheck、局部 ESLint 与 OpenSpec strict validation。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `conversation-realtime-history-parity`: Shared realtime terminal settlement 必须在持久化前把完整 final 收敛到流式 assistant item。
- `shared-canonical-projection`: canonical metadata overlay 不得以较短或截断正文降级 Legacy presentation transcript。

## Impact

- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/threads/assembly/conversationAssembler.ts`
- Shared realtime/history focused tests
- 当前受影响的 append-only Shared snapshot 数据
- `dev-guidelines/frontend/messages-streaming-render-contract.md`
