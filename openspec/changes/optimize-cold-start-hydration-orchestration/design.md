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
| 诊断 dump / 自动关闸 / 折叠加载日志 | `src/features/app/components/StartupGateOverlay.tsx` |

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
  → scheduleWhenBrowserIdle(min 1.5s) → full-catalog ONCE
       unless force-entered / cancelled / already fullyHydrated

active ws + uiHydrated + !fullyHydrated
  → full-catalog only via idle / user force，phase=active-workspace 或 on-demand(force)

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

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 侧栏短暂缺 OpenCode/多引擎会话 | last-good + 进引擎/刷新补全；UI 不永久 loading |
| soft-ignore IPC 仍跑完占 CPU | cooldown 禁重扫 + stale 丢弃 apply；后续可 Rust abort |
| first-paint 仍慢（Codex 本身） | 保持小页 5；last-good 先显 |
| 修 ensure 入口漏网 | 全仓 rg `listThreadsForWorkspace` / `startupHydrationMode` 审计 |
| 双 ws 用户切库「空一下」 | 切过去 on-demand ensure；缓存优先 |
| gate 更早揭开后点击撞 full | full 在 idle；force-enter 取消 full；setThreads startTransition+yield 保留 |

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
| Q1 | first-paint 完成后是否自动 stamp gate-ready，还是仍等 MIN_VISIBLE_MS？ | **自动 stamp 事件**；Overlay 仍可保留 min visible / 手动 force（实现时与当前 DEBUG 自动关闭策略协调） |
| Q2 | OpenCode full-catalog timeout 默认多少 ms？ | **3000ms** 起步，可配置常量；失败 last-good |
| Q3 | 非 active 是否允许 idle session-radar 轻扫？ | **gate 之后**才允许；冷启窗禁止 |
| Q4 | full timeout 后 `fullyHydrated` 是否标 true？ | 标 **`fullAttempted`**，UI 卸 loading；允许用户手动 force 再扫 |

---

## Validation matrix（实现门禁）

| Case | 期望 |
|------|------|
| Good: 单 active + 缓存 | first-paint &lt; 2s 级；gate 因 first-paint；无 opencode in first-paint |
| Base: 双 ws + OpenCode 重 | 仅 active full；dump 无双 full 并行；timeout 无第二轮 |
| Bad: force-enter at 10s | cancel idle full；无 stamp 假 ready 以外的重扫；可点 |
| Bad: full timeout | degraded + last-good；gate 不因此 ready；60s 无 auto retry |
| Regress: 发消息 / 开旧会话 | 行为与改前一致 |

---

## References

- proposal.md（本 change）  
- `docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md`  
- `openspec/specs/client-startup-orchestration/spec.md`  
- `openspec/specs/sidebar-list-timeout-fallback/spec.md`
