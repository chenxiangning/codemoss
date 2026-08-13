# Proposal: optimize-cold-start-hydration-orchestration

> OpenSpec change id: `optimize-cold-start-hydration-orchestration`  
> Evidence anchor: 2026-08-08 cold-start diagnostic dump（elapsed 57.5s；`opencode_session_list` 6–13s×N；`list_threads` 多轮；full-catalog timeout 后重扫；**无 first-paint 任务**）  
> Recurrence anchor: 2026-08-09 macOS 0.8.5（冷启立刻点击必卡、等待后恢复；renderer diagnostics 约 1.5 MiB 且约每 2s 全量重写；Codex `limit=5` 仍扫描约 235 MiB JSONL）
> 关联历史：`docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md`、`client-startup-orchestration`、`sidebar-list-timeout-fallback`

---

## Why

冷启假死与 50s+ 等待的根因已有现场 dump 定案：不是对话业务逻辑坏了，而是 **full-catalog 多引擎会话枚举过重 + 双 workspace 同时扫 + 超时后重扫/僵尸 IPC + first-paint 轻路径未走 + git/model/skills 同窗抢占**。  
前两天的门控 / 分阶段 / uiScale 延后是止血；本变更要 **把已有 `client-startup-orchestration` 契约落到可执行、可取消、可验收的冷启 hydration 编排**，从「挡点击」升级为「冷启默认可交互、后台一致性可残缺」。

**为什么现在做整体提案：** P0–P2 同一条因果链（谁在冷启窗做重活、超时语义、非 active 策略、git 风暴），拆成多个小 PR 容易再次分叉回归；一份大提案统一边界、验收与回滚。

---

## 目标与边界

### 目标

1. **冷启产品完成态 = first-paint 可交互**（shell + active workspace 有界列表 + 输入区），不再等于 full-catalog 扫完。  
2. **full-catalog 变为可失败、可取消、默认可残缺的后台一致性任务**；超时不得冒充 `startup-gate-ready`，不得自动无限重扫。  
3. **OpenCode / 多引擎 session 枚举** 在冷启路径限流、懒加载或硬取消，消灭 10s 级 IPC 占窗。  
4. **非 active workspace** 冷启不跑 full-catalog；进入 workspace 再扫。  
5. **git / skills / model** 冷启同窗降噪：缓存、延后 idle、与 list 错峰。  
6. **可观测性**：startupTrace 必须能证明 first-paint 存在、command cost rank、timeout/cancel 是否停止后续 ensure。  
7. **不破坏** 会话创建/发送/恢复、侧栏 last-good、多引擎合并语义的正确性（见非目标与业务影响）。

### 边界（本 change 内）

- Frontend：`startupOrchestrator`、`useWorkspaceThreadListHydration`、`listThreadsForWorkspace` / full-catalog 子源、gate 语义、冷启 git/skills/model 调度。  
- 必要时轻量 Rust/IPC：超时取消、list 分页上限（仅冷启/full-catalog 路径）。  
- Spec：强化 `client-startup-orchestration` + `sidebar-list-timeout-fallback`，必要时新增 cold-start hydration 专用 capability。  
- 验收：以 diagnostic dump + 门控/首屏可点时间 + 回归单测为主；release-grade 指标可对齐 `runtime-performance-evidence-gates` 但不重做整套 perf 体系。

### 非目标

- **不**重写对话消息流、threads reducer 业务语义、多 Agent collab 协议。  
- **不**改用户会话数据模型 / shared session 绑定规则（除冷启「何时枚举」时机）。  
- **不**解决 WKWebView/WebView2 内核级 bug；uiScale 线以既有 gate/defer 为前置，本提案不重做缩放实现。  
- **不**追求侧栏冷启瞬间 100% 多引擎历史完整（明确允许 first-paint 残缺，full 补全）。  
- **不**在本 change 做对话中流式 jank 的 AppShell 层 4 大手术（另案）。  
- **不**默认关闭 StartupGateOverlay 调试清单 / 一键复制（可另 chore 收口）。

---

## Implementation status（2026-08-09）

