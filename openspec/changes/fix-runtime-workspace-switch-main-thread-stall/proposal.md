# Proposal: fix-runtime-workspace-switch-main-thread-stall

> OpenSpec change id: `fix-runtime-workspace-switch-main-thread-stall`  
> Evidence anchor: 2026-08-08 现场 — 跨项目 shared 会话切换 / 解锁卡住会话时 UI 假死 5–10s、CPU 满、风扇狂转；鼠标约 5s 起完全点不动  
> 关联：`optimize-cold-start-hydration-orchestration`、`docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md` §6 缺口 #2/#5、本地 orchestrator orphan research

---

## Why

冷启门控与 first-paint 编排已止血「启动窗误点假死」，但**运行时**仍存在同族问题：

1. 工作区 A → B 切换时 `cancelWorkspaceTasks` 使用 **soft-ignore**：槽位立刻释放，**旧 `listThreadsForWorkspace` body 继续跑**。
2. `listThreadsForWorkspace` 前半段（titles / shared / codex 分页 / 多引擎 catalog 启动）**缺少 isStale 早退**，取消后仍会再开 IPC、做合并、甚至 fire-and-forget gemini/kimi/grok 刷新。
3. 跨项目点开 Shared 会话时，list 孤儿扫 + shared history hydrate + AppShell 根渲叠加 → 主线程连续长任务 5–10s，体感「整窗卡死」。

本地研究已证：狂切 workspace 时 `bodyStarted = [ws-1, ws-2, ws-3]` 且 cancelled body 仍 `finish`（`isStale=true`）。现有单测只断言「状态不写 stale setThreads / 槽位释放」，**不断言「停后续重活」**。

**本 change 目标：** 把 soft-ignore 从「只挡 setState」升级为 **协作式早退：取消后不再启动后续 IPC / 合并 / 后台引擎刷新**；运行时切换与冷启共用同一套 isStale 契约。

---

## 目标与边界

### 目标

1. **cancel / isStale 后 list 路径协作式早退**：不再启动 titles 之后的后续阶段、分页下一页、multi-engine fan-out、gemini/kimi/grok 后台 merge。
2. **迟到 apply 仍禁止**：保留并强化 `isLatestThreadListRequest`（含 isStale）在 setThreads / 后台 refresh 的检查。
3. **运行时切 workspace 与冷启共用契约**：不新增全屏遮罩；靠停重活降低 CPU 峰值。
4. **可验证**：单测证明 cancel/stale 后关键 IPC mock 调用次数不增长；orchestrator 叠跑研究结论落到产品回归。

### 边界（本 change 内）

- Frontend：`useThreadActions.listThreadsForWorkspace` 协作式 isStale 检查点；必要时 hydration/orchestrator 注释与测试对齐。
- Spec：新增 `runtime-workspace-switch-hydration` capability delta（或扩展 client-startup-orchestration 运行时条款）。
- 验收：focused vitest + 人工跨项目 shared 切换手测（不 commit，先验证）。

### 非目标

- **不**做 AppShell 层 4 根渲单价大手术。
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
| D | 现有 timeout / last-good / first-paint 冷启测试不回归 | focused suite 绿 |
| E | 人工：项目1 shared → 项目2 shared 切换，UI 不应整窗卡死 5–10s（明显改善） | 用户手测 |

---

## Implementation status

| 阶段 | 状态 | 说明 |
|------|------|------|
| Proposal / design / tasks / spec | ✅ | 本目录 |
| list early-stale 早退 | ✅ | `abandonIfStale` + multi-engine 延后启动 + gemini/kimi/grok 认 isStale |
| 回归测试 | ✅ | `stale-list-abandon` 3/3；hydration/orchestrator 绿 |
| 验证 | ✅ focused | **不 commit**；交用户手测跨项目 shared |
| 人工验收 | 待用户 | 项目1 shared → 项目2 shared；解锁卡住会话 |

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| 过早 return 导致侧栏残留 loading | finally 仍按 ownsRequest 清 loading（既有逻辑） |
| isStale 与 requestSeq 竞态 | isLatest = seq 匹配 **且** !isStale（既有） |
| 取消瞬间 in-flight 单次 IPC 仍跑完 | 接受；目标是停 **后续** 阶段 |

回滚：还原 list 路径 isStale 检查点即可。
