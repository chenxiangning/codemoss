# Proposal: fix-runtime-workspace-switch-main-thread-stall

> OpenSpec change id: `fix-runtime-workspace-switch-main-thread-stall`  
> Evidence anchor: 2026-08-08 现场 — 跨项目 shared 会话切换 / 解锁卡住会话时 UI 假死 5–10s、CPU 满、风扇狂转；鼠标约 5s 起完全点不动  
> 关联：`optimize-cold-start-hydration-orchestration`、`docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md` §6 缺口 #2/#5、本地 orchestrator orphan research

---

## Why

冷启门控与 first-paint 编排已止血「启动窗误点假死」，但**运行时**仍存在两条叠加链路：

1. **次要放大器（已修）**：工作区 A → B 切换时 `cancelWorkspaceTasks` 使用 soft-ignore，旧 `listThreadsForWorkspace` body 在取消后仍会继续 fan-out。
2. **主要根因（本轮补齐）**：`useAppShellSearchRadarSection` 仅为取得 main/worktree owner ids，在每次 `activeWorkspaceId` 变化时调用 `get_workspace_session_projection_summary`。该 command 以 `SESSION_CATALOG_MAX_LIMIT=9999` 扫描整个 workspace scope 的 Codex / Claude / Gemini / Kimi / Grok / OpenCode / Shared，再返回计数与 owner ids。
3. v0.7.16 的 Claude scanner v5 cache invalidation 使这条 exhaustive projection 首次命中时重建大量 source-fact cache；OpenCode catalog 同时启动外部 CLI。因请求与 `listThreadsForWorkspace` generation 无关，stale guard 无法取消它。

本地研究已证：狂切 workspace 时 cancelled list body 会继续完成；同时 source-fact cache 存在 14,067 个文件、55 MiB，Claude/Codex/Grok history 分别约 50.7/222.6/165.1 MiB。2026-08-08 的 early-stale 修复完成后，用户按原路径复测**未得到最终改善**，因此「孤儿 list body 是主因」被现场证据否定；它仍是有效的次要止损，但不能作为闭环结论。

**本 change 目标：** 保留协作式早退，同时把 AppShell navigation 所需的 owner topology 改为 `workspaces` 本地纯推导，彻底移除项目切换瞬间的 exhaustive projection IPC；Settings/Session Management 的显式统计查询保持不变。

---

## 目标与边界

### 目标

1. **cancel / isStale 后 list 路径协作式早退**：不再启动 titles 之后的后续阶段、分页下一页、multi-engine fan-out、gemini/kimi/grok 后台 merge。
2. **迟到 apply 仍禁止**：保留并强化 `isLatestThreadListRequest`（含 isStale）在 setThreads / 后台 refresh 的检查。
3. **导航 topology 本地化**：main workspace 投影自身 + direct worktrees；worktree 只投影自身；workspace registry 尚未到达时保留 active id fallback。
4. **运行时切 workspace 与冷启共用契约**：不新增全屏遮罩；靠移除同步热路径重扫与停掉 stale fan-out 降低 CPU 峰值。
5. **可验证**：单测证明 AppShell navigation 不调用 projection summary，并证明 topology 与 backend `catalog_workspace_scope` 一致。

### 边界（本 change 内）

- Frontend：`useThreadActions.listThreadsForWorkspace` 协作式 isStale 检查点；AppShell owner topology 本地 resolver；hydration/orchestrator 测试对齐。
- Spec：新增 `runtime-workspace-switch-hydration` capability delta（或扩展 client-startup-orchestration 运行时条款）。
- 验收：focused vitest + 人工跨项目 shared 切换手测（不 commit，先验证）。

### 非目标

- **不**做 AppShell 层 4 根渲单价大手术。
- **不**删除 projection summary API；Settings/Session Management 仍需 counts/folder counts/source status。
- **不**硬杀 native IPC（Tauri invoke 无统一 Abort）；仅停 **后续** JS 阶段与后续 invoke。
- **不**重写 Shared recovery UX / history loader 全量分片（可 follow-up）。
- **不**改冷启 gate / uiScale 策略。
- **不**默认改 soft-ignore 为 hard-abort（避免未检查 signal 的路径误伤）。

---

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| A | stale/cancel 后 list 不再调用后续 IPC（titles 之后的 list/shared/catalog/gemini 等，视注入时机） | vitest mock call counts |
| B | stale list 不 dispatch `setThreads` | vitest dispatch |
| C | 切 workspace 仍 cancel 旧 task 并启动新 first-paint | 既有 hydration 测试 + 回归 |
| D | AppShell 切换 workspace 不调用 `get_workspace_session_projection_summary` | hook regression + source grep |
| E | main/worktree owner ids 与 backend scope topology 一致 | pure resolver tests |
| F | 现有 timeout / last-good / first-paint 冷启测试不回归 | focused suite 绿 |
| G | 人工：项目1 shared → 项目2 shared 切换，UI 不应整窗卡死 5–10s（明显改善） | 用户手测 |

---

## Implementation status

| 阶段 | 状态 | 说明 |
|------|------|------|
| Proposal / design / tasks / spec | ✅ | 本目录 |
| list early-stale 早退 | ✅ | `abandonIfStale` + multi-engine 延后启动 + gemini/kimi/grok 认 isStale |
| 2026-08-08 首轮人工验收 | ❌ 未改善 | 证明 stale orphan 不是主要根因 |
| navigation exhaustive projection 移除 | ✅ | owner topology 从 `workspaces` 本地推导；Settings 查询不变 |
| 回归测试 | ✅ focused | topology 4 cases；AppShell no-projection；hydration failure propagation；stale/shared/orchestrator suites |
| 自动验证 | ✅ scoped | focused Vitest、target ESLint、typecheck、runtime contracts、large-file、OpenSpec strict 均通过 |
| 仓库全量 baseline | ⚠ 既有阻断 | full test / full lint / docs / doctor 分别被未改文件中的既有问题阻断；本次 scoped gates 通过 |
| 人工验收 | 待用户 | 项目1 shared → 项目2 shared；解锁卡住会话 |

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| 过早 return 导致侧栏残留 loading | finally 仍按 ownsRequest 清 loading（既有逻辑） |
| isStale 与 requestSeq 竞态 | isLatest = seq 匹配 **且** !isStale（既有） |
| 取消瞬间 in-flight 单次 IPC 仍跑完 | 接受；目标是停 **后续** 阶段 |
| frontend 与 backend scope topology 漂移 | pure resolver 覆盖 main/direct-worktree/worktree/missing-registry；OpenSpec 固化同一 contract |
| Settings 统计仍是 exhaustive | 只在显式 Session Management surface 运行，不进入 workspace navigation 热路径 |

回滚：恢复 AppShell projection hook 与原 owner fallback；无需数据迁移。early-stale 修复可独立保留。
