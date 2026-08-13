---
type: ownership-matrix
status: active
owner: app-shell
related_plan: docs/plans/2026-08-11-app-shell-cohesion-optimization.md
created: 2026-08-11
updated: 2026-08-11
source_of_truth_code:
  - src/app-shell-parts/appShellDomainContexts.ts
  - src/app-shell-parts/buildAppShellDomainContextSlices.ts
  - src/app-shell.tsx
---

# AppShell Ownership Matrix

> **用途**：回答「新 key 该进哪 / 谁写 / 谁读 / 是否允许跨域」。  
> **执行计划**：[`2026-08-11-app-shell-cohesion-optimization.md`](./2026-08-11-app-shell-cohesion-optimization.md)（T0.1）  
> **采样日**：2026-08-11（T0.2 与结构基线同日重采，keys 无漂移）  
> **结构基线**：见执行计划 §1.1（app-shell **2403** 行；bag **718** 行；hooks **81/67**；keys 合计 **690**）  
> **关键事实源**：`APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`、`APP_SHELL_CONSUMER_DOMAIN_SELECTION`、slice builders、domain hosts

---

## 0. 读矩阵前必知

### 0.1 当前状态：语义域 vs 字母序 bag

| 类型 | Domains | 说明 |
|------|---------|------|
| **干净域**（有 dedicated builder，语义清晰） | `runtimeThread` / `sessionIdentity` / `workspaceCatalog` / `gitSurface` / `modeRouting` / `accountSurface` / `dictationSurface`（T1.7） / `modelSelection` / `collaborationMode` / `runtime` | 新 key 优先走 builder；禁止回灌 mega bag |
| **历史字母序切 bag** | `workspaceNavigation` / `composer` / `layout` / `fileEditor` / `settings` | 名字≠语义边界；key 多按标识符字母序落入不同 domain |

**推论（指导 P0-1）**：

1. 新增 **热会话投影**（items/plan/processing/token…）→ **只进 `runtimeThreadContext`**，禁止进 `workspaceNavigation`。  
2. 新增 **model/effort 选择** → **`modelSelectionContext`**（经 `buildModelSelectionDomainContextSlice`）。  
3. 新增 **collaboration mode** → **`collaborationModeContext`**。  
4. 其余业务 key：先查本矩阵「建议子域 / 目标归宿」；过渡期若仍只能塞进 legacy bag，**只减不增** 地选语义最接近的簇，并在 PR 注明后续拆分目标。

### 0.2 Domain key 计数（2026-08-11 实测）

| Domain | Keys | 目标（计划终态） |
|--------|-----:|------------------|
| `runtimeThreadContext` | 10 | ~10–20（保持窄热路径） |
| `sessionIdentityContext` | **12**（T1.2） | 保持窄身份域 |
| `workspaceCatalogContext` | **29**（T1.3） | 保持 catalog 语义 |
| `gitSurfaceContext` | **79**（T1.4） | 与 git panel 同频 |
| `modeRoutingContext` | **6**（T1.5） | 保持窄 mode 路由 |
| `accountSurfaceContext` | **4**（T1.6） | 保持窄 account 面 |
| `dictationSurfaceContext` | **10**（T1.7） | 贴近 composer |
| `workspaceNavigationContext` | **78**（T1.7 自 218，≤80 达标） | ≤ 80 → ~40–60 |
| `composerContext` | 141 | ≤ 60 |
| `layoutContext` | 103 | ≤ 60 |
| `fileEditorContext` | 41 | ≤ 60（已可） |
| `settingsContext` | 147 | ≤ 60 |
| `runtimeContext` | 1 | 保持极窄 |
| `modelSelectionContext` | 14 | 保持窄 |
| `collaborationModeContext` | 15 | 保持窄 |
| **合计** | **690** | 显著下降 + 语义对齐 |

### 0.3 Consumer 读侧（当前锁定）

来源：`APP_SHELL_CONSUMER_DOMAIN_SELECTION`

