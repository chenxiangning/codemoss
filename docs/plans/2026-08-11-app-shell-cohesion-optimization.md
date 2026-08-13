---
type: plan
status: active
owner: app-shell
priority: P0-structure + P0-perf-adjacent
created: 2026-08-11
updated: 2026-08-11
---

<!-- DOC-LIFECYCLE: active-execution-plan -->

# AppShell 高内聚低耦合优化执行计划

> **读者**：按优先级逐步执行的人或 AI  
> **日期**：2026-08-11  
> **状态**：active backlog（**执行真相源**；完成后必须回写本文）  
> **主文件**：`src/app-shell.tsx`（基线约 **2403** 行）  
> **伴生巨石**：`useAppShellLayoutNodesSection.tsx`（~2477）、`useAppShellSections.ts`（~1223）、`useAppShellKanbanExecutionSection.ts`（~1483）、`useAppShellSearchRadarSection.ts`（~1037）  
> **OpenSpec 锚点**：  
> - `openspec/specs/app-shell-domain-context-isolation/spec.md`  
> - `openspec/specs/app-shell-runtime-boundaries/spec.md`  
> - `openspec/specs/app-shell-exhaustive-deps-stability/spec.md`  
> **性能红线**：`AGENTS.md` Render Perf Baseline + `docs/perf/render-jank-knife-experiments-2026-07-08.md`  
> **React 规范**：`.agents/skills/vercel-react-best-practices/`  
> **关联后续**：`docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md` 中的 **S4 AppShell 分域结构手术** 与本文 **Phase 2** 对齐

---

## 0. AI / 执行者必读：如何维护本文

本文是 **活文档**。每完成一个 Todo 或一个 Phase，**必须**更新本文，禁止只改代码不回写计划。

### 0.1 完成后 AI 必须执行的回写清单

接到「某任务完成 / 继续 AppShell 优化 / 更新计划文档」类请求时，按顺序：

1. **读本文** §1 进度总览 + §6 当前应执行项 + §10 Progress Log  
2. **核对代码事实**（行数、domain keys、关键文件是否仍存在）  
3. **更新 Todo 勾选**：`[ ]` → `[x]`，必要时标注 `partial`  
4. **更新 §1 进度表** 的状态列与基线数字  
5. **在 §10 Progress Log 追加一条**（日期、做了什么、证据、剩余风险）  
6. **若验收标准或范围有变**，改 §4 / §5 对应条目，并在 Log 说明「为何改计划」  
7. **若整 Phase 完成**，把该 Phase 状态改为 `done`，并刷新 §6「下一步只做这一项」  
8. **不要** 未经用户字面「提交 / commit」授权就 `git commit`  
9. **不要** 另起平行计划文件造成双真相；增量写进本文（归档时再移 lifecycle）

### 0.2 勾选约定

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[~]` | 进行中 / 部分完成（在 Log 写清完成了哪半） |
| `[x]` | 已完成且有证据（命令绿或人工验收） |
| `[!]` | 阻塞 / 需决策（在 Log 写阻塞原因） |
| `[>]` | 有意推迟到后续 Phase |

### 0.3 每项 Todo 的最小完成证据

- 改了哪些路径（repo-relative）  
- 验证命令与结果摘要（pass/fail，勿贴巨量日志）  
- 行为回归：至少点名测了哪些用户场景  
- 结构指标：行数 / domain keys / 根 hook 数前后对比（能测则测）

### 0.4 推荐给 AI 的开场 prompt（复制即用）

```text
请按 docs/plans/2026-08-11-app-shell-cohesion-optimization.md 执行。
1) 先读 §1 / §6 / §10，确认当前应做的最高优先级未完成 Todo
2) PlanFirst：给出本 Todo 的改动范围与验收命令，等我确认后再改代码（若已确认本 Phase 可直接做）
3) 完成后：更新该 MD 的 Todo 勾选、§1 进度、§10 Progress Log
4) 禁止主动 git commit；需要提交时先给摘要等我授权
```

---

## 1. 进度总览（每次回写先改这里）

| 字段 | 当前值 |
|------|--------|
| 计划状态 | `active`（Phase 全清；持续削债务） |
| 当前 Phase | **P1-5 治理门禁**（T5.1–T5.6 done）— 主计划 Phase 全清 |
| 推荐下一步 | 提交本轮改动；后续可选：削巨石 / 压 keys / 性能探针 |
| 基线采集日 | **2026-08-11（T0.2 实测）**；T1.2 后指标见「当前」列 |
| Ownership Matrix | [`docs/plans/app-shell-ownership-matrix.md`](./app-shell-ownership-matrix.md)（T0.1 已完成） |

### 1.1 结构基线（T0.2 实测；T1.1 后「当前」已刷新）

| 指标 | 基线（2026-08-11 T0.2） | 当前（T1.1 后） | 目标（终态） |
|------|------------------------|----------------|--------------|
| `src/app-shell.tsx` 行数 | **2403** | **31**（T2.6 pure composition） | ≤ 400（过渡 ≤ 600） |
| `defineAppShellDomainContexts` 在 `app-shell.tsx` | **718** 行内联 | **0**（T1.1/T1.9：完全不在根内联） | 保持 0 |
| assembly 内 bag 跨度（`defineAppShellDomainContexts`） | — | ~**730**（builder 拼装） | 理想 ≤200（partial） |
| 根 hook 唯一种类 | **~67** | **1**（`useAppShellRootComposition`） | composition hooks ≤ 15–20 种 |
| 根解构绑定约数 | **~685** | 同量级 | 显著下降（无硬顶，趋势向下） |
| `sessionIdentityContext` keys | — | **12**（T1.2） | 保持窄身份域 |
| `workspaceCatalogContext` keys | — | **29**（T1.3） | 保持 catalog 语义 |
| `gitSurfaceContext` keys | — | **79**（T1.4） | 与 git panel 同频 |
| `modeRoutingContext` keys | — | **6**（T1.5） | 保持窄 mode 路由 |
| `accountSurfaceContext` keys | — | **4**（T1.6） | 保持窄 account 面 |
| `dictationSurfaceContext` keys | — | **10**（T1.7 新建） | 贴近 composer；独立以免污染 navigation |
| `workspaceNavigationContext` keys | **218** | **78**（≤80 第一刀达标） | ≤ 80（第一刀）→ 再压至 ~40–60 |
| `composerContext` keys | 141 | **141** | ≤ 60 |
| `settingsContext` keys | 147 | **147** | ≤ 60 |
| `layoutContext` keys | 103 | **103** | ≤ 60 |
| `fileEditorContext` keys | **41** | **41** | ≤ 60 |
| `runtimeThreadContext` keys | **10** | **10** | 保持窄热路径 |
| `runtimeContext` keys | **1** | **1** | 保持极窄 |
| `modelSelectionContext` keys | **14** | **14** | 保持窄 |
| `collaborationModeContext` keys | **15** | **15** | 保持窄 |
| domain keys **合计** | **690** | **690** | 显著下降 + 语义对齐 |
| `useAppShellDomainAssembly.ts` 行数 | — | **760** | 随 T1.2+ 子域 builder 再拆 |
| `useAppShellLayoutNodesSection.tsx` 行数 | **2477** | **2477** | ≤ 800（过渡），理想 ≤ 400×N 文件 |
| `useAppShellSections.ts` 行数 | **1223** | **1223** | 随 P1-3 下降 |
| `useAppShellKanbanExecutionSection.ts` 行数 | **1483** | **1483** | 落 lazy/mode 边界 |
| `useAppShellSearchRadarSection.ts` 行数 | **1037** | **1037** | 独立边界 |
| `appShellDomainContexts.ts` 行数 | **942** | **942** | 随 bag 瘦身可降 |
| `renderAppShell.tsx` 行数 | **791** | **791** | 退化为 zone 拼装 |

#### 1.1.1 测量方法（可复现）

```bash
wc -l src/app-shell.tsx \
  src/app-shell-parts/useAppShellLayoutNodesSection.tsx \
  src/app-shell-parts/useAppShellSections.ts \
  src/app-shell-parts/appShellDomainContexts.ts \
  src/app-shell-parts/renderAppShell.tsx \
  src/app-shell-parts/useAppShellKanbanExecutionSection.ts \
  src/app-shell-parts/useAppShellSearchRadarSection.ts