| 阶段 | 状态 | 说明 |
|------|------|------|
| S0 观测 | ✅ | dump 含 firstPaintPresent / gateReadyReason / fullCatalogAutoRetryBlocked |
| S1 路径纠偏 | ✅ | 冷启默认 first-paint；非 active 不 full |
| S2 Gate 诚实 | ✅ | 仅 first-paint-complete / home input / force-enter |
| S3 禁重扫 + OpenCode 预算 | ✅ | 60s cooldown；OpenCode full 3s + last-good |
| S4 git/catalog 错峰 | ⏸ defer | 不再由全局 barrier / shared catalog queue 实现；保留既有 domain phase/cap |
| S5 Overlay 产品化 | ✅ | 保持 manual-only；加载日志默认折叠；复制进折叠区 |
| 实测 | ✅ | 可交互 ~4.4s；firstPaintPresent=true；gate=first-paint-complete |
| S6 复发根治 | ✅ | 诊断 memory-first/circuit breaker、Codex 真 bounded preview、移除 automatic full-catalog；见 tasks §8 |
| S7 resource barrier | ❌ 已回滚 | 人工验收使安全点击窗口由约 2s 退化到约 3s；未减少 source work |
| S8 diagnostic ownership | ✅ 人工验收通过 | normal trace 不再双写 notice；summary 1Hz pull；展开 click-frozen；copy on demand；冷启后立即点击未再冻结 |

事实源见 `design.md` §Post-implementation 与 `tasks.md` 勾选。

---

## What Changes

### 2026-08-09 复发根治（P0）

- `perf.frame-drop` 等高频采样默认只保留在 session memory；只有非诊断自触发的 severe sample 才允许低频 durable sampling。renderer diagnostics 持久化增加 byte budget，并把周期写频率从秒级降到低频批量，防止「掉帧 → 写诊断 → 再掉帧」正反馈。
- Codex first-page 的 `limit/cursor` 必须约束 **真实文件候选与 live page 扫描量**，禁止再用 `usize::MAX` 扫完整个 `sessions/**` 后才 `.take(limit)`。候选按 filesystem mtime 新到旧处理，达到 `offset + limit + lookahead` 的 unique session budget 后停止。
- first-paint settle 后不再自动 enqueue exhaustive/full-catalog。完整历史继续由 Sidebar `Load older`、Session Management 或用户显式 refresh 获取；冷启和普通按钮点击不得与隐式全量目录扫描竞争主线程/IPC。
- StartupGate 的 `startupTrace` 作为 canonical lifecycle channel；正常 task/success command/milestone 不再镜像到 runtime notice。折叠 summary 最多 1Hz pull，展开时冻结点击瞬间 snapshot，复制按钮按需读取 latest diagnostic stores。
- S7 `input-ready` 全局 resource barrier 已回滚：cached workspace 不再等待 current refresh；catalog 不再共用全局串行 cap。loading 仍只允许用户按钮关闭，不因 milestone/timeout 自动隐藏。

### 编排契约（P0）

- **强制冷启路径**：active workspace 必须先执行有界 `thread/list first-paint hydration`；不得仅因 first-paint settle 自动 enqueue `full-catalog`，dump 中「无 first-paint」视为 **回归失败**。
- **`startup-gate-ready` 语义收紧**：仅允许 first-paint 成功 / home 仅 input-ready / 用户 force-enter；**禁止** full-catalog timeout/degraded 冒充 ready。  
- **timeout 后禁止同 dedupeKey 自动重扫**；force-enter / stale cancel 必须阻止任何既有 startup-owned full-catalog 再 schedule。
- **soft-ignore 与 IPC 取消对齐**：task degraded 后尽量不再继续 apply setThreads；OpenCode/list 路径具备硬超时或可丢弃结果。

### 重活限流（P0）

- full-catalog 内 **OpenCode session list** 冷启：懒加载 / 限页 / 更短 timeout / 失败用 last-good，不得默认 10s+ 阻塞。  
- full-catalog **引擎子源串行或严格 cap**（延续 `thread-session-scan` 并发 1），避免 list_threads 与 opencode 无界叠加体感。  
- **同 workspace `list_threads` in-flight 合并**，消除 dump 中 5 次同 ws 重复。

### 范围收缩（P1）

- **非 active workspace**：冷启只允许极轻 prewarm 或完全不扫；禁止与 active 同启 full-catalog。  
- **git_status / git_diffs**：冷启前 N 秒禁止风暴；对齐「回合结束再拉」红线，最多一次有界 snapshot。  
- **skills / model_list / get_engine_models**：冷启用缓存优先、idle-prewarm、timeout 后不重入抢槽。

### 观测与验收（P1/P2）

- diagnostic dump 固定字段：first-paint 是否存在、gate-ready 原因、command cost rank、timeout 后是否再 enqueue。  
- 单测 + 可选 dump 夹具回归「双 workspace 不双 full」「timeout 不重扫」「gate 不由 timeout stamp」。

**BREAKING（产品语义，非 API 破坏）：**

