## Context

Shared 历史打开链路（现状）：

```text
createSharedHistoryLoader.load
  → loadSharedSession (V0 meta/items)     // ~48%
  → await loadSharedProjection            // 58% 起死等
  → mergeHistoryProjectionItems
  → normalizeHistorySnapshot → hydrate
  → historyLoading = false                // 才卸 curtain
```

社区卡在 58%；recovery 可能已 clear。开发者压测：`project` 本身秒级；用户机低 CPU/磁盘 → 等待型挂起（writer 队列 / 无超时 invoke）更可信。  
**止血不要求用户操作**：改 ready 门槛，不要求取证。

相关已有 change：`fix-shared-session-recovery-exit-closure`（发送锁出口）；本 change **不替代** 它，只解 history 与 recovery 体感耦合。

## Goals / Non-Goals

**Goals**

1. V0 可用即 first-paint / 解除 `historyLoading` 阻塞。
2. Projection 后台完成；超时/失败有 V0 时降级。
3. 发送门禁：无 recovery 时，projection 未完成 **不得** 阻止发送。
4. 正常秒回路径：最终画布与现网等价（merge 权威不变）。
5. 「已解锁但仍卡」：文档与行为上拆成 recovery vs history 两条线。

**Non-Goals**

- Writer actor 重写、DB 压缩、侧栏 catalog 冷启。
- 永久关闭 projection 或改 canonical 权威。
- Recovery abandon/rebuild 阶梯重做。

## Decisions

### D1 — Two-phase open（采用）

| 阶段 | 条件 | UI / state |
|------|------|------------|
| Phase-A ready | `loadSharedSession` 成功返回 | hydrate V0 items；`historyLoading=false`（或等价「可交互」）；curtain 主阻塞结束 |
| Phase-B enrich | `loadSharedProjection` 成功 | `mergeHistoryProjectionItems` 再 hydrate；可轻量 progress 非阻塞 |
| Phase-B fail/timeout | 已有 V0 | 保持 V0；`console.warn` / 静默 diagnostics；**不** failed 整会话（除非 V0 也空且 projection 失败——保持现网 throw 语义） |

**实现落点优先**：`sharedHistoryLoader.ts` 拆两段，或 loader 仍串行但调用方 **V0 先 `hydrateHistory` + clear loading**，projection 独立 `void` 任务带 generation/stale 守卫。

推荐调用方模式（避免 loader 契约大改）：

```text
// pseudo
report(session done)
const v0 = from loadSharedSession
hydrate + clear historyLoading          // Phase-A
start projection task with gen
  on success: if !stale → merge + hydrate
  on timeout/error: if v0 empty → fail; else keep v0
```

若希望单测仍测 loader 一体，可在 loader 增加 `onPhaseAReady(snapshot)` 回调。

### D2 — Timeout

- 前端对 `loadSharedProjection`：**软超时 12s**（常量可配置，单测可注入）。
- 超时后：abort 等待（invoke 无法真正 cancel Rust 时，**忽略迟到结果或 generation 丢弃**）。
- 不引入用户可见复杂设置。

### D3 — Progress UI

- 58% 文案仅在仍阻塞 curtain 时使用；Phase-A 后 **不得** 整页 historyLoading curtain。
- 可选：非阻塞「同步完整历史…」弱提示（P1，可不做）。

### D4 — Unlock / recovery 边界

| 状态 | 可否发送 |
|------|----------|
| Phase-A done，无 recovery-required | **可** |
| recovery-required | **否**（既有） |
| Phase-B 进行中 | **可**（与 recovery 无关） |

Recovery probe/skip 文案「已解除锁定」只表示 send state；实现不得把 `historyLoading` 与 recovery 绑定。

### D5 — 后台 merge 与实时 turn

- merge 必须走既有 `mergeHistoryProjectionItems` + `hydrateHistory`。
- 使用 resume generation / threadId 守卫，避免切会话写错。
- 流式中 merge：assembler 等价项不炸基数（既有 curtain 合同）。

### D6 — P1 后端（可选同 PR 或 follow-up）

- 冷读路径避免同步 enrich 阻塞 first-paint（enrich 已在 Rust command 内，后台 projection 自然后置）。
- checkpoint 写延后：非本波必须。

### D7 — 静默诊断

- `performance.now` span：`session_ms` / `projection_wait_ms` / `phase`；写入既有 diagnostics 缓冲（若可得），**无 UI、无用户步骤**。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| V0 与 projection 内容差，用户短暂见旧布局 | merge 后收敛；可接受止血 |
| 迟到 projection 覆盖实时消息 | generation + assembler 等价合并 |
| invoke 无法 cancel，后台仍占 writer | 超时丢弃结果；不二次 await |
| 误伤「必须等完整历史再发」产品预期 | 产品确认：发送不依赖完整 projection |

## Migration

无数据迁移。行为：打开 Shared 更快可交互。

## Open Questions

- 软超时默认 12s 是否在 Win 低端再调：发版后看静默日志分布即可。
- 无 V0 且 projection 挂死：仍会失败——是否对「空 V0」也显示可关 curtain：保持 fail closed 到 timeout 后 error UI。
