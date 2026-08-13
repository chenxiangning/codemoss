# Tasks: optimize-cold-start-hydration-orchestration

> OpenSpec change: `optimize-cold-start-hydration-orchestration`  
> 原则：每项 ≤2h；先可观测与路径纠偏，再 gate/cooldown/IPC 预算，最后错峰与验收。  
> **实现收口（2026-08-08）**：S0–S3 + Overlay 观测/自动关闭已落地；S4 git/catalog 错峰与 4.4 晚到 apply 审计 **留待后续**。

## 1. S0 观测与失败夹具

- [x] 1.1 扩展 diagnostic dump 字段：`firstPaintPresent`、`gateReadyReason`、`fullCatalogAutoRetryBlocked[]`（`StartupGateOverlay` / `buildStartupGateDiagnosticDump`）  
  - **In:** 现有 dump 文本  
  - **Out:** 复制包含上述字段  
  - **Verify:** unit test dump 字符串包含字段  
  - **Pri:** P0 · **Dep:** —  
  - **Code:** `src/features/app/components/StartupGateOverlay.tsx` · `buildStartupGateDiagnosticDump`

- [x] 1.2 增加「无 first-paint / gate 由 full timeout stamp」的回归测试夹具（基于 trace events 断言）  
  - **In:** design validation matrix Bad cases  
  - **Out:** gate 归因与 first-paint 路径可自动断言  
  - **Verify:** `startupGateReady.test.ts` + hydration / overlay tests  
  - **Pri:** P0 · **Dep:** 1.1

## 2. S1 冷启路径纠偏（必 first-paint）

- [x] 2.1 审计所有 `listThreadsForWorkspace` / `ensureWorkspaceThreadListLoaded` / `startupHydrationMode` 冷启入口  
  - **In:** rg 全仓  
  - **Out:** 注释锚定于 `listThreadsForWorkspaceTracked` 默认 kind 分支（禁止冷启默认 full）  
  - **Verify:** 代码注释 + unit 冷启 first-paint  
  - **Pri:** P0 · **Dep:** —

- [x] 2.2 修正 `useWorkspaceThreadListHydration`：active 且 `!uiHydrated` 强制 `kind=first-paint`；禁止冷启第一次 ensure 直接 full  
  - **In:** 2.1 结论  
  - **Out:** 代码路径符合 cold-start contract  
  - **Verify:** unit：冷启 active ensure 产生 first-paint task  
  - **Pri:** P0 · **Dep:** 2.1  
  - **Code:** `src/app-shell-parts/useWorkspaceThreadListHydration.ts`

- [x] 2.3 非 active workspace 在 cold-start 窗禁止 enqueue full-catalog  
  - **In:** 2.2  
  - **Out:** 双 ws 冷启仅 active 重 list  
  - **Verify:** unit + 人工 dump（第二轮 full 不再双 ws 并行）  
  - **Pri:** P0 · **Dep:** 2.2

## 3. S2 Gate 诚实语义

- [x] 3.1 从 full-catalog `finally` 移除 `recordStartupMilestone("startup-gate-ready")`  
  - **In:** `useWorkspaceThreadListHydration.ts`  
  - **Out:** full settle 不 stamp gate  
  - **Verify:** unit：full 后 milestones 无由 full 冒充 gate-ready  
  - **Pri:** P0 · **Dep:** —

- [x] 3.2 在 first-paint 成功时 stamp gate-ready（reason=`first-paint-complete`）；force-enter 单独协调  
  - **In:** 3.1  
  - **Out:** gate 归因可测  
  - **Verify:** unit + dump `gateReadyReason: first-paint-complete`  
  - **Pri:** P0 · **Dep:** 3.1, 2.2  
  - **Code:** `startupGateReady.ts` · `startupForceEnter.ts`

- [x] 3.3 更新 `StartupGateOverlay` gate-ready 诊断；保持 manual-only；诊断双栏默认折叠
  - **In:** 3.2  
  - **Out:** Overlay 展示 milestone，但不据此自动关闭
  - **Verify:** `StartupGateOverlay.test.tsx` manual-only / force-enter
  - **Pri:** P1 · **Dep:** 3.2

## 4. S3 禁重扫 + 子源预算 + stale apply