- 冷启后极短时间内侧栏可能 **先少后全**（first-paint → full）；多引擎历史可能短暂不完整。  
- 这是 **有意契约**，不是功能丢失；需在 UI 上可接受（缓存/last-good 已有则先显示）。

---

## 技术方案对比与取舍

| 方案 | 做法 | 优点 | 缺点 | 取舍 |
|------|------|------|------|------|
| **A. 仅门控加长** | 遮罩挡到 full 真完 | 实现少 | 57s 用户干等；不减 IPC | **否** |
| **B. 砍功能** | 冷启永不扫 OpenCode/多引擎 | 最快 | 侧栏长期缺会话；业务回归大 | **否** |
| **C. 契约重申 + 执行闭环（推荐）** | 坚持 first-paint 完成态；full 后台可残缺；超时真停；非 active 不扫；重 IPC 限流 | 与既有 spec 一致；业务语义保留最终一致性；可分阶段落地 | 需改 hydrate 调度与子源策略；要补测 | **采用** |
| **D. 重写 orchestrator** | 新状态机替换 StartupOrchestrator |  theoretically 干净 | 触面过大、风险高、与现有 phase 体系重复 | **否**（本 change 在现有 orchestrator 上收紧） |

**结论：** 不是「重新做一套编排框架」，是 **在现有 phase 编排上做执行闭环与重活限流**（方案 C）。

---

## 会不会影响正常业务？

### 不会动的（业务主路径）

| 域 | 说明 |
|----|------|
| 发消息 / 流式 / 工具调用 | 不改事件协议与 reducer 语义 |
| 会话创建、恢复、fork | 不改；仅可能延后「侧栏是否立刻列出全部历史引擎会话」 |
| Shared / multi-agent 协作 | 不改 collab 协议；冷启不强制预热全部 collab 目录以外的会话枚举 |
| 用户主动「加载更多 / 刷新侧栏」 | 仍可 on-demand full-catalog（force） |
| last-good / timeout 保种 | 继续遵循 `sidebar-list-timeout-fallback`，失败不抹已有列表 |

### 会变的（有意、可验收）

| 变化 | 用户感知 | 风险控制 |
|------|----------|----------|
| 冷启侧栏先短后全 | 先看到缓存/first-paint 页，数秒后补全 | 已有缓存优先显示；禁止空列表闪烁 |
| 非当前 workspace 历史晚出现 | 切过去才完整扫 | 切换时 on-demand ensure |
| OpenCode 会话冷启可能稍晚出现 | 进 OpenCode 或 idle 后出现 | last-good 保种；失败可诊断 |
| gate 更「诚实」 | 可能更早可点或 force-enter 后后台静音 | 超时不再假 ready |

### 风险与回滚

- 功能 flag 或分 PR 可回退：恢复 full-catalog 默认全量（接受再次变慢）。  
- soft-ignore 与 cancel 改动必须双路径测：timeout / force-enter / 切 workspace。  
- 回归清单：双 workspace 冷启、仅 Codex、OpenCode 重仓、断网、empty workspace。

---

## Capabilities

### New Capabilities

- `cold-start-thread-hydration-contract`：冷启线程列表 **first-paint / full-catalog** 完成态、gate-ready 归因、非 active 策略、超时禁止重扫、OpenCode/多引擎子源冷启预算的专用行为契约（从执行层抽清，避免只写在 design）。

### Modified Capabilities

- `client-startup-orchestration`：强化 first-paint 有界 hydrate、完整历史显式加载、timeout/fallback 不得 stamp 交互完成态、heavy command 与 git 冷启预算、trace 必须暴露 first-paint 与 gate 原因。
- `sidebar-list-timeout-fallback`：与 full-catalog 子源 timeout / last-good 对齐；明确 degraded 后不得污染 Codex 合并；冷启 OpenCode 失败保种。  
- `conversation-lifecycle-contract`（若需要 delta）：列表 reload 空/降级时保留本地可见会话的冷启场景交叉引用。  
- `runtime-performance-evidence-gates`（可选轻量 delta）：冷启 evidence 增加「first-paint 事件存在」「full-catalog 不阻塞 gate」类门禁说明（不强制本 change 采满 release 矩阵）。

---

## Impact

### 代码触面（预期）

