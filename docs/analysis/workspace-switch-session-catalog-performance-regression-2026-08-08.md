---
type: analysis
status: active
---

# 工作区项目切换卡死：Session Catalog 性能回归分析与修复指南

> 结论日期：2026-08-08
> 影响版本：现象从 v0.7.16 明显出现；v0.8.x 仍可复现
> Active change：[`fix-runtime-workspace-switch-main-thread-stall`](../../openspec/changes/fix-runtime-workspace-switch-main-thread-stall/)
> Evidence boundary：commit、代码链路与本机 corpus 计数已核对；用户最终手测仍待完成

## 一、结论先行

项目切换卡死不是单个 commit 造成，而是三类改动叠加后，把一条既有的错误热路径放大：

1. AppShell 每次切换 `activeWorkspaceId`，仅为取得 owner workspace ids，就调用 `get_workspace_session_projection_summary`。
2. backend summary 不是 topology query，而是以 `SESSION_CATALOG_MAX_LIMIT=9999` 顺序扫描 Codex、Claude、Gemini、Kimi、Grok、OpenCode、Shared，再计算 counts。
3. v0.7.16 的 Claude scanner v5 正确地废弃旧 attribution cache；首次访问需要重建。原本不应出现在 navigation 热路径的 exhaustive summary，因此变成大面积 cache rebuild 触发器。
4. 同版本 Shared fresh hide-set 修复增加最多三次 Shared metadata scan；v0.8.0 hydration race 修复又让 first-paint/full-catalog 稳定执行。两者是放大器，不是 v0.7.16 首发主因。

2026-08-08 首轮修复 `823d6d4f06` 只让 stale `listThreadsForWorkspace` 停止后续 fan-out。用户按原路径复测没有最终改善，证明 orphan list 是次要压力，独立的 projection summary 才是主要遗漏。

本轮修复不回退 correctness：保留 Claude scanner v5、Shared fresh hide-set、hydration race fix；只把 AppShell 所需 topology 改为本地纯推导，使项目切换不再启动 exhaustive projection。

## 二、三个 commit：谁提交、解决什么、带来什么

| Commit | 作者 / 进入版本 | 原始目标 | 新增成本或风险 | 因果判断 |
|---|---|---|---|---|
| `b5eec23c4` | `zhukunpenglinyutong`；PR #1013 merge `5b6d3abde`；首个 tag v0.7.16 | 修复 empty/new workspace 因 CJK encoded project-dir collision 泄漏 foreign Claude sessions；OpenCode 用 JSON `directory` 做 workspace 过滤 | Claude scanner `4 -> 5` 使 v4 source-fact cache 按 namespace 在首次访问时 stale/rebuild；exhaustive summary 会把本应渐进发生的 rebuild 一次放大。OpenCode 每次 catalog 仍需等待既有外部 CLI | **触发条件 / 主放大器，高置信** |
| `e0f8c0aa7` | `chenxiangning`；PR #1003 merge `63448c2cb`；首个 tag v0.7.16 | 修复 Gemini/Grok/Kimi async refresh 复用 stale Shared hide set，导致 Shared-owned native row 回流 Sidebar | 三个 async refresh 各自 fresh `listSharedSessions`，一次 full refresh 最多增加三次 Shared 目录与 metadata JSON 扫描 | **I/O 放大器，中置信；不是数秒主因** |
| `9e3c1bdd8` | `zhukunpenglinyutong`；PR #1023 merge `2753c737b`；首个 tag v0.8.0，**不属于 v0.7.16** | 修复 `activeWorkspaceId` 先于 `workspacesById` 到达时 hydration 永久跳过；把 first-paint 默认窗口缩到约 5 条 | 正确性恢复后，原来被 race 偶发跳过的 hydration 稳定执行；若下游仍有重扫描，性能问题更稳定暴露。缩小返回页不等于所有 scanner 都不枚举候选 | **v0.8.x 稳定复现放大器；不能解释 v0.7.16 起点** |

### 对早先表述的三处校正

- “旧 cache 全部失效”应精确为：scanner v4 cache 对 v5 scanner 均视为 stale，但按 attribution namespace 与实际访问候选渐进重建；不是升级瞬间主动删除所有文件。
- `b5eec23c4` 没有首次引入 OpenCode 外部进程。`opencode session list` 已存在；该 commit 增加 `--format json` 与 `directory` 过滤。真正的问题是 catalog 调用会继续启动该既有 CLI。
- `9e3c1bdd8` 不在 v0.7.16，而在 v0.8.0。它修的是 correctness race，不应为了“少执行”而回退。

## 三、实际调用链