| Consumer | 路径 | 订购 domains |
|----------|------|--------------|
| **layoutNodes** | `useAppShellLayoutNodesSection.tsx` | **全 15 域**（仍最宽） |
| **sections** | `useAppShellSections.ts` | sessionIdentity, catalog, gitSurface, modeRouting, accountSurface, dictation, navigation, composer, layout, fileEditor, settings（**无** runtimeThread / model / collab / runtime） |
| **render** | `renderAppShell.tsx` | sessionIdentity, catalog, gitSurface, modeRouting, accountSurface, dictation, navigation, composer, layout, fileEditor, settings, runtime（**无** runtimeThread / model / collab） |

> 跨域依赖红线：canvas 热投影不得为了 sidebar/git 便利重新 flatten 进 navigation。

### 0.4 Churn 定义

| 级 | 含义 | 示例 |
|----|------|------|
| **hot** | 流式/回合内高频变化 | `isProcessing`, `activeItems`, live text 相关边界 |
| **mid** | 用户操作级（秒～分钟） | 切 workspace、stage 文件、改 model |
| **cold** | 低频设置/启动 | settings open、doctor、release notes |

---

## 1. 九域总表

| Domain | Key 数 | 语义健康度 | 主 Owner 模块 | 主写路径 | 主读 consumers | Churn | 跨域依赖策略 |
|--------|-------:|------------|--------------|----------|----------------|-------|--------------|
| `runtimeThreadContext` | 10 | **干净** | `useConversationDomainHost` + `activeSessionProjection` + `buildRuntimeThreadDomainContextSlice` | 会话投影 / runtime actions / boundary 组装 | layoutNodes（canvas）；composer 仅需窄信号如 `canInterrupt` | **hot** | **禁止**并回 navigation/settings；无关 zone 不得订全量 items |
| `sessionIdentityContext` | 12 | **干净**（T1.2） | `buildSessionIdentityDomainContextSlice` + workspace/session hosts | workspace/thread select 与 refs 同步 | layoutNodes / sections / render | mid | 可被 composer/runtime **只读**；禁止塞 git/hot items |
| `workspaceCatalogContext` | 29 | **干净**（T1.3） | `buildWorkspaceCatalogDomainContextSlice` + workspace flows / session host | CRUD/group/clone/worktree/fork/repos 列表 | sidebar / home / sections | mid | 不依赖 canvas items；不含 git stage/diff |
| `gitSurfaceContext` | 79 | **干净**（T1.4） | `buildGitSurfaceDomainContextSlice` + git workspace ops section | diff/status/PR/branch/multi-repo ops | git panel / right chrome | mid | 可依赖 sessionIdentity；**禁止**依赖 `activeItems` |
| `modeRoutingContext` | 6 | **干净**（T1.5） | `buildModeRoutingDomainContextSlice` + view state / access mode | appMode/tab/centerMode/accessMode/filePanelMode | top chrome / lazy surfaces | mid | 驱动 lazy；不反灌热会话 |
| `accountSurfaceContext` | 4 | **干净**（T1.6） | `buildAccountSurfaceDomainContextSlice` + account hooks | account 切换 / approvals | settings / chrome | cold–mid | 窄读 |
| `dictationSurfaceContext` | 10 | **干净**（T1.7） | `buildDictationSurfaceDomainContextSlice` | dictation 状态机 | composer 区 | mid | 过渡独立域；勿回灌 navigation |
| `workspaceNavigationContext` | **78** | residual（≤80 达标） | assembly bag residual | residual 混装 | layoutNodes / sections / render | mid | 只减不增；可继续削 engine/debug/layout |
| `composerContext` | 141 | **名不符实**（~117 为 `handle*` 动作总线） | `useComposerDomainHost` + `useAppShellSearchAndComposerSection` + 大量 section handlers | section 产出的 handlers 被字母序灌入 bag | layoutNodes / sections / render | mid | 动作应随业务域走，勿再当「composer 专属」 |
| `layoutContext` | 103 | **混装** | `useAppShellViewStateSection` / kanban host / panel chrome | view state、kanban store、resize handlers | layoutNodes / sections / render | mid–cold | kanban 数据宜 mode 边界；勿绑热会话 |
| `fileEditorContext` | 41 | **中等混装** | `useAppShellEditorLayoutSection` + search palette 相关 | editor tabs/split、search hydration、部分 worktree rename | layoutNodes / sections / render | mid | 可与 layout 合并或保持窄文件域 |
| `settingsContext` | 147 | **混装**（大量 `set*` + threads/workspaces 投影） | 根 settings state + threads bags 投影 | `set*` setters、threadsByWorkspace、workspaces 列表尾段 | layoutNodes / sections / render | mid–cold | threads 全量 map **禁止**进 left/right 无差别订阅（性能红线） |
| `runtimeContext` | 1 | **干净** | `buildRuntimeDomainContextSlice` | `runtimeRunState` | layoutNodes / render | mid | 保持单字段级窄域 |
| `modelSelectionContext` | 14 | **干净** | `useComposerDomainHost` → model section + `buildModelSelectionDomainContextSlice` | model/effort setters & catalog | layoutNodes（composer chrome） | mid | 改 model **不应**必改 navigation bag |
| `collaborationModeContext` | 15 | **干净** | collab mode hooks + `buildCollaborationModeDomainContextSlice` | mode resolve / apply / per-thread maps | layoutNodes | mid | 与 composer host 输入耦合，但 context 独立 |

