# Design: optimize-cold-start-hydration-orchestration

## Context

### 现场证据（2026-08-08 dump）

| 事实 | 值 |
|------|-----|
| elapsed | 57.5s |
| shell-ready | ~1.7s |
| first-paint task | **缺失**（回归） |
| full-catalog mossx | 20s timeout → degraded，仍 stamp `startup-gate-ready` |
| full-catalog 内容分析 | 16.9s |
| mossx full 再入 | timeout 后 #63 再次 started |
| `opencode_session_list` | 13.0s + 8.7s + 6.3s |
| `list_threads` 同 ws | 5+ 次 |
| 并行杂活 | git_status/diffs ~6.8s、model_list ~6.6s、skills 5s timeout |

### 现状代码锚点

- 编排：`src/features/startup-orchestration/utils/startupOrchestrator.ts`（phase 并发、`thread-session-scan` cap=1）
- 列表调度：`src/app-shell-parts/useWorkspaceThreadListHydration.ts`（first-paint / full-catalog 分阶段意图）
- 列表实现：`src/features/threads/hooks/useThreadActions.ts`（`startupHydrationMode`、OpenCode/Claude/catalog 子源）
- Gate：`src/features/app/components/StartupGateOverlay.tsx`（ready 判定 + 诊断 dump）
- Force-enter：`startupForceEnter.ts`（取消 idle full）
- 既有 spec：`client-startup-orchestration`、`sidebar-list-timeout-fallback`

### 约束

- 不重写 Orchestrator 框架；在现有 phase / dedupe / soft-ignore 上闭环。  
- 用户已接受：**侧栏先短后全**、**OpenCode 冷启懒/可失败 last-good**。  
- 主路径发消息/会话业务语义不改。  
- 三端 Tauri 共用列表编排。

---

## Goals / Non-Goals

**Goals:**

1. 冷启 **产品完成态** = active workspace **first-paint** 完成（或 home 的 input-ready），可交互。  
2. full-catalog 为 **后台一致性**，可 timeout / cancel / 残缺，不得冒充 gate-ready，不得自动无限重扫。  
3. OpenCode 与多引擎子源在冷启有 **IPC 预算** 与 last-good 保种。  
4. 非 active workspace 冷启 **不 full-catalog**。  
5. git / skills / model 与 list **错峰**。  
6. dump / trace 可证明上述契约。

**Non-Goals:**

- 重写对话流 / collab / uiScale 实现。  
- 冷启瞬间 100% 多引擎历史完整。  
- 强制硬取消所有无法 abort 的 Rust IPC（做不到的走 stale 丢弃 + 禁重扫）。

---

## Target metrics（对照 dump）

| 指标 | 基线 dump | 目标（本机同类双 ws + OpenCode 重仓） |
|------|-----------|----------------------------------------|
| dump 含 first-paint task | 无 | **必须有** |
| 到可交互（gate 或 force） | 假 ready ~22s / 真忙 57s | first-paint 后 **≤ 5s 量级**（理想 ≤3s shell+first-paint 主路径） |
| gate-ready 原因 | full timeout 冒充 | first-paint / home input / force-enter **only** |
| 同 `thread-list:full-catalog:ws` timeout 后 60s 再 started | 有 | **0**（除非用户 force / 显式 ensure） |
| 冷启并行 full-catalog ws 数 | 2 | **≤ 1（仅 active）** |
| first-paint 路径含 `opencode_session_list` | 常有（因走了 full） | **0** |
| 同 ws 同阶段 list_threads in-flight | 5+ 次完成 | **1** |

数字为方向性验收；实现以场景单测 + 人工 dump 对比为准。

### Post-implementation（2026-08-08 人工 dump 对照）

| 指标 | 基线 dump | 收口 dump（同机） | 结论 |
|------|-----------|-------------------|------|
| firstPaintPresent | false | **true** | 过 |
| gateReadyReason | full timeout 冒充 | **first-paint-complete** | 过 |
| 可交互（gate） | ~22s 假 ready | **~4.4s** | 过（≤5s 量级） |
| elapsed（遮罩观察窗） | 57.5s | ~18.4s | 改善；后台 full 仍可走 |
| opencode 进 first-paint | 有（误走 full） | first-paint 路径无 | 过 |
| full 超时后自动重扫 | 有 | cooldown 拦截 | 过 |

**本轮已实现代码锚点：**