```text
用户点击 workspace B
  activeWorkspaceId: A -> B
  useAppShellSearchRadarSection
    useWorkspaceSessionProjectionSummary({ status: "active" })
      get_workspace_session_projection_summary
        build_catalog_scan_mode(limit = 9999)
        build_workspace_scope_catalog_data
          for selected main + direct worktrees
            Codex summary scan
            Claude source-fact scan/cache hit|stale|rebuild
            Gemini scan
            Kimi scan
            Grok scan
            OpenCode `session list --format json`
            Shared metadata scan
        count/filter/folder aggregation
      frontend 只读取 summary.ownerWorkspaceIds
```

关键设计错误：调用方只要 topology，callee 却构造完整 session universe。该请求不属于 `listThreadsForWorkspace` generation，所以 `cancelWorkspaceTasks`、`isStale`、first-paint limit 都无法约束它。

### 为什么会表现为“整个客户端卡死”

- Claude/Codex/Grok 历史枚举、JSONL source-fact 解析与 cache 写入争用 CPU / disk。
- OpenCode 外部 CLI 与 catalog scanner 同时运行，继续增加进程与 I/O 压力。
- native 任务完成后，Sidebar thread merge 与 AppShell render 仍可能形成 100–350ms 级历史长任务；多段压力连续出现时，鼠标输入无法及时得到 frame。
- 因此现象是 native resource saturation 与 frontend render cost 叠加，不应只用 React `startTransition` 或 loading overlay 解释。

## 四、本机 corpus evidence

以下是 2026-08-08 的单机快照，只用于解释量级，不作为跨设备固定值：

| 来源 | 文件 / 大小快照 |
|---|---:|
| Workspace registry | 8 workspaces；当时无 parent-linked worktree |
| Claude JSONL | 368 files；约 50.7 MiB |
| Codex JSONL | 182 files；约 222.6 MiB |
| Grok `chat_history.jsonl` | 113 files；约 165.1 MiB |
| Claude source-fact cache | 14,067 files；约 55 MiB |
| Cache scanner versions | v2=7,337；v5=3,306；v4=1,721；v3=1,430；v1=273 |
| v5 namespace | 16 namespaces；单个高位 namespace 约 369 files |

16 个 v5 namespace 与 8 workspaces × 两类 attribution mode 相符，说明 cache 不是单一全局副本；这是基于数量的推断，不是 schema contract。它同时解释了为什么“每个项目首次切换”会再次出现明显成本。

## 五、两轮修复与证伪

### 5.1 首轮：stale list cooperative abandon

`823d6d4f06` 增加 `abandonIfStale`，在 titles、Shared、Codex paging、multi-engine fan-out 与 async refresh 边界停止旧 workspace 请求。该修复有效解决：

- 取消后继续启动新 IPC；
- stale request 迟到覆盖 `setThreads`；
- 连续切换产生多条 orphan fan-out。

但用户现场复测无最终改善。原因：projection summary 是另一条 hook/IPC 链，不读取 list generation，也不经过这些 checkpoint。

### 5.2 本轮：navigation topology local derivation

实现改为：

```text
no active workspace      -> []
registry temporarily absent -> [activeWorkspaceId]
active worktree          -> [activeWorkspaceId]
active main              -> [active main, ...direct parentId children(path/name/id sorted)]
```

这与 Rust `catalog_workspace_scope` 的 topology 一致。它只决定哪些 owner 的已加载 thread rows参与 Sidebar/Recent/Radar 聚合，不替代 catalog session membership。

结果：

- workspace switch render 不再调用 projection summary；
- Claude v5 cache rebuild 不再被 navigation 的 `limit=9999` 强制触发；
- Settings/Session Management 仍可显式查询 totals/folder counts/source statuses；
- hydration race fix 与 bounded first-paint 保留。

同轮还移除了 `useWorkspaceThreadListHydration` 的 unsafe `return` from `finally`。原写法在 force-enter / cooldown 阻止 idle follow-up 时可能吞掉 list failure；现在以正向 guard 决定是否 schedule，并用 rejection regression 锁定错误传播。

## 六、后续性能治理顺序

### P0 — 已实施：从 navigation 删除 exhaustive query

验收必须同时看行为与调用次数：

- AppShell switch path 对 `getWorkspaceSessionProjectionSummary` 调用次数为 0；
- main/direct-worktree 与 worktree-only topology 回归通过；
- 用户连续切换项目不再出现 5–10s 整窗不可点。

### P1 — 继续测量：让“bounded page”约束真实扫描成本

`list_workspace_sessions(limit=5)` 当前向多数 engine 传 `scan_mode.limit()=6`，已比 summary 的 9999 小；仍需用 `sourceStatuses.scannedCandidates/cache` 验证每个 source 的真实枚举、parse、cache rebuild 数，而不能只看 response `data.length`。