- [x] 4.1 实现 full-catalog cooldown（默认 60s）：timeout/degraded/force-enter 写入；ensure 自动路径命中则 no-op  
  - **In:** design D4  
  - **Out:** `fullCatalogAutoRetry.ts`  
  - **Verify:** unit：timeout 后 60s 内无二次 started  
  - **Pri:** P0 · **Dep:** 3.1

- [x] 4.2 first-paint 路径跳过 OpenCode/Claude seed/project catalog 等重刷  
  - **In:** `useThreadActions.ts` `isFirstPaintHydration`  
  - **Out:** 行为与 contract 一致  
  - **Verify:** dump first-paint 无 `opencode_session_list`  
  - **Pri:** P0 · **Dep:** 2.2

- [x] 4.3 full-catalog OpenCode `timeoutMs=3s` + last-good；IPC 层可选 budget  
  - **In:** timeout-fallback spec  
  - **Out:** `OPENCODE_FULL_CATALOG_FETCH_TIMEOUT_MS` + `getOpenCodeSessionList({ timeoutMs })`  
  - **Verify:** openCode unit + 人工 dump opencode ≤3s 量级  
  - **Pri:** P0 · **Dep:** 4.2

- [ ] 4.4 审计 list 主结果 apply：force-enter/stale 后 `setThreads` 必 no-op  
  - **In:** `useThreadActions` generation/isStale  
  - **Out:** 晚到 list 不 thrash  
  - **Verify:** unit  
  - **Pri:** P0 · **Dep:** 4.1  
  - **Status:** 既有 generation/stale 路径沿用；本轮未单开加固，**defer**

## 5. S4 Git / catalog 错峰

- [ ] 5.1 冷启 first-paint 前禁止 `get_git_diffs` 预加载；限制 `get_git_status` 为 first-paint 后有界一次  
  - **Pri:** P1 · **Dep:** 2.2 · **Status:** **defer**（本轮未动 git 调度）

- [ ] 5.2 skills/model/engine-models：冷启错峰 / timeout cooldown
  - **Pri:** P1 · **Dep:** 2.2 · **Status:** **defer**；S7 shared catalog queue 人工验收退化，已回滚，后续必须按各 domain 的真实成本单独取证

## 6. S5 验收与收口

- [x] 6.1 更新/补齐 `useWorkspaceThreadListHydration.test.tsx`、`StartupGateOverlay.test.tsx`、`startupGateReady` / `fullCatalogAutoRetry` / openCode 相关套件  
  - **Verify:** 目标 vitest 绿  
  - **Pri:** P0 · **Dep:** 4.x

- [x] 6.2 人工冷启 dump A/B（双 workspace + OpenCode）  
  - **基线:** elapsed 57.5s · 无 first-paint · gate 假 ready  
  - **收口 dump:** elapsed ~18.4s · `firstPaintPresent: true` · `gateReadyReason: first-paint-complete` · 可交互 ~4.4s  
  - **Pri:** P0 · **Dep:** 6.1

- [x] 6.3 人工回归：侧栏可点、切 workspace 补全、force-enter 可用（用户确认主链）  
  - **Pri:** P0 · **Dep:** 6.2

- [x] 6.4 Overlay 保持 manual-only；诊断列表默认折叠 + 复制按钮进折叠区；文案「展开加载日志」
  - **Pri:** P2 · **Dep:** 6.2

## 7. 文档 / OpenSpec

- [x] 7.1 本 change 回写 tasks 完成态 + design 实测对照（见 `design.md` §Post-implementation）  
  - **Pri:** P1 · **Dep:** 6.2

- [x] 7.2 实现收口 commit；archive 视后续 S4/4.4 完成情况另开或同 change 续做  
  - **Pri:** P1 · **Dep:** 6.1

## 8. S6 2026-08-09 冷启点击复发根治

- [x] 8.1 renderer diagnostics：新增 volatile ring、256 KiB durable byte budget、30s batch persist
  - **Verify:** `rendererDiagnostics.test.ts` 覆盖 volatile export/clear、零写盘、byte budget 与 batch cadence
  - **Pri:** P0 · **Dep:** —

- [x] 8.2 frame-drop circuit breaker：warn memory-only；severe cooldown durable；diagnostics-owned hotspot 不 durable
  - **Verify:** `perfMonitoring.test.ts` 覆盖三条分支
  - **Pri:** P0 · **Dep:** 8.1