| 模块 | 路径 |
|------|------|
| first-paint 默认 / 非 active 禁 full / gate stamp | `src/app-shell-parts/useWorkspaceThreadListHydration.ts` |
| gate 归因 | `src/features/startup-orchestration/utils/startupGateReady.ts` |
| full cooldown | `src/features/startup-orchestration/utils/fullCatalogAutoRetry.ts` |
| force-enter stamp | `src/features/startup-orchestration/utils/startupForceEnter.ts` |
| OpenCode 3s 预算 | `useThreadActions.threadList.ts` + `services/tauri/openCode.ts` |
| 诊断 dump / manual-only gate / 折叠加载日志 | `src/features/app/components/StartupGateOverlay.tsx` |

**未做（defer）：** S4 git/skills/model 错峰；list apply stale 加固 4.4。

---

## Decisions

### D1. 完成态分层（Product completion vs Consistency）

```text
shell-ready          → 壳可画
input-ready          → 输入区概念可交互（home / settings 齐）
active-workspace-ready → first-paint list 落地（侧栏可点会话）
startup-gate-ready   → 允许揭遮罩 / 应用 uiScale phase-2
                         仅: first-paint 完成 | home 无 active list | force-enter
full-catalog done    → 后台一致性（可选 badge）；不驱动 gate
```

**Alternatives:** gate 等 full 完（否：57s）；取消 gate（否：假死回归）。

### D2. 冷启 ensure 状态机（useWorkspaceThreadListHydration）

```text
active ws + !uiHydrated
  → kind=first-paint, phase=active-workspace
  → +COLD_START_DELAY (keep ~500ms)
  → list(mode=first-paint)
  → publish UI hydrated + active-workspace-ready
  → MAY stamp startup-gate-ready (if not force-only policy)
  → stop; MUST NOT enqueue automatic full-catalog

active ws + uiHydrated + !fullyHydrated
  → complete history only via Load older / Session Management / user force
  → full-catalog phase=active-workspace 或 on-demand(force)

non-active ws
  → cold-start window (until gate-ready OR first-paint of active done):
       MUST NOT enqueue full-catalog
  → after gate: optional session-radar 轻量 或 进 workspace 再 ensure
  → MUST NOT 与 active full 并行

timeout/degraded on full-catalog
  → mark fullyHydrated OR "full-attempted" 抑制自动重扫
  → MUST NOT stamp gate-ready
  → MUST NOT auto re-queue same dedupeKey for AUTO_RETRY_COOLDOWN (default 60s)
```

**关键修复点：** 查清 dump 中 `phase=on-demand` + 直接 full 的入口（force 误传、uiHydrated 误 true、projection owner 抢 ensure），S1 先修。

### D3. listThreadsForWorkspace 子源预算

| 模式 | Codex 页 | titles | OpenCode | Claude seed | project catalog | gemini/kimi/grok 刷 |
|------|----------|--------|----------|-------------|-----------------|---------------------|
| first-paint | 小页（~5）+ last-good | 可选轻量 | **跳过** | **跳过** | **跳过** | **跳过** |
| full-catalog | 正常/有界 | 有 | **有界 timeout + last-good**（默认 ≤3s 或现有 NATIVE timeout 收紧） | 有界 + last-good | 有界 | fire-and-forget 或 idle |

OpenCode：缩短 `withTimeout`；timeout/reject → `seedLastGoodEngineIntoMerged("opencode")`；结果晚到若 `isStale`/generation 过期 → **丢弃 apply**。

**Alternatives:** full 永不调 OpenCode（过狠，用户已接受懒但非永久禁用）。

### D4. Orchestrator：超时与禁重扫

- 保持 soft-ignore：无法 hard-abort 的 IPC 仍可能跑完。  
- **新增策略（应用层）**：
  - `fullCatalogAttemptedByWs: Set` / `cooldownUntilByDedupeKey`
  - timeout/degraded/stale settle 时写入 cooldown  
  - `ensureWorkspaceThreadListLoaded` 若 hit cooldown 且 !force → no-op  
  - force-enter 已有 cancel idle；扩展为写入 global cooldown for pending fulls  
- `startup-gate-ready`：**删除**「full-catalog finally 里 stamp」路径；改由 first-paint finally 或 home 条件或 force-enter 显式 API。

### D5. 同 ws list_threads 合并

- 已有 orchestrator `dedupeKey`；确保 **所有** ensure 入口走 orchestrator，禁止旁路 `listThreadsForWorkspace` 冷启直调。  
- list 内部：generation + isStale；晚到 setThreads 丢弃。  
- 禁止 first-paint 未完成时再 kick 同 ws full（kind 机已表达）。

### D6. Git / skills / model 错峰