建议后续 metric：

- `workspace_switch.next_paint_ms`
- `session_catalog.command_ms{surface,engine,workspace}`
- `session_catalog.scanned_candidates{engine}`
- `session_catalog.cache_hits|misses|stale|rebuilds{engine,scanner_version}`
- `opencode_session_list.spawn_count{workspace,request_generation}`
- frontend Long Task count / max duration during switch + 10s

建议验收目标（尚未形成 current baseline）：warm switch P95 next paint <100ms；workspace switch 后 10s 内不出现 >1s Long Task；同一 generation 不重复启动等价 OpenCode list。

### P1 — 去重 OpenCode catalog/native 双调用

full-catalog 当前可能同时从 project catalog 与 frontend native bridge 启动 OpenCode session list。不能直接删除其中一条：现有 timeout/last-good compatibility contract 需要先统一 membership 与 fallback。推荐优先在 canonical owner 增加 request-generation single-flight，或让 catalog response 成为 authoritative source 后再条件 fallback；禁止用长 TTL 隐藏新建 session。

### P2 — Shared fresh hide-set 使用 revision/snapshot

`e0f8c0aa7` 的 fresh scan 保证 binding materialize 后不会泄漏 native row，不能简单复用 list 开头的 stale snapshot。理想方案是 backend 返回 Shared binding revision，三个 async engine refresh 读取同一“扫描完成后”的 revisioned snapshot；在没有 revision contract 前，不用盲目 TTL cache 换性能。

### P2 — Projection summary 自身改为增量/显式 surface

Settings 仍使用 exhaustive counts。长期应采用 metadata index、per-source incremental counts 或显式 refresh；不要让 summary API 再被 root/AppShell hook 隐式消费。若改 counts semantics，必须先走新的 OpenSpec change。

## 七、通用工程法则

1. **Topology 与 inventory 分离。** Workspace owner graph 是 O(workspaces)；session inventory 是 O(history corpus)。不能用后者回答前者。
2. **Correctness 修复不能依赖 race 跳过。** hydration 之前“偶尔没执行”不是性能能力；修复 race 后应约束真实工作量。
3. **Page size 必须约束 source work，不只约束 response。** `slice(0, 5)` 不能证明只读了 5 个候选。
4. **Cache schema bump 必须审计所有触发 surface。** invalidation 合理，但 navigation、polling、background prewarm 不得同时成为 rebuild owner。
5. **取消语义覆盖 fan-out，也要覆盖独立 query。** generation guard 只保护加入同一 generation 的工作；平行 hook 需要单独清点。
6. **人工未改善即证伪主假设。** 保留有效止损，但必须重开 root-cause tree，不能把 correctness green 当性能闭环。

## 八、关联文档与事实源

- Active behavior change：[`openspec/changes/fix-runtime-workspace-switch-main-thread-stall/`](../../openspec/changes/fix-runtime-workspace-switch-main-thread-stall/)
- Catalog behavior contract：[`openspec/specs/workspace-session-catalog-projection/spec.md`](../../openspec/specs/workspace-session-catalog-projection/spec.md)
- Code-level catalog guide：[`.trellis/spec/guides/workspace-session-catalog-contract.md`](../../.trellis/spec/guides/workspace-session-catalog-contract.md)
- 冷启动同族问题：[`windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md`](./windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md)
- Root render 历史 baseline：[`render-jank-knife-experiments-2026-07-08.md`](../perf/render-jank-knife-experiments-2026-07-08.md)
- React update-loop 排查：[`react-185-maximum-update-depth-playbook.md`](./react-185-maximum-update-depth-playbook.md)
- Cold-start orchestration change：[`optimize-cold-start-hydration-orchestration`](../../openspec/changes/optimize-cold-start-hydration-orchestration/)

## Audit Trail

**Refers to:**

- `src/app-shell-parts/useAppShellSearchRadarSection.ts`
- `src/app-shell-parts/workspaceThreadListLoadGuard.ts`
- `src/app-shell-parts/useWorkspaceThreadListHydration.ts`
- `src/features/threads/hooks/useThreadActions.ts`
- `src/features/threads/hooks/useThreadActionsSessionCatalog.ts`
- `src-tauri/src/session_management.rs`
- `src-tauri/src/session_management_catalog_projection.rs`
- `src-tauri/src/engine/claude_history.rs`
- `src-tauri/src/engine/commands_opencode.rs`

**Impact:** Workspace navigation、Sidebar/Recent/Radar owner aggregation、session catalog/cache rebuild trigger、multi-engine background hydration。Settings Session Management projection semantics 未改。