- [x] 8.3 Codex local/live first-page 真正 bounded：移除 `usize::MAX`，mtime newest-first，unique-session/file/256 KiB preview work budget，并保持 Desktop/daemon parity
  - **Verify:** Rust unit 覆盖 candidate order、bounded unique scan、preview byte cap、cursor offset + lookahead
  - **Pri:** P0 · **Dep:** —

- [x] 8.4 移除 first-paint 后与 background workspace 的自动 full-catalog；保留显式 Load older / Session Management / force refresh
  - **Verify:** hydration Vitest 断言 first-paint settle 后无 automatic full；显式 force 仍 full
  - **Pri:** P0 · **Dep:** 8.3

- [x] 8.5 运行 targeted Vitest、Rust tests、typecheck/lint、OpenSpec validate、Trellis check 与 cross-layer check
  - **Pri:** P0 · **Dep:** 8.1–8.4
  - **Result:** focused Vitest 71/71；`local_usage::tests` 64/64；Codex scan/preview tests green；typecheck、target ESLint、runtime contracts、Rust lib/bins check、rustfmt、OpenSpec strict validate green。Repo-wide lint/doctor 仍被本次未修改文件的既有 lint/branding debt 阻断。

- [x] 8.6 移除 StartupGate 展开日志对 live trace/notice 的同步 layout / full-window compositing 放大
  - **Verify:** `StartupGateOverlay.test.tsx` 覆盖 summary 1Hz pull、展开 snapshot frozen、收起再展开刷新、copy 读取 latest、不调用 `scrollIntoView()`，且 overlay root 不含 `backdrop-blur`
  - **Pri:** P0 · **Dep:** 8.5
  - **Result:** 删除 auto-scroll / backdrop-filter 后问题仍必现，证明它们只是放大器。最终改为正常 trace 不双写 notice、Overlay 不订阅 event cadence、点击展开冻结 snapshot；gate manual-only 语义不变，最终因果结论以用户冷启验收为准。

## 9. S7 rejected rollback + S8 diagnostic ownership

- [x] 9.1 回滚 S7 延迟链：AppShell defer/release、current workspace refresh hard gate、shared `catalog: 1`、model phase 迁移、native appearance 前移
  - **Verify:** source symbol audit；相关文件恢复既有 phase/ownership，`input-ready` 可继续消费 cached workspace readiness
  - **Pri:** P0 · **Dep:** 8.6
  - **Result:** 移除把安全点击窗口从约 2s 延长到约 3s 的 barrier；不以重新排队替代 source-work 治理。

- [x] 9.2 保留独立低风险收益：settings/workspaces StrictMode in-flight dedupe、CSS-only identity uiScale、default Dock icon skip、stale model owner 精确取消
  - **Verify:** focused hook/unit；model workspace switch/unmount 不占住旧 resource slot
  - **Pri:** P0 · **Dep:** 9.1

- [x] 9.3 收敛 startup diagnostic ownership：正常 task/success command/milestone 不再双写 notice；summary 1Hz pull；展开 click-frozen；copy on demand
  - **Verify:** notice dock + StartupGate focused unit 覆盖 normal chatter zero mirror、异常保留、snapshot frozen/reopen/latest copy
  - **Pri:** P0 · **Dep:** 9.1

- [x] 9.4 运行 focused Vitest、target ESLint、typecheck、runtime contracts、OpenSpec strict validate 与 Trellis check
  - **Pri:** P0 · **Dep:** 9.2–9.3
  - **Constraint:** 不跑 full test suite；不拉起 App；Rust S6 代码本轮未改，不重复跑全量 Rust checks
  - **Result:** focused Vitest 138/138；target ESLint、TypeScript typecheck、runtime contracts、OpenSpec strict validate、Trellis guideline review 全部通过。

- [x] 9.5 人工冷启后 1s 内点击「展开加载日志」与其他可见按钮，确认 renderer 不再冻结
  - **Pri:** P0 · **Dep:** 9.4
  - **Result:** 用户本机冷启复测确认问题未再出现；保留 frozen snapshot / copy dump 作为后续复发证据。

- [x] 9.6 StartupGate 保持 manual-only；milestone、summary refresh 与 legacy 20s ceiling 均不得自动关闭 loading，仅用户点击 force-enter 可关闭
  - **Verify:** gate test 推进超过 legacy 20s ceiling 后 Overlay 仍存在；手动点击仍 cancel stale + close
  - **Pri:** P0 · **Dep:** 9.3