---

## 2. `workspaceNavigationContext` 子簇（P0-1 拆分指引）

> 本簇为 **计划拆分目标**，T0.1 **不改代码**。  
> 启发式聚类基于 key 名（2026-08-11）；真拆时以 owner map 测试为准微调。

### 2.1 子簇矩阵

| 建议子域 / 簇 | ~Keys | 代表 keys | 目标 Owner | 主写路径 | 主读 | Churn | 计划 Todo | 允许跨域 |
|---------------|------:|-----------|------------|----------|------|-------|-----------|----------|
| **sessionIdentity** | **12（已落地）** | `activeWorkspaceId`, `activeThreadId`, `*Ref`, `activeWorkspace`, `activePath`, `RECENT_THREAD_LIMIT` | `sessionIdentityContext` + `buildSessionIdentityDomainContextSlice` | workspace select / thread select | 几乎全 zone | mid | **T1.2 [x]** | 可被 composer/runtime **只读**消费；写权单一 |
| **workspaceCatalog** | **29（已落地）** | `addWorkspace*`、clone/worktree prompts、groups、`connectWorkspace`、directories、fork*、repositories 列表 | `workspaceCatalogContext` + `buildWorkspaceCatalogDomainContextSlice` | CRUD workspace / group / clone | sidebar、home | mid | **T1.3 [x]** | 不依赖 canvas items |
| **gitSurface** | **79（已落地）** | `activeDiffs`, `gitStatus`, `handleStage*`, PR/issues/log、branches、multi-repo | `gitSurfaceContext` + `buildGitSurfaceDomainContextSlice` | stage/commit/diff refresh | git panel、right chrome | mid | **T1.4 [x]** | 可依赖 sessionIdentity；**禁止**依赖 `activeItems` |
| **modeRouting** | **6（已落地）** | `appMode`, `centerMode`, `activeTab`, `accessMode`, `claudeAccessModeRef`, `filePanelMode` | `modeRoutingContext` + `buildModeRoutingDomainContextSlice` | mode setters | top chrome、lazy surfaces | mid | **T1.5 [x]** | 驱动 lazy，不反灌热会话 |
| **accountSurface** | **4（已落地）** | `accountByWorkspace`, `activeAccount`, `accountSwitching`, `approvals` | `accountSurfaceContext` + `buildAccountSurfaceDomainContextSlice` | switch account / approvals | settings、chrome | cold–mid | **T1.6 [x]** | 窄读 |
| **threadChrome** | ~11 | queue/fuse、rename/delete prompt 入口、`getThreadRows`、completion tracker refs | `useConversationDomainHost` + thread features | thread chrome actions | sidebar thread list | mid | 可并入 session 或 conversation | 可与 runtimeThread 协作，但 items 仍在 runtimeThread |
| **engineDoctor** | ~13 | `activeEngine`, `doctor*`, `engineStatuses`, `commands` | engine / doctor 路径 | refresh engines | settings、composer chrome | cold–mid | residual 或 settings 旁路 | 勿进 hot path |
| **dictation** | **10（已落地 T1.7）** | `dictation*` | `dictationSurfaceContext` + builder | dictation state machine | composer | mid | **T1.7 [x]**（独立域达标 ≤80；远期可并 composer） | 与 send 同区 |
| **debugChrome** | ~8 | `debug*`, `errorToasts`, `alertError` | desktop/debug chrome | debug panel | overlay | cold | residual / layout | 低频 |
| **editorNavLeak** | ~16 | `activeEditor*`, `files`, `fileHistory*`, terminal ensure | `useAppShellEditorLayoutSection` | open file / tabs | center editor | mid | 归 **fileEditor / layout** | 与 git diff 可共享 path，不共享 items |
| **composerLeak** | ~7 | `activeImages`, `composerInputRef`, `attachImages` | composer host | 附件/输入 ref | composer | mid | 归 **composer** 真域 | — |
| **layoutLeak** | ~10 | `collapseSidebar`, `closeSettings`, panel expand | view state / desktop chrome | chrome toggles | shell chrome | mid | 归 **layout** | — |
| **settingsLeak** | ~2 | `appSettings`, `appSettingsLoading` | settings bootstrap | load/save settings | 广读 | cold–mid | 可独立 bootstrap domain 或 settings | 广读但应稳定引用 |
| **miscResidual** | ~18 | prompts CRUD 入口、preset、repo multi 尾部、thinking visible… | 按功能再分 | 各 section | 各异 | mixed | T1.7 压 keys 时消化 | 默认禁止新 key 进入 residual |