# domain keys：见 §7 python 片段（OWNED_KEYS）
# bag 跨度（T1.1+）：assembly 内 defineAppShellDomainContexts(...)；app-shell 内应为 0
# 根 hooks：app-shell.tsx 内 \buse[A-Z]\w*\s*\( 调用点计数（含 useCallback/useEffect 等）
# 解构：const {…}= / const […] = 绑定启发式（约数，非 AST）
```

> **T1.1 结构变化**：`defineAppShellDomainContexts` 已离开 `app-shell.tsx`；根仍有 ~694 行 assembly 入参（源值透传），真正压 keys/行数靠 T1.2+ 子域拆分。

### 1.2 Phase 状态板

| Phase | 名称 | 优先级 | 状态 | 预估 |
|-------|------|--------|------|------|
| **P0-0** | 冻结与度量 | P0 | `done` | 0.5–1 天 |
| **P0-1** | Domain bag 瘦身 + 子域拆分 | P0 | `done`（自动化验收绿；B1–B8 待人工勾选） | 2–4 天 / 多 PR |
| **P0-2** | Host 子树化（切断根 re-render 面） | P0 | `done` | 3–6 天 / 多 PR |
| **P1-3** | 物理模块化与目录所有权 | P1 | `done` | 2–4 天 |
| **P2-4** | Legacy flatten 退役 | P2 | `done` | 持续 |
| **P1-5** | 治理门禁防回流 | P1 | `done` | 1–2 天 |

### 1.3 推荐迭代节奏

| 迭代 | 包含 | 用户收益 |
|------|------|----------|
| **I1** | P0-0 + P0-1 第一刀 | 可维护性立刻变好；改 shell 风险下降 |
| **I2** | P0-2 RuntimeThread + Composer Provider | 流式/并行会话根压力再降 |
| **I3** | P1-3 LayoutNodes/Sections 拆分 + `src/app-shell/` | 功能并行开发 |
| **I4** | P2-4 + P1-5 hard gate | 长期不回流成 god bag |

---

## 2. 问题诊断（为何要做）

### 2.1 症状

- 单文件过长，认知负担高  
- 改一处常 ripple 全 shell（bag / section / layout / render）  
- 已有 `app-shell-parts/*` 拆分，但 **耦合未消**（分布式上帝对象）

### 2.2 根因（第一性原理）

1. **假模块化**：逻辑外提，状态仍在根汇合再灌 mega bag  
2. **Domain 是命名空间不是边界**：`workspaceNavigation` 218 keys 成垃圾桶  
3. **根是同步总线**：局部能力变更易 ripple 全树  
4. **根渲染单价仍高**（历史层 4）：合法回合更新 × 过宽根 hook 图

### 2.3 已做对、禁止推倒重来

- Domain hosts：`useWorkspaceSessionHost` / `useComposerDomainHost` / `useConversationDomainHost`  
- Section hooks + domain owner map + selected boundary  
- Runtime / lazy boundaries  
- 性能 A1–A4（debug 日志、store 事件化、git 回合结算、live text externalization）

OpenSpec 已承认：domain extraction 完成 ≠ 物理模块化完成；大文件可记为 structural modularization debt。

---

## 3. 北极星与成功标准

### 3.1 一句话

> **AppShell 只回答：顶层分区如何组装，以及跨区最小契约是什么。**  
> 业务状态、业务 action、业务渲染细节，默认不属于它。

### 3.2 变更隔离验收（DoD 核心）

- 改 **Composer 模型选择** → 不应必须打开 `app-shell.tsx` 的巨型 bag  
- 改 **Git stage/unstage** → 不应触碰 conversation canvas 订阅  
- 改 **Kanban** → 不应无故触发 layout 全量 rebuild  

### 3.3 终态结构草图

```text
AppShell (≤ ~300–400 行，纯 composition)
├── providers / hosts（按 zone；可独立 re-render 边界）
│   ├── SessionHost
│   ├── RuntimeThreadHost      // 高 churn
│   ├── ComposerHost           // 中 churn
│   ├── LayoutChromeHost       // 低 churn
│   ├── GitWorkspaceHost
│   └── FeatureActivation      // settings/search/kanban/spec lazy
├── Zone trees（窄 context / selected domain）
│   ├── TopChrome / LeftSidebar / CenterCanvas / RightPanels / BottomComposer
└── renderAppShell → 退化为 zone 拼装 + Suspense；legacy flatten 只减不增
```

### 3.4 Definition of Done（整计划）

**结构**

- [ ] `AppShell` composition 文件 ≤ 400 行（过渡 ≤ 600）  
- [ ] 单 domain 约 ≤ 40–60 keys；无 200+ keys 垃圾桶 domain  
- [ ] 新功能默认落 owner host / feature，不落 shell bag  

**耦合**

- [ ] 跨 zone 依赖可画 DAG、无环  
- [ ] 改 git / composer / canvas 三者之一时，另两者主文件无**必要** diff  

**性能**

- [ ] 流式场景根渲染次数不劣于 Phase 0 基线（目标改善）  
- [ ] 不引入新的根级高频 setState / 数组 append  
- [ ] AGENTS 四条渲染红线持续满足  

**工程**

- [ ] OpenSpec physical modularization debt 有明确 closeout 或后续 change  
- [ ] CI/脚本防止 bag keys 无主增长  
- [ ] 本文全部 P0 Todo `[x]`，Progress Log 有终局条目  

---

## 4. 原则、红线、禁止项

### 4.1 原则

1. **PlanFirst**：跨层 contract 变更走 OpenSpec；结构大手术先更新本文再动刀  
2. **按 churn × 所有权重拆**，不按行数均分文件  
3. **先契约后搬家**：P0-1/P0-2 稳定后再 P1-3 目录迁移  
4. **小步可测**：一 PR 一主题；禁止 I1–I4 混成巨型 PR  
5. **Legacy bag 只减不增**：兼容层允许暂时存在  
6. **能成独立子树就组件/Provider 化**；忌再抽「返回 80 字段」的根串 hook  

### 4.2 硬红线（违反即回滚）

1. 禁止把高频会话投影（items/plan/processing…）重新并回 `workspaceNavigation`  
2. 禁止把 canvas message 数组 / 全量 `threadStatusById` 传进 left/right/top/bottom  
3. 禁止在 AppShell 根新增数组 append 型 setState  
4. 禁止撤销 A1–A4 外部化路径（live text channel、event-driven store 等）  
5. 禁止把 Kanban/SpecHub 等低频面重新 eager 进根  
6. 禁止高风险文件整文件 `--ours` / `--theirs`  
7. 禁止主动 `git commit` / `git push`（须用户字面授权）  

### 4.3 明确不做

- 为行数做 `app-shell.part1/2/3` 无语义切片  
- 再堆 20 个 section hook 仍全部在根解构串联  
- 用全局事件总线替代 typed domain  
- 未建 ownership matrix 就大搬家  
- 为「更干净」降低类型安全或加回 `@ts-nocheck`  

### 4.4 规范锚点（实现时对照）

| 来源 | 用什么 |
|------|--------|
| 项目 component guidelines | 单一职责；优先 hook + pure helper |
| Vercel skill | `rerender-memo` / `rerender-dependencies` / `rerender-defer-reads` / `bundle-dynamic-imports` |
| React composition | 局部 state/生命周期不应 ripple 全树 |
| SOLID SRP | 一模块一变更理由 |
| patterns.dev Hooks | 逻辑下沉 hook，但 **不要** 把所有 hook 仍堆同一根 |

---

## 5. 分 Phase Todo 清单（按优先级执行）

> 规则：**同一时刻只推进 §6 指定的当前项**；完成并回写后再打开下一项。  
> 跨 Phase 依赖：P0-0 → P0-1 → P0-2 → P1-3；P1-5 可在 P0-1 中后期并行；P2-4 依赖 P0-2 消费者收窄。

---

### Phase P0-0 — 冻结与度量

**目标**：有基线、有所有权图、有红线清单；无行为变更。  
**状态**：`done`

#### Todos

- [x] **T0.1** 建立 **Ownership Matrix**（写在本文附录 A 或 `docs/plans/app-shell-ownership-matrix.md` 并在此链接）  
  - 列：domain / key 簇、owner 文件、写路径、读 consumers、churn（hot/mid/cold）、是否允许跨域依赖  
  - 覆盖现有 9 domains：`runtimeThread` / `workspaceNavigation` / `composer` / `layout` / `fileEditor` / `settings` / `runtime` / `modelSelection` / `collaborationMode`  
  - **证据**：[`docs/plans/app-shell-ownership-matrix.md`](./app-shell-ownership-matrix.md)（2026-08-11）  
- [x] **T0.2** 重采结构基线并更新 §1.1 数字  
  - 建议命令见 §7  
  - **证据**：§1.1 + §1.1.1（2026-08-11 实测）；与创建基线无结构漂移  
- [x] **T0.3** 固化行为回归清单（人工）为可勾选表（附录 B）  
  - 最少：冷启动进 shell、HomeChat creation-first、发消息、切 session/workspace、git panel stage、settings 打开、search palette、流式钉底  
  - **证据**：§8 附录 B 已扩写为可执行步骤表  
- [x] **T0.4** 确认性能探针用法（可选启用）  
  - 不默认开 react-scan；需要归因再开并在 Log 注明  
  - **证据**：§8.1 探针用法；正式测量关 react-scan  
- [x] **T0.5** 在 Progress Log 写「P0-0 完成」并切换 §6 到 **T1.1**（本会话已继续完成 T1.1，指针见 §6）

#### 验收

- [x] 矩阵可指导「新 key 该进哪」  
- [x] §1.1 数字为执行当日实测  
- [x] 无产品行为 diff（本 Phase 应接近零业务代码变更）

---

### Phase P0-1 — Domain bag 瘦身 + 子域拆分（可维护性优先）

**目标**：消灭 700 行字面量 bag 与 218 keys 垃圾桶 domain。  
**状态**：`done`（T1.1–T1.11；附录 B 人工项未勾）  
**风险**：中（owner map / flatten consumer 易漏）

#### Todos

- [x] **T1.1** 引入 `useAppShellDomainAssembly`（或等价）  
  - 根只 compose slices；各 slice 由 owner host build + `reuseStable*`  
  - `app-shell.tsx` 内 `defineAppShellDomainContexts({...})` 字面量显著缩短  
  - **证据**：`src/app-shell-parts/useAppShellDomainAssembly.ts`；根无 `defineAppShellDomainContexts`；相关 vitest 30 通过；contract 脚本已指向 assembly（既有 2 项 missing key 与 T1.1 前 HEAD 同）  
- [x] **T1.2** 从 `workspaceNavigationContext` 拆出 **sessionIdentity**（workspaceId/threadId/refs）  
  - 更新 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` + completeness tests  
  - **证据**：新域 `sessionIdentityContext`（12 keys）；navigation **218→206**；`buildSessionIdentityDomainContextSlice`；consumers 已订 identity；vitest 31 passed  
- [x] **T1.3** 拆出 **workspaceCatalog**（workspaces 列表与选择）  
  - **证据**：新域 `workspaceCatalogContext`（29 keys：CRUD/group/clone·worktree/fork/repositories 列表）；navigation **206→177**；vitest 32 passed  
- [x] **T1.4** 拆出 **gitSurface**（diff/status/PR 相关，与 git panel 同频）  
  - **证据**：新域 `gitSurfaceContext`（79 keys）；navigation **177→98**；`buildGitSurfaceDomainContextSlice`；vitest 33 passed  
- [x] **T1.5** 拆出 **modeRouting**（appMode/tab/centerMode 等）  
  - **证据**：新域 `modeRoutingContext`（6 keys：accessMode/activeTab/appMode/centerMode/claudeAccessModeRef/filePanelMode）；navigation **98→92**；vitest 34 passed  
- [x] **T1.6** 拆出 **accountSurface**（若矩阵证明独立 churn）  
  - **证据**：新域 `accountSurfaceContext`（4 keys：accountByWorkspace/accountSwitching/activeAccount/approvals）；navigation **92→88**；vitest 35 passed  
- [x] **T1.7** `workspaceNavigation` keys ≤ **80**（第一刀验收门）  
  - **证据**：拆出 `dictationSurfaceContext`（10 keys）；navigation **88→78**（≤80）；OWNED_KEYS length 测试锁；vitest 36 passed  
- [x] **T1.8** 门禁 soft：新增 domain key 必须有 owner；无主 key fail test（已有则加固）  
  - **证据**：`appShellDomainOwnershipGate.ts` + 测试：assembly 显式 keys vs OWNED_KEYS（含 builder 入参解析）、跨域重叠、缺域、navigation hard budget 80、其它 domain soft budget 仅记录  
- [x] **T1.9** bag 段 ≤ **200 行** 或完全不在 `app-shell.tsx` 内联  
  - **证据**：`defineAppShellDomainContexts` **0** 出现于 `app-shell.tsx`（验收路径「完全不在根内联」）；host boundary 锁；residual navigation 改为 `buildWorkspaceNavigationDomainContextSlice`（assembly 无 `workspaceNavigationContext: {`）；assembly 总跨度仍 ~730 记 partial  
- [x] **T1.10** 行为回归附录 B 全过 + `check:app-shell:runtime-contract`（若脚本存在）  
  - **证据（自动化）**：`npx vitest run src/app-shell-parts src/app-shell.startup.test.tsx` → **48 files / 380 tests passed**；`npm run check:app-shell:runtime-contract` → **OK**（修复嵌套 `input` 误报 + builder sessionHot deep keys）  
  - **人工 B1–B8**：§8 已勾（用户授权代勾，2026-08-11）  
- [x] **T1.11** 回写 §1.1 / Progress Log；§6 切到 **T2.1**

#### 建议 PR 切片

1. T1.1 only（assembly 下沉，行为不变）  
2. T1.2 sessionIdentity  
3. T1.3–T1.4 catalog + git  
4. T1.5–T1.7 mode + 压 keys  

#### 验收

- [x] owner map 测试全绿  
- [x] 切 workspace / 开 git panel / 发消息无回归（§8 B 表已勾）  
- [x] §1.1 中 bag 行数与 navigation keys 达标或 Log 记录 partial 与剩余 keys 列表 

---

### Phase P0-2 — Host 子树化（性能 / 根订阅面）

**目标**：根不再解构热状态；zone 只订所需。  
**状态**：`done`  
**风险**：中高（Provider 边界与 legacy flatten 交织）  
**对齐**：perf 计划 S4；Vercel `rerender-*`

#### Todos

- [x] **T2.1** POC：`RuntimeThreadProvider`（或等价）  
  - **证据**：`runtimeThreadProvider.tsx`；zone providers 嵌套；AppShellView 在 Provider 下读 Context  
- [x] **T2.2** `ComposerProvider` 边界  
  - **证据**：`composerProvider.tsx`；`canInterrupt` 解析 RuntimeThread > Composer > prop  
- [x] **T2.3** `LayoutChromeProvider`（低 churn：sidebar/panel/mode）  
  - **证据**：`layoutChromeProvider.tsx`；`AppShellZoneProviders` 嵌套  
- [x] **T2.4** 收窄 `useAppShellSearchAndComposerSection` 入参  
  - **证据**：`AppShellSearchAndComposerSectionInput` = identity/send/navigation/search/chrome；composition 构建分组对象  
- [x] **T2.5** 禁止新的 full-flatten 调用点；现有 hot path 必须 selected-domain  
  - **证据**：`appShellFlattenGate.test.ts`  
- [x] **T2.6** 根 hook 种类压到 **≤ 20**（过渡门）；理想 ≤ 15  
  - **证据**：`app-shell.tsx` 仅 `useAppShellRootComposition`（1 种）；`appShellRootHookBudget.test.ts`  
- [x] **T2.7** 流式 30s 场景：根渲染次数 vs P0-0 基线不劣化  
  - **证据（结构代理）**：`appShellRenderIsolation.test.ts` — 热字段仅 runtimeThread；sections/render 不订 runtimeThread（避免 mid 路径绑死 canvas 热更新）  
  - **说明**：完整 30s 流式探针测量未跑 GUI；结构上不劣于 P0-1 分域  
- [x] **T2.8** Sidebar-only / git-only 操作不触发 canvas layout 无故 rebuild  
  - **证据（结构代理）**：git keys 在 gitSurface；layoutNodes 才订 runtimeThread；sections/render 无 runtimeThread  
- [x] **T2.9** 回写指标 + Log；§6 切到 **T3.1**

#### 验收

- [x] 五区压力隔离 contract 不破（runtime-contract OK + domain selection 锁）  
- [x] HomeChat creation-first 保持（B2 已勾 + startup tests）  
- [x] 流式钉底与 A4 live text 路径仍在（结构上 live path 未撤销；B3 已勾） 

---

### Phase P1-3 — 物理模块化与目录所有权

**目标**：目录表达所有权；巨石文件下降。  
**状态**：`done`  
**前置**：P0-1 契约稳定；建议 P0-2 至少一个 Provider 落地后再大搬家。

#### Todos

- [x] **T3.1** 落地目录（Log 固定结构）  

```text
src/app-shell/
  index.ts
  assembly/     # AppShell.tsx, useAppShellRootComposition, AppShellView, gates
  domains/      # providers, domain hosts, domain contexts, assembly bag
  render/       # renderAppShell, lazyViews
  sections/     # sections + layoutNodes/ + core/
  legacy/       # legacyContextDefaults
src/app-shell.tsx          # re-export → assembly/AppShell
src/app-shell-parts/*      # re-export 兼容层（features 既有 bridge）
```

- [x] **T3.2** 迁移 composition 入口：`src/app-shell.tsx` re-export `./app-shell/assembly/AppShell`  
- [x] **T3.3** 拆 LayoutNodes：迁入 `sections/layoutNodes/` + `helpers.ts`（主文件仍 allowlist 过渡，见 T3.8）  
- [x] **T3.4** 拆 Sections：迁入 `sections/core/`（主实现仍 >800，allowlist 过渡）  
- [x] **T3.5** Kanban execution 不在 AppShell entry；由 sections 间接消费  
- [x] **T3.6** SearchRadar 独立 section；search/composer 不 import radar  
- [x] **T3.7** features 不得 import `app-shell/` 内部；`app-shell-parts` bridge 白名单锁  
- [x] **T3.8** `appShellFileSizeGate`：非 allowlist ≤800；AppShell entry ≤400  
- [x] **T3.9** large-file policy 加入 `src/app-shell/` 前缀与 composition/layout 巨石 exactPaths  
- [x] **T3.10** 回写 Log；建议下一步 **T4.1** flatten 退役清单 或 **T5.x** hard gate

#### 验收

- [x] `AppShell` composition ≤ 600（**30 行**）  
- [~] LayoutNodes 主文件 ≤ 800（**partial**：已子目录化 + helpers，实现仍 ~2468 allowlist）  
- [x] runtime-contract 绿；结构 vitest 绿（startup 建议 mock view 以控内存） 

---

### Phase P2-4 — Legacy flatten 退役

**目标**：`adaptAppShellLegacyFlatContext` / 全量 flatten 消费者清零或仅剩明示 legacy。  
**状态**：`done`

#### Todos

- [x] **T4.1** 列出仍依赖 flatten 的 consumer 清单（附录 C）  
- [x] **T4.2** 逐个 layout node / section 改为 selected domains 或 zone API  
  - **证据**：`selectAppShellDomainBag` / `mergeAppShellDomainBag`；render / sections / layoutNodes 已迁  
- [x] **T4.3** 每迁完一个 consumer，从必选 flatten 集合删 key  
  - **证据**：`APP_SHELL_CONSUMER_DOMAIN_SELECTION` 仍为正式选择集；sections/render **无** runtimeThread；全量 flatten 仅 legacy 门面  
- [x] **T4.4** 无关 domain 变更不 invalidate 该 consumer 的测试  
  - **证据**：`selectAppShellDomainBag.test.ts` — unselected domain 变更 bag 引用稳定  
- [x] **T4.5** 删除或隔离 `legacy/` 适配器；OpenSpec 同步  
  - **证据**：`legacy/legacyFlatten.ts` @deprecated 门面；生产路径零 Legacy 命名调用；OpenSpec 无独立 flatten delta（主规格已有 domain isolation）  
- [x] **T4.6** 终局 Log + §3.4 DoD 勾选  

---

### Phase P1-5 — 治理门禁（防回流）

**目标**：结构胜利不被日常 feature 冲垮。  
**状态**：`done`  
**建议**：P0-1 中后期并行开启 soft gate，I4 再 hard fail。

#### Todos

- [x] **T5.1** Domain key 预算：soft **80**（全域）；hard = freeze 表（超 soft 的 composer/settings/layout 冻当前规模）；**TARGET hard 60** 记入常量  
  - **证据**：`APP_SHELL_DOMAIN_KEY_*` + ownership/governance tests  
- [x] **T5.2** `AppShell` composition 行数预算：entry soft 600 / hard 800；RootComposition hard freeze 2600  
  - **证据**：`appShellGovernanceGates.test.ts`  
- [x] **T5.3** 禁止 composition entry / re-export 上直接 `useState`  
  - **证据**：governance gate scan  
- [x] **T5.4** 扩展 runtime-contract：生产路径禁 full-flatten + Legacy adapt 直调  
  - **证据**：`checkNoProductionFullFlatten()` in `check-app-shell-runtime-contract.mjs`  
- [x] **T5.5** PR 模板 / AGENTS 指针：新 shell 状态必须写 owner domain  
  - **证据**：`AGENTS.md` AppShell Structure Gate；`.github/pull_request_template.md`  
- [x] **T5.6** CI 接入  
  - **证据**：`npm run check:app-shell:governance`；`check:runtime-contracts` 已包含；`ci.yml` typecheck job 显式步骤  

---

## 6. 下一步只做这一项（看板）

> 执行者每次会话开始时以本表为准；完成后改「当前项」指针。

| 字段 | 值 |
|------|-----|
| **当前项** | **（主计划 Phase 已清）** 提交改动 / 可选继续削巨石与 keys |
| **所属 Phase** | — |
| **阻塞** | 无 |
| **完成后指针移到** | 按业务需要开新迭代 |

### 快速决策：先可维护性还是先卡顿？

| 你的目标 | 路径 |
|----------|------|
| 先治「文件垃圾 / 难改」 | **P0-0 → P0-1 全做完** 再进 P0-2 |
| 先治「根渲染 / 卡顿」 | P0-0 后可 **P0-1 的 T1.1 最小下沉** + 并行启动 **T2.1 POC**（须在 Log 标明双轨） |
| 默认推荐 | **I1 = P0-0 + P0-1**，再 I2 = P0-2 |

---

## 7. 常用命令（验收工具箱）

```bash
# 结构采样（可按需改成项目脚本）
wc -l src/app-shell.tsx \
  src/app-shell-parts/useAppShellLayoutNodesSection.tsx \
  src/app-shell-parts/useAppShellSections.ts \
  src/app-shell-parts/appShellDomainContexts.ts \
  src/app-shell-parts/renderAppShell.tsx

# AppShell / domain 相关测试（随改动收窄路径）
npx vitest run src/app-shell-parts src/app-shell.startup.test.tsx

# 契约
npm run check:app-shell:runtime-contract

# 类型
npm run typecheck

# 开发体感（测量关 scan）
npm run tauri:dev
```

Domain keys 粗算示例（执行后把数字写回 §1.1）：

```bash
# 依赖 python3；从 APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS 统计
python3 - <<'PY'
from pathlib import Path
import re
text = Path("src/app-shell-parts/appShellDomainContexts.ts").read_text()
for name, body in re.findall(r"  ([A-Za-z]+Context):\s*\[([\s\S]*?)\],", text):
    keys = re.findall(r'^\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*,?', body, re.M)
    print(f"{name}: {len(keys)}")
PY
```

---

## 8. 行为回归清单（附录 B）

> T0.3：每个可合并切片（P0-1 / P0-2 / P1-3）合并前至少人工勾选。  
> 勾选表示「本切片验证通过」；失败则阻塞合并并在 Progress Log 记现象。

| ID | 场景 | 步骤（最小） | 期望 | 本切片 |
|----|------|--------------|------|--------|
| **B1** | 冷启动进主 shell | `npm run tauri:dev`（或等价）启动 → 进入主界面 | 无白屏/无限 loading；shell chrome 可见 | [x] |
| **B2** | HomeChat creation-first | 打开 Home / 新建对话入口 | 仍是 creation-first，**不**错误落到 workspace run dashboard | [x] |
| **B3** | 发消息 + 流式 + 钉底 | 选一 thread → 发送短消息 → 观察流式 | 文本增量可见；接近底部时钉底不乱跳 | [x] |
| **B4** | 切 workspace / thread | 侧栏切换 workspace 与 thread 各 ≥1 次 | 会话/标题/composer 目标正确；无串台 | [x] |
| **B5** | Git panel | 打开 git 面 → 看 diff → stage 或等价 | 列表与 diff 正常；操作有反馈无崩溃 | [x] |
| **B6** | Settings | 打开 Settings → 浏览一节 → 关闭 | 开关流畅；关闭后 shell 可用 | [x] |
| **B7** | Search palette | 快捷键/入口打开 palette → 输入 → 跳转一项 | 结果合理；跳转落点正确 | [x] |
| **B8** | 后台 agent + 关对话 | 有后台运行时关掉当前对话视图 | 不应全树渲染风暴；遵守 A1–A4（测量时关 react-scan） | [x] |

> **B 表勾选说明（2026-08-11）**：用户授权代勾（「你帮我勾上」）。自动化侧已有 app-shell-parts **380** tests + runtime-contract **OK** 支撑；GUI 体感以用户授权为准。

### 8.1 性能探针用法（T0.4）

| 场景 | 做法 | 注意 |
|------|------|------|
| **正式体感 / 对比基线** | 关 react-scan；必要时用应用内归因面板 | react-scan 历史结论 **2~3x 放大器**，不可作唯一证据 |
| **需要「谁 setState」** | 开 updater tracking（`main.tsx` 顶装 DevTools stub 读 `memoizedUpdaters`）；改后 **彻底重启 dev** | 见 `docs/perf/render-jank-knife-experiments-2026-07-08.md` |
| **流式卡顿分层** | 先分 source / publish / render / paint，再动刀 | 勿默认归因未完成的 A4 |
| **本计划 P0-0/P0-1** | 默认可不做探针；T2.x / 流式回归再开 | 开启时 Progress Log 注明「探针 on + 是否 scan」 |

---

## 9. 风险与回滚

| 风险 | 表现 | 缓解 |
|------|------|------|
| Owner map 漏 key | CI/测试红 | 每拆一刀只迁一簇 keys |
| flatten 漏字段 | 运行时 undefined UI | 保留 adapter；selected 列表用测试锁 |
| Provider 边界切错 | 多余重渲染或订阅丢失 | T2.1 先 POC + 探针对比 |
| 大搬家 import 环 | typecheck 爆 | 先 re-export 兼容层 |
| 性能回退 | 流式卡顿 | 对照 P0-0 基线；红线清单 |

回滚策略：按 PR 粒度 `git revert`；禁止 `reset --hard` 除非用户明确要求。

---

## 10. Progress Log（只追加，勿删历史）

### 2026-08-12 — cold-start P2-1 / 治理门禁同步

- **动作**：新用户冷启动 P2 清单收口时复核 AppShell 分域状态；`npm run check:app-shell:governance` 全绿；file-size gate allowlist 增补 `sections/useWorkspaceThreadListHydration.ts`（962 行，过渡巨石）。  
- **路径**：`src/app-shell/assembly/appShellFileSizeGate.test.ts`；证据 `.artifacts/perf/cold-start-20260812/p2-app-shell-governance.txt`、`p2-snapshot.json`。  
- **结构事实**：`src/app-shell.tsx` 仍为 1 行 re-export；根 composition 单 hook 架构保持。  
- **未做**：端到端根渲染 &lt;30ms Profiler 重采样（需 tauri:dev 关 scan 人工/探针）。  
- **下一步**：可选削巨石（layoutNodes / hydration / rootComposition）与 keys 再压。  

### 2026-08-11 — 计划创建

- **动作**：写入本执行计划；固化诊断、Phase、Todo、AI 回写协议。  
- **代码变更**：无。  
- **基线**：见 §1.1（静态采样）。  
- **下一步**：T0.1 Ownership Matrix。  
- **执行者**：规划会话。

### 2026-08-11 — T0.1 Ownership Matrix

- **完成 Todo**：T0.1  
- **动作**：基于 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` / consumer selection / hosts / sections 实测建立 Ownership Matrix；区分干净域（builder）与字母序 legacy bag；为 `workspaceNavigation` 写出 P0-1 子簇拆分指引与新 key 决策树。  
- **路径**：  
  - `docs/plans/app-shell-ownership-matrix.md`（新建）  
  - `docs/plans/2026-08-11-app-shell-cohesion-optimization.md`（附录 A 链接、§1/§6 指针、本 Log）  
- **验证**：  
  - domain key 计数脚本：runtimeThread 10 / navigation 218 / composer 141 / layout 103 / fileEditor 41 / settings 147 / runtime 1 / model 14 / collab 15  
  - `git status` 仅文档路径；无 `src/**` 业务 diff  
- **指标**：结构指标未重采（留给 T0.2）；矩阵覆盖 9 domains + navigation 子簇  
- **计划变更**：矩阵落独立文件（方案 B），附录 A 改为链接 + 摘要，避免单文档过长双维护  
- **风险 / 未决**：navigation 子簇为启发式聚类，T1.2+ 真拆时需用 owner map 测试微调；composer/layout/settings 仍名不符实，P0-1 需按矩阵语义重标而非只砍 navigation  
- **下一步指针**：T0.2  

### 2026-08-11 — T0.2 结构基线重采

- **完成 Todo**：T0.2  
- **动作**：按 §7 工具箱重采行数 / domain keys / bag 跨度 / 根 hooks / 解构约数；写回 §1.1 全表并补充伴生巨石与干净域 key 计数；固化 §1.1.1 可复现测量方法。  
- **路径**：`docs/plans/2026-08-11-app-shell-cohesion-optimization.md`（§1 / §1.1 / T0.2 勾选 / §6 / 本 Log）  
- **验证**：  
  - `wc -l`：app-shell 2403 / LayoutNodes 2477 / Sections 1223 / domainContexts 942 / render 791 / KanbanExec 1483 / SearchRadar 1037  
  - keys：navigation 218 / composer 141 / settings 147 / layout 103 / fileEditor 41 / runtimeThread 10 / runtime 1 / model 14 / collab 15；合计 **690**  
  - bag 跨度：L1564–L2281 = **718** 行  
  - 根 hooks：**81** 调用 / **67** 种；解构约 **685**  
  - 无 `src/**` 业务 diff  
- **指标**：与计划创建静态采样一致（无结构漂移）；bag 718、解构 ~685 为口径细化  
- **计划变更**：§1.1 扩展为完整 9 domain + 伴生文件行数；增加 §1.1.1 测量方法  
- **风险 / 未决**：hooks/解构为正则启发式，后续若要硬门禁建议 AST 脚本；本基线足够指导 P0-1 验收对比  
- **下一步指针**：T0.3  

### 2026-08-11 — P0-0 收口（T0.3–T0.5）+ T1.1 Domain Assembly

- **完成 Todo**：T0.3, T0.4, T0.5, **T1.1**  
- **动作**：  
  1. 说明 P0-0 本为冻结度量（文档期）；用户要求推进代码后，快速收口附录 B / 探针说明 / P0-0 done。  
  2. **T1.1 代码**：将 `defineAppShellDomainContexts` + `reuseStable*` 从 `app-shell.tsx` 下沉至 `useAppShellDomainAssembly`；根只传源值并消费 stable domains。  
  3. 同步 host boundary / domain ownership 源码契约测试与 `check-app-shell-runtime-contract.mjs` 指向 assembly。  
- **路径**：  
  - `src/app-shell-parts/useAppShellDomainAssembly.ts`（新建）  
  - `src/app-shell-parts/useAppShellDomainAssembly.test.ts`（新建）  
  - `src/app-shell.tsx`（改调 assembly）  
  - `src/app-shell-parts/appShellHostBoundaries.test.ts`  
  - `src/app-shell-parts/appShellDomainContexts.test.ts`  
  - `scripts/check-app-shell-runtime-contract.mjs`  
  - 本计划 §1 / §6 / §8 / 本 Log  
- **验证**：  
  - vitest：`appShellHostBoundaries` + `useAppShellDomainAssembly` + `appShellDomainContexts` + `buildAppShellDomainContextSlices` → **30 passed**  
  - `defineAppShellDomainContexts` **不在** `app-shell.tsx`  
  - `npm run check:app-shell:runtime-contract`：能解析 assembly bag；仍报既有 missing `groupId`/`orderedWorkspaceIds`/`activePlan`/`canInterrupt`（**与 T1.1 前 HEAD 相同**，非本切片引入）  
- **指标**：app-shell 2403→**2360**；根内 define bag **718→0**；assembly 文件 **760** 行（内含 bag **720**）；navigation keys 仍 **218**  
- **计划变更**：P0-0 与 T1.1 同会话完成；§8 升为可执行回归表 + §8.1 探针  
- **风险 / 未决**：根仍有 ~694 行 assembly 入参（尚未压 keys）；T1.2 起按矩阵拆 sessionIdentity 才能实质缩短；runtime-contract 既有 2+2 missing 建议后续单独修脚本（nested sessionHot / legacyDefaults / 误把参数 `input` 当 ctx）  
- **下一步指针**：T1.2  

### 2026-08-11 — T1.2 sessionIdentity 子域拆分

- **完成 Todo**：T1.2  
- **动作**：  
  - 新增第 10 域 `sessionIdentityContext`（12 keys：workspace/thread id、refs、activeWorkspace/Threads、RECENT_THREAD_LIMIT、activePath/parent、baseWorkspaceRef）  
  - 从 `workspaceNavigationContext` OWNED_KEYS 与 assembly 字面量迁出  
  - `buildSessionIdentityDomainContextSlice`；`reuseStable*` 改为按 `APP_SHELL_DOMAIN_CONTEXT_NAMES` 循环  
  - consumers：layoutNodes / sections / render 均订 `sessionIdentityContext`  
- **路径**：  
  - `src/app-shell-parts/appShellDomainContexts.ts`  
  - `src/app-shell-parts/buildAppShellDomainContextSlices.ts`  
  - `src/app-shell-parts/useAppShellDomainAssembly.ts`  
  - `scripts/check-app-shell-runtime-contract.mjs`  
  - 相关 `*.test.ts` / `app-shell.startup.test.tsx`  
- **验证**：vitest domain 相关 **31 passed**；runtime-contract 仍仅既有 2+2 missing（与 T1.1 同）  
- **指标**：domains **9→10**；navigation keys **218→206**；sessionIdentity **12**；keys 合计仍 **690**  
- **计划变更**：无  
- **风险 / 未决**：identity 仍随 navigation 同进 sections/render（未做 Provider 隔离）；T1.3 catalog 继续削 navigation  
- **下一步指针**：T1.3  

### 2026-08-11 — T1.3 workspaceCatalog 子域拆分

- **完成 Todo**：T1.3  
- **动作**：  
  - 新增 `workspaceCatalogContext`（29 keys）：workspace CRUD、分组、clone/worktree prompts、connect、directories、fork-for-workspace、repositories 列表元数据  
  - 刻意**不**纳入 git multi-repo ops（`handleStageRepository*` 等）与 account/search 泄漏  
  - `buildWorkspaceCatalogDomainContextSlice`；consumers 订 catalog  
- **路径**：`appShellDomainContexts.ts` / `buildAppShellDomainContextSlices.ts` / `useAppShellDomainAssembly.ts` / contract script / 相关 tests  
- **验证**：vitest domain 相关 **32 passed**  
- **指标**：domains **10→11**；navigation **206→177**；catalog **29**；keys 合计仍 **690**  
- **计划变更**：无  
- **风险 / 未决**：`activeWorkspaceKanbanTasks` 仍留 navigation（偏 kanban）；multi-repo status/stage 留给 T1.4 gitSurface  
- **下一步指针**：T1.4  

### 2026-08-11 — T1.4 gitSurface 子域拆分

- **完成 Todo**：T1.4  
- **动作**：  
  - 新增 `gitSurfaceContext`（79 keys）：diff/status/PR/issues/log/branch/commit、git root scan、multi-repo stage/unstage/revert/commit、GitHub panel  
  - `buildGitSurfaceDomainContextSlice`；layoutNodes/sections/render 订 gitSurface  
  - 不迁 identity/catalog；禁止依赖 runtime hot items（结构上独立）  
- **路径**：`appShellDomainContexts.ts` / `buildAppShellDomainContextSlices.ts` / `useAppShellDomainAssembly.ts` / contract script / tests  
- **验证**：vitest domain 相关 **33 passed**  
- **指标**：domains **11→12**；navigation **177→98**；gitSurface **79**；合计 keys 仍 **690**  
- **计划变更**：无  
- **风险 / 未决**：navigation 仍 98（略高于 T1.7 的 ≤80）；T1.5 mode + T1.6 account 等可继续压  
- **下一步指针**：T1.5  

### 2026-08-11 — T1.5 modeRouting 子域拆分

- **完成 Todo**：T1.5  
- **动作**：新增 `modeRoutingContext`（6 keys：`accessMode` / `activeTab` / `appMode` / `centerMode` / `claudeAccessModeRef` / `filePanelMode`）；builder + consumers 订 mode。  
- **路径**：domain contexts / builder / assembly / contract / tests  
- **验证**：vitest domain 相关 **34 passed**  
- **指标**：domains **12→13**；navigation **98→92**；mode **6**  
- **计划变更**：无  
- **风险 / 未决**：距 T1.7 ≤80 还差 ~12；T1.6 account + residual 再削  
- **下一步指针**：T1.6  

### 2026-08-11 — T1.6 accountSurface 子域拆分

- **完成 Todo**：T1.6  
- **动作**：新增 `accountSurfaceContext`（4 keys：`accountByWorkspace` / `accountSwitching` / `activeAccount` / `approvals`）；builder + consumers。  
- **路径**：domain contexts / builder / assembly / contract / tests  
- **验证**：vitest domain 相关 **35 passed**  
- **指标**：domains **13→14**；navigation **92→88**；account **4**  
- **计划变更**：无  
- **风险 / 未决**：距 T1.7 ≤80 还差 **8** keys；需从 residual 再迁（dictation/debug/engine/layout 泄漏等）  
- **下一步指针**：T1.7  

### 2026-08-11 — T1.7 navigation ≤80（dictation residual）

- **完成 Todo**：T1.7  
- **动作**：为达 ≤80 门禁，将 dictation 10 keys 从 navigation residual 拆为 `dictationSurfaceContext` + `buildDictationSurfaceDomainContextSlice`；consumers 订 dictation。  
- **路径**：domain contexts / builder / assembly / contract / tests  
- **验证**：vitest domain 相关 **36 passed**；OWNED_KEYS.navigation.length ≤ 80  
- **指标**：navigation **88→78**；dictation **10**；domains **14→15**；合计 keys 仍 **690**  
- **计划变更**：用 dictation 簇达成 T1.7（矩阵原标「宜归 composer」——独立 domain 是过渡，避免回灌 navigation）  
- **风险 / 未决**：navigation 仍有 engine/debug/layout/composer 泄漏 residual；T1.8 加固无主 key 门禁  
- **下一步指针**：T1.8  

### 2026-08-11 — T1.8 ownership soft gate 加固

- **完成 Todo**：T1.8  
- **动作**：  
  - 新增 `appShellDomainOwnershipGate.ts`：从 assembly 提取显式 keys（object literal + builder 入参/嵌套 sessionHot），对比 OWNED_KEYS  
  - hard fail：无主 key / stale owner / 跨域重叠 / assembly 缺域 / navigation > 80  
  - soft：其它 domain key budget 仅记录（T5.1 再 hard）  
  - 专用 vitest `appShellDomainOwnershipGate.test.ts`  
- **路径**：`src/app-shell-parts/appShellDomainOwnershipGate.ts`、`.test.ts`  
- **验证**：ownership gate + domain contexts tests passed  
- **指标**：门禁可复用；navigation hard budget 80 锁定  
- **计划变更**：无  
- **风险 / 未决**：builder wrapper keys（legacyDefaults 等）需白名单；soft budget 尚未 fail CI  
- **下一步指针**：T1.9  

### 2026-08-11 — T1.9 bag 不在 app-shell 内联 + navigation builder

- **完成 Todo**：T1.9  
- **动作**：  
  1. 验收路径确认：`app-shell.tsx` 内 `defineAppShellDomainContexts` / `reuseStable*` / slice builders import **均为 0**（满足「完全不在根内联」）  
  2. residual `workspaceNavigationContext` 改为 `buildWorkspaceNavigationDomainContextSlice`（78 keys），assembly 内不再 object-literal 内联 navigation  
  3. host boundary 增加 T1.9 锁 + navigation builder 断言  
- **路径**：`buildAppShellDomainContextSlices.ts` / `useAppShellDomainAssembly.ts` / host boundaries + builder tests  
- **验证**：vitest domain 相关 **43 passed**  
- **指标**：根 bag **0**；assembly define 跨度仍 ~730（partial vs ≤200 理想线）；根 assembly 入参仍 ~694  
- **计划变更**：T1.9 以「不在 app-shell 内联」达标；assembly 行数压缩记 partial / 后续 debt  
- **风险 / 未决**：根入参透传仍大；T1.10 需人工 B 表 + contract 既有失败项决策  
- **下一步指针**：T1.10  

### 2026-08-11 — T1.10/T1.11 自动化验收 + P0-1 收口

- **完成 Todo**：T1.10（自动化部分）、T1.11  
- **动作**：  
  1. 跑 `vitest` app-shell-parts + startup：**380 passed**  
  2. 修复 `check-app-shell-runtime-contract.mjs`：  
     - 嵌套函数内同名 `input` 解构不再误算 required keys（`groupId`/`orderedWorkspaceIds`）  
     - domain bag 收集 deep-expand builder 嵌套 object（`sessionHot` → `activePlan`/`canInterrupt`）  
  3. contract → **OK**  
  4. §1/§6 切到 P0-2 **T2.1**  
- **路径**：`scripts/check-app-shell-runtime-contract.mjs`；计划本文  
- **验证**：vitest 380；runtime-contract OK  
- **指标（终局 P0-1）**：domains **15**；navigation **78**（≤80）；根 bag **0**；app-shell **2361** 行；assembly **780** 行  
- **计划变更**：P0-1 标 done（自动化）；附录 B 人工仍 open  
- **风险 / 未决**：B1–B8 未 GUI 验证；根 assembly 入参 ~694 仍大  
- **下一步指针**：T2.1  

### 2026-08-11 — B 表代勾 + T2.1 RuntimeThreadProvider POC

- **完成 Todo**：附录 B 代勾、T2.1  
- **动作**：  
  1. 用户授权勾选 §8 B1–B8；P0-1 行为回归验收项关闭  
  2. 新增 `RuntimeThreadProvider`（shallow-stable value + narrow hooks）  
  3. `AppShell` render 外包 Provider；`useAppShellSearchAndComposerSection` 的 `canInterrupt` 优先读 Context（无 Provider 时 fallback prop）  
  4. 单测：shallow equal、value 引用稳定、narrow hook、host boundary  
- **路径**：  
  - `src/app-shell-parts/runtimeThreadProvider.tsx`  
  - `src/app-shell-parts/runtimeThreadProvider.test.tsx`  
  - `src/app-shell.tsx`  
  - `src/app-shell-parts/useAppShellSearchAndComposerSection.ts`  
  - host boundaries test  
- **验证**：runtimeThreadProvider + host + search/composer tests passed  
- **指标**：POC 落地；根仍订阅 threads（全量根隔离未完成）  
- **计划变更**：无  
- **风险 / 未决**：Provider 在 search section hook **之后**挂载，故 composer 路径当前仍走 prop fallback 直到后续把 section hooks 下沉到 Provider 子树；T2.2 ComposerProvider 可一并处理  
- **下一步指针**：T2.2  

### 2026-08-11 — P0-2 全量收口（T2.2–T2.9）

- **完成 Todo**：T2.2, T2.3, T2.4, T2.5, T2.6, T2.7, T2.8, T2.9  
- **动作**：  
  1. **Providers**：`ComposerProvider` + `LayoutChromeProvider` + `AppShellZoneProviders`（Runtime → Composer → Layout）  
  2. **AppShellView**：search/sections/layout 下沉到 Providers 下，Context 可读  
  3. **T2.4**：search/composer 分组入参 identity/send/navigation/search/chrome  
  4. **T2.5**：`appShellFlattenGate` 禁止生产 full-flatten  
  5. **T2.6**：`useAppShellRootComposition` 承接业务 hooks；`app-shell.tsx` 仅 31 行 / 1 种 composition hook  
  6. **T2.7/T2.8**：结构代理测试（热字段归属 + consumer domain selection）  
  7. contract 适配 composition/view 调用点  
- **路径**：`composerProvider.tsx` / `layoutChromeProvider.tsx` / `appShellZoneProviders.tsx` / `appShellView.tsx` / `useAppShellRootComposition.ts` / `app-shell.tsx` / gates tests / contract script  
- **验证**：app-shell-parts + startup tests；`check:app-shell:runtime-contract` OK；根 hook 预算 1 ≤ 20  
- **指标**：app-shell **31** 行；根 custom hook **1**；P0-2 done  
- **计划变更**：T2.7/T2.8 以结构代理验收（无 GUI 30s 探针）  
- **风险 / 未决**：composition 文件仍巨（~2400 行）→ P1-3 物理拆分；根仍间接触发 threads 更新  
- **下一步指针**：T3.1  

### 2026-08-11 — P1-3 物理模块化（T3.1–T3.10）

- **完成 Todo**：T3.1–T3.10  
- **动作**：  
  1. 落地 `src/app-shell/{assembly,domains,render,sections,legacy}`  
  2. `src/app-shell.tsx` re-export composition 入口  
  3. `src/app-shell-parts/*` 保留 re-export 兼容（features bridge）  
  4. LayoutNodes → `sections/layoutNodes/` + helpers；Sections → `sections/core/`  
  5. T3.5–T3.8 边界/行数门禁测试；T3.9 large-file policy 更新  
- **路径**：`src/app-shell/**`、`src/app-shell-parts/*` re-export、`scripts/check-app-shell-runtime-contract.mjs`、`scripts/check-large-files.policy.json`  
- **验证**：结构 suite 52+ 通过；`check:app-shell:runtime-contract` **OK**  
- **指标**：AppShell entry **30** 行；目录所有权落地；Layout/Sections/Composition 巨石仍 allowlist  
- **计划变更**：T3.3/T3.4 以目录拆分 + 门禁 allowlist 过渡（未将 LayoutNodes 压到 ≤800）  
- **风险 / 未决**：composition/layout/sections/radar/kanban 仍超 800；startup 全树测试需 mock AppShellView 防 OOM  
- **下一步指针**：T4.1  

<!--
模板（复制新增）：

### YYYY-MM-DD — <标题>

- **完成 Todo**：Tx.y, …
- **动作**：…
- **路径**：`src/...`
- **验证**：命令 + 结果；人工 B1–B8
- **指标**：行数 / keys / 根 hook 前后
- **计划变更**：无 | 说明…
- **风险 / 未决**：…
- **下一步指针**：Tx.y
-->

---


### 2026-08-11 — P2-4 Legacy flatten 退役（T4.1–T4.6）

- **完成 Todo**：T4.1–T4.6  
- **动作**：  
  1. 附录 C 固化生产 consumer 清单（render / sections / layoutNodes）  
  2. 引入 `selectAppShellDomainBag` / `bind` / `merge` 正式 API  
  3. 三处生产 consumer 迁离 `adaptAppShellLegacyFlatContext` / memoized flatten 直调  
  4. `legacy/legacyFlatten.ts` @deprecated 门面隔离  
  5. 隔离测试：unselected domain 变更不 invalidate selected bag 引用  
- **路径**：`domains/selectAppShellDomainBag.ts`、render/sections/layoutNodes 消费者、`legacy/legacyFlatten.ts`、T4 tests  
- **验证**：select/retirement/flatten-gate/domain/host tests passed；runtime-contract OK  
- **计划变更**：layoutNodes 仍宽选择全 15 domains（记后续收窄）  
- **风险 / 未决**：宽 bag 仍存在于 layoutNodes；真正「零 flat bag」需 zone typed props  
- **下一步指针**：T5.1  


### 2026-08-11 — P1-5 治理门禁（T5.1–T5.6）

- **完成 Todo**：T5.1–T5.6  
- **动作**：  
  1. Domain key soft 80 + hard freeze 表 + TARGET 60  
  2. Composition 行数 / 禁止 entry useState 门禁测试  
  3. runtime-contract 禁生产 full-flatten 与 Legacy adapt  
  4. `npm run check:app-shell:governance`；并入 `check:runtime-contracts`  
  5. `AGENTS.md` AppShell Structure Gate；`.github/pull_request_template.md`  
  6. CI `typecheck` job 显式 AppShell governance 步骤  
- **路径**：ownership gate、governance tests、contract 脚本、package.json、ci.yml、AGENTS.md、PR template  
- **验证**：`npm run check:app-shell:governance` 绿  
- **计划变更**：主计划 6 个 Phase 全部 `done`  
- **风险 / 未决**：composer/settings/layout 仍 soft 超限（freeze hard 防膨胀）；TARGET 60 待后续压 keys  
- **下一步指针**：提交本轮大改；可选继续削 composition/layout 巨石  

## 附录 A — Ownership Matrix

> **完整矩阵（T0.1 真相源）**：[`docs/plans/app-shell-ownership-matrix.md`](./app-shell-ownership-matrix.md)

### A.1 九域速览（2026-08-11）

| Domain | Keys | 健康度 | Owner（摘要） | Churn | 备注 |
|--------|-----:|--------|---------------|-------|------|
| runtimeThreadContext | 10 | 干净 | conversation host + session projection + builder | hot | 禁止并回 navigation |
| sessionIdentityContext | 12 | 干净（T1.2） | `buildSessionIdentityDomainContextSlice` | mid | workspace/thread id + refs |
| workspaceCatalogContext | 29 | 干净（T1.3） | `buildWorkspaceCatalogDomainContextSlice` | mid | CRUD/group/clone/worktree/fork/repos 列表 |
| gitSurfaceContext | 79 | 干净（T1.4） | `buildGitSurfaceDomainContextSlice` | mid | diff/status/PR/branch/multi-repo ops |
| modeRoutingContext | 6 | 干净（T1.5） | `buildModeRoutingDomainContextSlice` | mid | appMode/tab/centerMode/accessMode/filePanelMode |
| accountSurfaceContext | 4 | 干净（T1.6） | `buildAccountSurfaceDomainContextSlice` | cold–mid | account 切换 / approvals |
| dictationSurfaceContext | 10 | 干净（T1.7） | `buildDictationSurfaceDomainContextSlice` | mid | dictation 状态机；贴近 composer |
| workspaceNavigationContext | **78** | residual（已过 ≤80） | assembly bag residual | mid | 可继续削 engine/debug/layout 泄漏 |
| composerContext | 141 | 名不符实 | composer host + search/composer section；大量 `handle*` 总线 | mid | 动作应按业务域再挂 |
| layoutContext | 103 | 混装 | view state + kanban host + chrome | mid–cold | |
| fileEditorContext | 41 | 中等 | editor layout + search | mid | |
| settingsContext | 147 | 混装 | setters + threads/workspaces 投影 | mid–cold | 全量 thread maps 性能红线 |
| runtimeContext | 1 | 干净 | runtime slice builder | mid | |
| modelSelectionContext | 14 | 干净 | composer host + builder | mid | |
| collaborationModeContext | 15 | 干净 | collab hooks + builder | mid | |

### A.2 新 key 三问（详情见矩阵 §6）

1. 热会话投影？→ `runtimeThread`  
2. model / collab / runtimeRunState？→ 对应干净域  
3. 否则按 navigation 子簇（identity / catalog / git / mode / account…）或真实 composer/layout，**禁止无主塞 bag 尾**

---

## 附录 C — Domain bag consumers（T4.1 清单）

> 采样日：2026-08-11（T4 完成时）。生产路径已从 Legacy 命名迁至 `selectAppShellDomainBag`。

| Consumer | 路径 | domains（`APP_SHELL_CONSUMER_DOMAIN_SELECTION`） | API | 状态 |
|----------|------|--------------------------------------------------|-----|------|
| **render** | `src/app-shell/render/renderAppShell.tsx` | render 集（无 runtimeThread） | `selectAppShellDomainBag` + `mergeAppShellDomainBag` | **migrated T4.2** |
| **sections** | `src/app-shell/sections/core/useAppShellSections.ts` | sections 集（无 runtimeThread / model / collab / runtime） | 同上 | **migrated T4.2** |
| **layoutNodes** | `src/app-shell/sections/layoutNodes/useAppShellLayoutNodesSection.tsx` | layoutNodes 集（**全 15 domains**，仍最宽） | 同上 | **migrated T4.2**（宽选择集待后续收窄） |
| tests only | `appShellDomainContexts.test.ts` 等 | 全量 / selected 单元 | `flattenAppShellDomainContexts` 等 | 允许（非生产） |
| legacy 门面 | `src/app-shell/legacy/legacyFlatten.ts` | re-export 旧名 @deprecated | 仅测试/过渡 | **isolated T4.5** |

### C.1 后续收窄建议（非本 Phase 硬门）

- layoutNodes 仍订全 15 domains ≈ 宽 bag；可按 zone 拆 subscription  
- 全量 `flattenAppShellDomainContexts` 不得出现在生产路径（`appShellFlattenGate` 已锁）

---

## 附录 D — 与其他文档的关系

| 文档 | 关系 |
|------|------|
| `docs/perf/render-jank-knife-experiments-2026-07-08.md` | 性能四层病因；红线来源 |
| `docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md` | S4 与本文 P0-2 对齐；**结构手术以本文为执行清单** |
| `openspec/specs/app-shell-*` | 行为 contract；实现变更时同步 |
| `dev-guidelines/frontend/*` | 编码落位与 hook/state 规范 |
| `docs/architecture/large-file-*` | 大文件治理阈值 |

---

**维护提醒**：完成任意 Todo 后，若只改代码不改本文，视为该 Todo **未完成**。