| 区域 | 文件/模块（示意） |
|------|-------------------|
| Hydration 调度 | `useWorkspaceThreadListHydration.ts`、`workspaceThreadListLoadGuard.ts`、`startupForceEnter.ts` |
| Orchestrator | `startupOrchestrator.ts`、`startupTrace.ts` |
| 列表实现 | `useThreadActions.ts`、`useThreadActions.threadList.ts`（first-paint 跳过子源、OpenCode 预算） |
| Gate | `StartupGateOverlay.tsx`（ready 语义；诊断包字段） |
| Git 冷启 | `useGitStatus` / layout 触发链（禁秒级、冷启 defer） |
| Catalog | `useModels` / `useSkills` / `useEngineController` 冷启 phase |
| 测试 | hydration / orchestrator / gate / threadList 单测 + dump 夹具 |
| 文档 | 本 change design/tasks；可选更新 08-07 分析文档「执行闭环」段 |

### 依赖与平台

- 三端 Tauri 共用列表编排；uiScale 仍依赖既有 defer/gate。  
- 无新第三方依赖预期。

### 与现有 change 关系

- 不替代 `fix-ui-scale-native-zoom-freeze-all-platforms`；缩放与列表交叉仍靠 gate + 本契约。  
- 继承并执行 `client-startup-orchestration` 中已写但未闭环的要求（active 有界 hydrate、idle 可中断、heavy cap）。

---

## 分阶段落地（大提案，可拆 PR）

| 阶段 | 内容 | 验收焦点 |
|------|------|----------|
| **S0 诊断冻结** | dump 字段定版；记录 first-paint 缺失为 fail | 夹具可复现 |
| **S1 路径纠偏** | 冷启必 first-paint；修 on-demand/force 误入 | dump 出现 first-paint |
| **S2 Gate 诚实** | timeout 不 stamp ready；force-enter 真静音 | gate 原因可归因 |
| **S3 重扫与 IPC** | 禁止同 key 超时重扫；结果丢弃；OpenCode 预算 | mossx 不再第二轮 20s |
| **S4 范围** | 非 active 不 full；git/skills/model 错峰 | 双 ws 冷启 IPC 减半量级 |
| **S5 收口** | 观测 + 文档 + 回归矩阵 | 体感 cold-start 可点 &lt; 目标阈值（design 定数） |

---

## 验收标准

### 行为验收（必过）

1. 冷启 diagnostic dump **必须出现** `thread/list first-paint hydration`（active workspace）。  
2. `startup-gate-ready` 的 stamp 原因 ∈ {first-paint 完成, home input-ready, force-enter}；**不得** ∈ {full-catalog timeout, degraded}。  
3. 同一 `thread-list:full-catalog:<wsId>` 在 timeout/degraded 后 **60s 内不得自动再 started**（除非用户 force refresh / 切回 ensure）。  
4. 冷启期间非 active workspace **不得** 与 active 并行跑 full-catalog。  
5. OpenCode 单次冷启路径 IPC 有上限（具体 ms 在 design 定；默认方向：失败/超时用 last-good，不堵 first-paint）。  
6. 用户业务：冷启后能选会话、发消息；侧栏不永久空；last-good 会话不因子源 timeout 消失。

### 性能方向（design 落数，实现对照 dump）

| 指标 | 基线（本 dump） | 目标方向 |
|------|-----------------|----------|
| elapsed 到可点（gate 或 force） | 假 ready ~22s / 真忙 ~57s | first-paint 后可点，数量级秒级 |
| opencode_session_list 冷启合计 | ~28s | 不进 first-paint 关键路径；full 可取消 |
| list_threads 同 ws 次数 | 5+ | 1 次 in-flight / 阶段 |
| full-catalog task timeout 重入 | 有 | 无 |

### 工程验收

- 相关 Vitest 全绿；orchestrator / hydration / gate 有回归。  
- `openspec validate` 本 change 通过。  
- 人工：双 workspace + OpenCode 重仓冷启；force-enter；切 workspace；uiScale≠1 不回归假死。

---

## Impact 总结（给评审）

| 问 | 答 |
|----|-----|
| 是重新做编排吗？ | **否**。沿用 StartupOrchestrator 五阶段；补 **执行闭环与重活预算**。 |
| 影响正常发消息/会话吗？ | **主路径不改**。改的是 **冷启何时、扫多全、超时怎么办**。 |
| 有产品可见变化吗？ | 有：**侧栏先短后全**、非当前库历史稍晚；属有意。 |
| 为何一个大提案？ | P0–P2 同因果链；统一契约可避免再「只加遮罩不减活」。 |

---

## 下一步

1. 评审并确认本 proposal（尤其 **BREAKING：先短后全** 与 OpenCode 懒化）。  
2. 通过后写 `design.md`（时序、状态机、超时/取消表、目标阈值）与 capability deltas。  
3. `tasks.md` 按 S0–S5 拆可并行 PR。  
4. 实现前保留当前 StartupGate 诊断包，用于 A/B dump 对比。