### 2.2 新 key 决策树（workspace / shell 相关）

```text
是否会话回合热投影（items/plan/processing/token/turn）？
  ├─ 是 → runtimeThreadContext（builder）
  └─ 否 → 是否 model/effort/catalog？
        ├─ 是 → modelSelectionContext
        └─ 否 → 是否 collab mode？
              ├─ 是 → collaborationModeContext
              └─ 否 → 是否 git diff/status/PR/stage？
                    ├─ 是 → 目标 gitSurface（过渡：navigation 仅临时，PR 注明）
                    └─ 否 → session id / workspace 列表 / mode / account / …
                          → 对应 §2.1 子簇；禁止无主塞入 navigation 尾部
```

---

## 3. 其它「名不符实」域的语义重标

### 3.1 `composerContext`（141，约 117 `handle*`）

| 语义簇 | 代表 | 真实 Owner | 建议归宿 |
|--------|------|------------|----------|
| Composer send / draft / interrupt | `handleSend*`, `handleUserInputSubmit*`, `interruptTurn` | `useAppShellSearchAndComposerSection` + composer host | 保留 composer 真域 |
| Git handlers | `handleStageGit*`, `handleCommit*`, `handlePush` | `useAppShellGitWorkspaceOpsSection` | **gitSurface** |
| Workspace / window | `handleAddWorkspace*`, `handleDropWorkspacePaths` | workspace flows | **workspaceCatalog** |
| Thread chrome handlers | `handleCopyThread`, `handleRename*`, delete prompt | conversation host | session/conversation |
| File tabs | `handleOpenFile`, `handleCloseFileTab*` | editor layout | fileEditor/layout |
| Search palette flags | `isSearchPaletteOpen` | search palette section | search 边界（冷） |
| 杂 flags | `isCompact`, `isPhone`, `hasLoaded`… | 多源 | 按 churn 拆；勿因字母序留下 |

### 3.2 `layoutContext`（103）