| 源 | 冷启策略 |
|----|----------|
| get_git_diffs | critical/first-paint **禁止**；panel 可见或 idle 后 |
| get_git_status | active 最多 **1 次** snapshot，且 **after first-paint** 或 1.5s idle；禁风暴链式 diffs |
| skills_list | idle-prewarm only；timeout 后 cooldown；不与 thread-session-scan 抢同一用户体感窗优先 |
| model_list / get_engine_models | active 需要的最小集可在 active-workspace；**cache hit 优先**；冷启 forceRefresh=false |

与 `client-startup-orchestration`「git diffs not preloaded unconditionally」「catalog after shell interactive」对齐执行。

### D7. 观测

- diagnostic dump 增加：
  - `gateReadyReason: first-paint | home-input | force-enter | null`
  - `firstPaintPresent: boolean`
  - `fullCatalogAutoRetryBlocked: string[]`（dedupeKeys）
- 保留一键复制；实现期用 dump A/B。

### D8. 模块触面（实施地图）

```text
useWorkspaceThreadListHydration  → 状态机、禁非 active full、gate stamp 迁移、cooldown
useThreadActions(+threadList)    → 子源预算、OpenCode timeout、isStale apply
startupOrchestrator              → 可选：暴露 last settle reason；cancel 默认 stale
startupForceEnter                → cooldown + cancel idle full
StartupGateOverlay               → isLateEnoughReady 与 gate 原因；dump 字段
useGitStatus / layout            → 冷启 defer
useSkills / useModels / engine   → phase + cache + cooldown
tests                            → hydration / orchestrator / gate / timeout-fallback / dump 夹具
```

### D9. 高频 diagnostics 采用 memory-first + durable circuit breaker（2026-08-09）

- 原始 `perf.frame-drop` sample 进入有界 volatile ring，仍可由 Settings「复制卡顿现场」读取，但不触发 `client_store_patch`。
- severe frame 仅在 cooldown 内采样一次到 durable store；若 hotspot 包含 `diagnostics-persist` 或 diagnostics 自身的 `client-store-write`，必须保持 volatile，禁止形成反馈环。
- durable renderer diagnostics 使用 **256 KiB byte budget**；超预算时优先移除最老的 non-actionable entry，再移除最老 actionable entry。
- 普通 durable append 合并窗口提升到 30s；`pagehide` / hidden lifecycle 仍可 immediate flush，保留崩溃前证据。

### D10. Codex page limit 必须成为 scan work budget（2026-08-09）

```text
requestedScanLimit = offset + requestedLimit + 1(next-page proof) + lookahead
files = collect JSONL metadata only → sort mtime desc
preview each candidate with ≤256 KiB read budget
parse until unique session count reaches requestedScanLimit or fixed candidate budget
live thread/list follows the same bounded target
merge/dedupe → slice offset/limit → nextCursor
```

- 不修改 Session Management / usage 的 `Full` 语义；`Full` 在 limit truncation 前继续扫描并合并全部 physical duplicate evidence，只有 Sidebar/daemon 的 `ThreadPreview` 使用 bounded candidate/byte budget。
- 不新增依赖。mtime 只是 bounded candidate ordering；canonical timestamp、alias 与 duplicate merge 仍由既有 parser/merge 负责。
- Desktop unified list 与 daemon live fallback 共享 preview scanner；完整 usage/cost 解析仅供显式 Session Management / usage path。
- outer timeout 继续作为最后兜底；正常 first-page 必须在 bounded work 内自行结束，避免 `spawn_blocking` timeout 后留下长时间 zombie scan。

### D11. 完整目录改为显式需求（2026-08-09）

- 删除 first-paint `finally` 内的 idle full-catalog schedule。
- 删除 workspace background scheduler 的自动 full-catalog prewarm；保留显式 `Load older`、Session Management、用户 force refresh 与 active workspace on-demand ensure。
- first-paint 仍发布可见 5 条与 last-good；不靠遮罩或 disabled button 掩盖后台重活。

### D12. StartupGate diagnostics 改为 pull + click-frozen snapshot（2026-08-09）

- `startupTrace` 是 startup lifecycle 的 canonical fact channel。旧实现又把 started/completed/milestone/success command 镜像到 `globalRuntimeNotices`，截图中的 `events 39 / notices 39` 因而主要是同一事实的双写与双发布。
- 仅删除 `scrollIntoView()` 和 full-window `backdrop-filter` 只能移除 layout/compositing 放大器；Overlay 仍同时订阅 trace/notice、以 100ms elapsed tick 重建 summary，并在展开后持续重投影整条 timeline，点击竞争窗仍存在。
- 新 ownership：正常 task lifecycle、成功 command 与 milestone 只留在 `startupTrace`；只有 failed/timed-out/degraded task 和 failed command 进入 runtime notice。这样保留异常告警，不再复制正常冷启 chatter。
- 折叠 summary 只以 1Hz pull snapshot 更新。用户点击「展开加载日志」时复制 trace/notice 数组，展开期间保持 immutable；收起再展开才取新 snapshot。复制诊断包在用户点击时读取 latest stores，不受展开快照冻结影响。
- Overlay 不订阅 live event cadence、不自动滚动、不使用 full-window `backdrop-filter`。loading 仍为 manual-only；milestone、timeout 与 snapshot 状态均不得自动关闭。

### D13. S7 `input-ready` resource barrier rejected 并完整回滚（2026-08-09）

- `shell-ready` 只描述 React shell 已提交；它不是所有后台资源完成态。但把这一事实升级为全局 barrier，同样不能减少 source work，只会整体后移任务。
- 已回滚 AppShell layout-phase defer/release、current `list_workspaces` settle hard gate、shared `catalog: 1` 串行化、model `idle-prewarm` 改相位，以及 native appearance 前移。`input-ready` 恢复为：有可用 cached workspace 时不等待 current refresh；无 cache 时才等待首轮 workspace read settle。
- 保留可独立证明且不延长 critical path 的改动：settings/workspaces StrictMode in-flight dedupe、CSS-only identity uiScale、default Dock icon skip，以及 workspace 切换/真实 unmount 时精确取消 stale model catalog owner。
- catalog 继续使用既有 domain phase 与 resource cap；不再用一个全局串行队列把本可并行或后置的资源绑在一起。

**人工验收结论：** S7 将安全点击窗口由约 2s 退化到约 3s。根因是 barrier 增加一个 workspace IPC 周期并把 catalog 尾部后移；该方案已从实现与 contract 中移除。

```text
usable cache ────────────────┐
no cache + workspace settle ─┼─ input-ready（不控制全局 catalog 闸门）
settings ready ──────────────┘

startupTrace ──1Hz summary──> collapsed Overlay
             └─click copy───> frozen expanded timeline
```

## 2026-08-09 Break-loop analysis

### 1. Root Cause Category

- **B — Cross-Layer Contract**：UI 的 `limit=5` 只限制 response，Rust local/live source 仍可扫描完整 archive；Desktop 与 daemon fallback 还存在两套路径。
- **B — Cross-Layer Contract**：同一 startup fact 同时写入 `startupTrace` 与 `globalRuntimeNotices`，Overlay 又同时 live subscribe 两个 channel，形成 observer fan-out。
- **D — Test Coverage Gap**：既有 hydration tests 锁住了 task 顺序，却没有锁住 underlying file bytes、candidate count 与 diagnostics durable write amplification。
- **D — Test Coverage Gap**：旧 Overlay test 反而要求展开后 live rows 继续更新，没有锁定 click snapshot frozen 与 summary refresh 上限。
- **E — Implicit Assumption**：把 `spawn_blocking + timeout` 当作 work cancellation；实际上 timeout 只停止等待，blocking scan 继续占用磁盘/CPU。

### 2. Why Earlier Fixes Only Reduced The Symptom

1. first-paint / idle orchestration 只改变“何时发请求”，没有让 `cursor + limit` 成为 backend work budget。
2. soft-ignore / timeout 避免晚到 UI apply，但无法中止已启动的全量 JSONL scan。
3. frame-drop diagnostics 记录了症状，却以全量 durable rewrite 放大同一主线程 stall，形成 observer feedback loop。
4. 删除 auto-scroll / backdrop-filter 只降低单次 render 成本；live dual-channel subscription 与 100ms summary rebuild 仍在持续生产 render work。
5. S7 barrier 只搬移竞争窗口，未删除生产者；还把原约 2s 的 input-ready 推迟到约 3s。

### 3. Prevention Mechanisms

| Priority | Mechanism | Action | Status |
|---|---|---|---|
| P0 | Architecture | Sidebar/daemon 共用 bounded preview scanner；Session Management 显式 full parser | DONE |
| P0 | Runtime | frame sample memory-first；severe cooldown；diagnostics-owned hotspot circuit breaker | DONE |
| P0 | UI ownership | normal startup facts 单写 trace；Overlay 1Hz pull + click-frozen timeline；copy on demand | DONE |
| P0 | Test | 锁定 candidate/unique/byte budget、Desktop/daemon callers、no-auto-full 与 zero-write | DONE |
| P0 | Test | 锁定 no normal trace→notice mirror、summary ≤1Hz、展开 snapshot frozen、manual-only loading | DONE |
| P1 | Documentation | OpenSpec + Trellis quality/catalog contract 写入 executable gates | DONE |