| 语义簇 | 代表 | Owner | Churn |
|--------|------|-------|-------|
| Kanban | `kanban*`, `scoped` 相关在 fileEditor | `useKanbanDomainHost` | mid（surface 外仍可能跑 execution） |
| Chrome / resize | `onSidebarResizeStart`, panel widths 相关在 settings | view state / desktop chrome | mid |
| Thread list ops | `listThreads*`, `loadOlderThreads*`, `navigateToThread` | threads features | mid |
| Transparency / window | `reduceTransparency`, `windowOpacity` | desktop chrome | cold |
| Plan panel | `openPlanPanel`, `planPanelHeight`, `planByThread` | plan UI | mid（plan 数据与 runtime plan 区分） |

### 3.3 `fileEditorContext`（41）

| 语义簇 | 代表 | Owner |
|--------|------|-------|
| Editor / tabs | open tabs、split、maximize 多在 layout/settings | editor layout section |
| Search palette | `searchPalette*`, `searchResults`, hydration | `useAppShellSearchPaletteSection` / radar |
| Selection pointers | `selectedDiffPath`, `selectedPullRequest`, `selectedAgent` | git / agent / composer 边界 |
| Worktree rename residual | `renameWorktreeUpstream*` | worktree chrome |

### 3.4 `settingsContext`（147）

| 语义簇 | 代表 | 风险 |
|--------|------|------|
| Setters 总线 | `setActiveThreadId`, `setAppMode`, `setCenterMode`… | 写入口集中但与 ownership 分散矛盾 |
| Threads 投影 | `threadsByWorkspace`, `threadStatusById`, `threadItemsByThread`, history* | **性能红线**：全量 status/items 不得无差别进 left/right |
| Workspaces 尾段 | `workspaces`, `workspacesById`, `workspaceGroups` | 与 catalog 重复归属风险 |
| Settings UI | `settingsOpen`, `settingsSection`, `openSettings` | cold–mid |
| Terminal state | `terminalOpen`, `terminalTabs`, `terminalState` | mid |
| Session radar | `sessionRadar*`, running counts | mid（后台 agent；遵守 A1–A4） |
| Skills / start* CLI | `startMcp`, `startLsp`, … | cold |

---

## 4. Host / Section 所有权索引（写路径）

| 模块 | 类型 | 主要产出 / 职责 | 主要落入 domain（现状） |
|------|------|-----------------|------------------------|
| `useWorkspaceSessionHost` | domain host | workspace 列表/分组/连接 + home 投影 | navigation + settings 尾段 |
| `useComposerDomainHost` | domain host | composer selection、model、agent、plan-apply | modelSelection + composer 部分 + collab 输入 |
| `useConversationDomainHost` | domain host | `runtimeThreadBoundary`、thread chrome、copy/rename/delete | runtimeThread + navigation threadChrome |
| `useKanbanDomainHost` / `useModeDomainHosts` | domain host | appMode surface flags + kanban store | layout（kanban*）+ mode flags |
| `useActiveSessionProjection` | projection | isProcessing / activeItems / plan / tokens… | **runtimeThread** |
| `useAppShellGitWorkspaceOpsSection` | section | git stage/commit/diff/PR/repo | navigation gitSurface + composer git handlers |
| `useAppShellViewStateSection` | section | mode/tab/panel/layout chrome state | layout + settings setters + navigation mode |
| `useAppShellSearchAndComposerSection` | section | send、draft、search 联动 | composer |
| `useAppShellWorkspaceFlowsSection` | section | workspace 创建/拖放/路径 intake | navigation catalog |
| `useAppShellWorktreeChromeSection` | section | worktree prompts/apply | navigation catalog / fileEditor residual |
| `useAppShellEditorLayoutSection` | section | editor tabs/split/file open | fileEditor + navigation editor leak |
| `useAppShellPromptActionsSection` | section | prompts CRUD | navigation residual + settings |
| `useAppShellAccessModeSection` | section | access mode | navigation modeRouting |
| `useAppShellDesktopChrome` | section | 桌面窗体/透明等 | layout / settings |
| `useAppShellQuickSwitcherSection` | section | quick switcher | navigation / layout 读 |
| `useAppShellSearchPaletteSection` / SearchRadar | section | palette + radar | fileEditor search + settings radar |
| `useAppShellKanbanExecutionSection` | section | kanban 执行（可后台） | layout kanban；须保持非 eager 根重依赖 |
| `build*DomainContextSlice` | pure builders | 干净域组装 | runtimeThread / model / collab / runtime |
| `defineAppShellDomainContexts` + `reuseStable*` | contract | owner map 校验 + shallow reuse | 全部 |