### 4. Systematic Expansion

- 任何 pagination API 都必须区分 **response limit** 与 **source work budget**；只在尾部 `.take(limit)` 不算 bounded。
- 任何 telemetry 都必须审计 observer cost 与 feedback ownership；性能观测不得逐 sample durable persist。
- 同一 diagnostic fact 必须有一个 canonical channel；派生 UI 使用低频 pull 或 user-action snapshot，禁止在冷启主链上把 mirrored stores 同时 live subscribe。
- timeout 包裹 non-abortable blocking work 只能作为 fallback，不得作为正常性能边界。

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 侧栏短暂缺 OpenCode/多引擎会话 | last-good + 进引擎/刷新补全；UI 不永久 loading |
| soft-ignore IPC 仍跑完占 CPU | cooldown 禁重扫 + stale 丢弃 apply；后续可 Rust abort |
| first-paint 仍慢（Codex 本身） | 保持小页 5；last-good 先显 |
| 修 ensure 入口漏网 | 全仓 rg `listThreadsForWorkspace` / `startupHydrationMode` 审计 |
| 双 ws 用户切库「空一下」 | 切过去 on-demand ensure；缓存优先 |
| gate 更早揭开后点击撞 full | first-paint settle 不再自动 full；显式加载仍走 bounded work；setThreads startTransition+yield 保留 |

---

## Migration Plan

### 落地顺序（与 proposal S0–S5 对齐）

1. **S0** dump 字段 + 失败夹具（先可观测）  
2. **S1** ensure 路径纠偏：必 first-paint；修 on-demand 误入  
3. **S2** gate-ready 迁出 full finally；timeout 不 stamp  
4. **S3** cooldown 禁重扫；OpenCode/full 子源预算；stale apply  
5. **S4** 非 active 冷启不 full；git/skills/model 错峰  
6. **S5** 回归矩阵 + 文档 + 可选收起 DEBUG 遮罩策略（另 chore）

### 回滚

- 功能点尽量可 flag 或单 PR 回退：  
  - `COLD_START_FULL_CATALOG_COOLDOWN` 关闭 → 恢复旧重扫（不推荐）  
  - OpenCode 预算恢复旧 timeout  
  - gate stamp 临时加回 full（仅应急）  
- 不写坏用户数据；settings 不静默改写。

---

## Open Questions

| # | 问题 | 默认（实现前可改） |
|---|------|-------------------|
| Q1 | first-paint 完成后是否自动 stamp gate-ready？ | **可以 stamp 诊断事件，但 Overlay 不得据此自动关闭**；仅用户点击 force-enter 才揭开遮罩 |
| Q2 | OpenCode full-catalog timeout 默认多少 ms？ | **3000ms** 起步，可配置常量；失败 last-good |
| Q3 | 非 active 是否允许 idle session-radar 轻扫？ | **gate 之后**才允许；冷启窗禁止 |
| Q4 | full timeout 后 `fullyHydrated` 是否标 true？ | 标 **`fullAttempted`**，UI 卸 loading；允许用户手动 force 再扫 |

---

## Validation matrix（实现门禁）

| Case | 期望 |
|------|------|
| Good: 单 active + 缓存 | first-paint &lt; 2s 级；gate 因 first-paint；无 opencode in first-paint |
| Base: 双 ws + OpenCode 重 | 仅 active first-paint；无 background full；无双 workspace 重扫 |
| Bad: force-enter at 10s | 无 startup-owned full 重入；无 stamp 假 ready 以外的重扫；可点 |
| Bad: full timeout | degraded + last-good；gate 不因此 ready；60s 无 auto retry |
| Regress: 发消息 / 开旧会话 | 行为与改前一致 |
| Recurrence: diagnostics enabled + cold click | raw frame-drop 不触发 durable write；store payload ≤256 KiB；诊断写不会产生 durable frame-drop feedback |
| Recurrence: 235 MiB Codex history + limit=5 | local/live scan 使用 bounded target；禁止 `usize::MAX`；first-page 不等完整历史扫描 |
| Recurrence: first-paint settle | 不自动 started full-catalog；Load older / Session Management 仍能取得后续历史 |
| Recurrence: <1s 展开加载日志 + live trace burst | 点击时冻结 timeline；展开期间不随 burst 重投影；收起再展开刷新；copy 读取 latest；不调用 `scrollIntoView()`、不使用 full-window `backdrop-filter` |

---

## References

- proposal.md（本 change）  
- `docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md`  
- `openspec/specs/client-startup-orchestration/spec.md`  
- `openspec/specs/sidebar-list-timeout-fallback/spec.md`