---

## 5. 跨域依赖 DAG（允许方向）

```text
sessionIdentity ──────────────► composer（只读 id）
       │                      ► runtimeThread（只读 id）
       │                      ► gitSurface（只读 workspace path/root）
       ▼
workspaceCatalog              modeRouting ──► lazy feature surfaces
       │                           │
       └──────────► layout chrome ◄┘
                         │
modelSelection ◄── composer host
collaborationMode ◄── composer host / thread id
runtimeThread ──► canvas / interrupt 窄信号
gitSurface ──► git panel only（不驱动 canvas items）
settings bootstrap ──► 广读但应稳定
```

**禁止环 / 禁止依赖**：

1. `workspaceNavigation` ← 回灌 `activeItems` / `isProcessing`（已迁出，禁止回潮）  
2. left sidebar / top chrome ← 全量 `threadItemsByThread` 或全量 `threadStatusById` 作为 props 总线  
3. gitSurface ← runtime hot items  
4. 新 full-flatten consumer（见 P0-2 / P1-5）

---

## 6. 决策速查：「这个新 key 进哪？」

| 场景 | 进入 | 不要进入 |
|------|------|----------|
| 流式消息 / 回合 processing / token / plan 投影 | `runtimeThreadContext` | navigation / settings |
| 选 model / effort / catalog refresh | `modelSelectionContext` | navigation / composer 字母序尾 |
| collab mode id / per-thread mode maps | `collaborationModeContext` | navigation |
| `runtimeRunState` | `runtimeContext` | 其它 |
| workspaceId / threadId / refs | 目标 **sessionIdentity**（过渡 navigation） | composer bag 复制一份真源 |
| workspaces 列表 CRUD | 目标 **workspaceCatalog** | layout |
| git stage/diff/PR | 目标 **gitSurface** | runtimeThread |
| appMode / centerMode / tab | 目标 **modeRouting** | runtimeThread |
| account switch | 目标 **accountSurface** | git |
| composer send handler | composer 真语义区 | navigation |
| settings 面板 open/section | settings UI 簇 | hot path domains |
| kanban task CRUD | kanban host → layout 过渡 | navigation 再堆 |

---

## 7. 与后续 Todo 的映射

| Todo | 矩阵用法 |
|------|----------|
| T0.2 重采基线 | 更新 §0.2 计数与计划 §1.1 |
| T1.1 assembly | 按域 builder/host 组装，根不再内联 700 行 |
| T1.2–T1.6 | 严格按 §2.1 子簇迁 key + 更新 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` |
| T1.7 navigation ≤ 80 | §2.1 迁出 git/catalog/identity/mode 后验收 |
| T2.x Provider | hot=`runtimeThread`，mid=`composer`/`model`，cold=`layout` chrome |
| T5.x 门禁 | 无主 key / 超预算对照本矩阵 |

---

## 8. 维护规则

1. **改 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 时**：同步改本矩阵计数与子簇（同 PR 或紧随计划 Log）。  
2. **新增 domain**：先更新本矩阵 + 计划，再改代码。  
3. **不要**把本文件当运行时 contract；运行时仍以 `appShellDomainContexts.ts` 与测试为准。  
4. 启发式子簇 key 列表非穷尽锁定；真拆以测试与 consumer 编译为准。

---

## 9. 验收（T0.1）

- [x] 9 domains 均有 owner / 读写 / churn / 跨域策略  
- [x] `workspaceNavigation` 具备可执行子簇拆分指引（对齐 T1.2–T1.6）  
- [x] 决策树可回答：git stage key、composer model key、isProcessing 类 key 各进哪  
- [x] 无业务代码变更（仅文档）
