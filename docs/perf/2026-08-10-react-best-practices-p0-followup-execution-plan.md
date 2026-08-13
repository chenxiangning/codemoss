---
type: plan
status: active
---

# React Best Practices 性能 P0 后续执行计划

> **读者**：接手性能后续工作的人（人或 AI）  
> **日期**：2026-08-10  
> **分支参考**：`bump-version-0.8.7`（以执行时 `git status` / `HEAD` 为准）  
> **已落地基线 commit**：`881379a80`（P0 首批：sidebar memo / blank watchdog / streaming collapse / CSS contain / lazy AppShell / extensions CSS 懒加载）  
> **关联 skill**：`.agents/skills/vercel-react-best-practices/`  
> **关联实验**：`docs/perf/render-jank-knife-experiments-2026-07-08.md`（四层根因；层 4 单价未做完）  
> **产品硬约束（禁止擅自反转）**：见文末「禁止清单」

本文是 **可执行 backlog**，不是历史 measurement。任何数值都必须重新采样；不得把本文里的「预期收益」当成已验收 KPI。

---

## 0. 当前状态（执行前必读）

### 0.1 已完成（P0 首批，`881379a80`）

| 编号 | 类别 | 改动摘要 | 关键路径 |
|------|------|----------|---------|
| P0-1a | 根渲染单价 | `sidebarNode` 稳定 `useMemo`，降低 `AppLayout` memo 失效 | `src/features/layout/hooks/useLayoutNodes.tsx` |
| P0-1b | 主线程噪音 | blank watchdog 默认 5s；`maxReports` 后 **停表** | `src/services/rendererDiagnostics.ts` |
| P0-2a | 流式行成本 | 流式折叠阈值 20k → **8k**（不裁列表） | `src/features/messages/rows/components/MessageRow.tsx` |
| P0-2b | 渲染隔离 | `.message { contain: layout style }`（**无** content-visibility） | `src/styles/messages.part1.css` |
| P0-3a | Bundle | `AppShell` 改为 `lazy()` | `src/router.tsx` |
| P0-3b | 启动 CSS | extensions / tokentracker CSS 移出 bootstrap，进 feature loader | `src/bootstrap.ts`、`src/styles/featureStyleLoaders.ts`、`src/features/extensions/components/ExtensionsView.tsx` |

### 0.2 未完成（本文后续阶段）

| 阶段 | 名称 | 目标 | 预估 |
|------|------|------|------|
| **S0** | 验收与证据 | 对首批 P0 做人工 + 脚本验收，固化 evidence | 0.5–1 天 |
| **S1** | 根链 memo 补全 | `composerNode` / `homeNode` 等同路径稳定化 | 0.5–1 天 |
| **S2** | Bundle 实测与再拆 | build + budget 对账；必要时再拆启动依赖 | 0.5–1 天 |
| **S3** | 按 `appMode` 条件挂载 | 非对话模式少跑无关根 hook | 1–2 天 |
| **S4** | AppShell 分域结构手术 | 治层 4 单价（多 PR） | 多天 / 多 PR |
| **S5** | 长对话 DOM 成本（可选） | 在 **不破坏 stick** 前提下再压长会话 | 按需 |

### 0.3 执行原则

1. **PlanFirst**：每阶段动手前写清目标、改动文件、验收命令；跨层 contract 走 OpenSpec。  
2. **禁止主动 commit**；展示摘要后，用户字面授权「提交」才能 `git commit`。  
3. **测量时关 react-scan**（2–3x 放大器）；需要归因再开。  
4. **不逆产品决策**：不擅自恢复时间线虚拟化 / content-visibility / 流式尾窗 / 对话级 lightweight 摘要墙。  
5. **小步可测**：每阶段独立可验收；禁止把 S1–S4 混成一个巨型 PR。

---

## S0 — 验收与证据（优先执行）

### 目标

证明 `881379a80` 首批 P0 **可接受、无回归**；产出带 timestamp 的 evidence，供后续对比。

### 人工验收清单

| # | 场景 | 通过标准 |
|---|------|----------|
| M1 | 冷启动主窗 | 能进 shell；无明显白屏死锁；StartupGate 行为与改前一致 |
| M2 | about / detached 窗 | 能打开；不误挂完整业务态（lazy 边界生效） |
| M3 | 前台 Claude 长流式（建议 >12k 中文） | 约 8k 后更早 lightweight；**钉底仍稳**；无「卡中部」 |
| M4 | 回合结束 idle 长历史 | 全量列表仍在；滚动无明显跳变 |
| M5 | 首次打开 Extensions | 可短暂空白（样式懒加载），随后布局正常；无永久 FOUC |
| M6 | 后台 Agent + 关对话 | 不应回到「关对话还全树风暴」（A1–A4 红线） |

### 命令验收

在仓库根目录执行（路径含空格时注意引号）：

```bash
# 1) 回归首批相关单测
npx vitest run \
  src/router.test.tsx \
  src/bootstrapApp.test.tsx \
  src/services/rendererDiagnostics.test.ts \
  src/styles/messages-context-stack.test.ts \
  src/features/messages/components/MessagesRows.stream-mitigation.test.tsx \
  src/app-shell.startup.test.tsx

# 2) 类型与 lint（按需；大仓可只扫变更文件）
npm run typecheck
npx eslint src/router.tsx src/bootstrap.ts \
  src/features/layout/hooks/useLayoutNodes.tsx \
  src/features/messages/rows/components/MessageRow.tsx \
  src/services/rendererDiagnostics.ts \
  src/features/extensions/components/ExtensionsView.tsx \
  src/styles/featureStyleLoaders.ts

# 3) 体感开发（测量时不要用 scan）
npm run tauri:dev

# 4) 需要归因时再开（记得写明 react-scan 放大）
npm run tauri:dev:scan
```

### 可选：写 evidence 目录

```bash
mkdir -p .artifacts/perf/p0-followup-$(date +%Y%m%d)
# 将：手工验收勾选、FPS/卡顿主观、关键日志、commit hash 写入该目录
# 不要把一次性报告写回 docs/perf 根目录冒充 baseline
```

### S0 完成定义

- [ ] M1–M6 人工勾选通过  
- [ ] 相关 vitest 全绿  
- [ ] 若发现问题：先记 repro → 开 fix 分支 → **不要**直接进入 S4 大拆  

---

## S1 — 根链 memo 补全（下一刀代码）

### 目标

把 `useLayoutNodes` 里与 `sidebarNode` 同构的 **高频 ReactNode** 稳定住，让 `AppLayout`（已 `memo`）在 props 未变时真正 early-return。

### 问题根因（为什么要做）

`AppLayout` 对 `ReactNode` props 做 `Object.is` 比较。每次 `useLayoutNodes` 返回**新元素身份** → 即使子组件 `memo` 了，`AppLayout` 仍会 re-render，触发 DesktopLayout / 样式协调等层 4 成本。

### 候选节点（按 ROI）

| 优先级 | 节点 | 文件位置（约） | 备注 |
|--------|------|----------------|------|
| P1 | `composerNode` | `useLayoutNodes.tsx`（`renderComposerNode` 调用处） | 输入路径极热；deps 多，要仔细 |
| P1 | `homeNode` | 同文件 | Home 场景；依赖 `homeComposerNode` 时一并稳定 |
| P2 | `mainHeaderNode` / `desktopTopbarLeftNode` | 同文件 | 中频 |
| P2 | `errorToastsNode` / `updateToastNode` | 同文件 | 若已轻量可后置 |
| P3 | `gitDiffPanelNode` 等重面板 | 已有条件挂载则优先检查引用稳定性 | 与 S3 协同 |

### 实施步骤

1. **读现状**  
   - `src/features/layout/hooks/useLayoutNodes.tsx`  
   - 对照已落地的 `sidebarNode = useMemo(...)` 模式  
   - 确认 `AppLayout` / `DesktopLayout` 的 memo 边界  
2. **先 composer，后 home**（一次一个，便于归因）  
3. **deps 规则**  
   - 所有传入 JSX 的 props / 回调必须进 deps  
   - 禁止漏依赖导致「UI 不更新」  
   - 禁止把高频心跳/计时字段塞进 deps（参考 messagesNode 已去掉 heartbeat 的注释）  
4. **回调稳定化优先**  
   - 若某 callback 每次新引用，先 `useCallback` / `useEventCallback`，再 memo 节点  
5. **测试**  
   - 现有 layout / app-shell / composer 相关测试  
   - 手工：输入框键入、发送、切换会话、Home 进出  

### 建议测试命令

```bash
npx vitest run src/app-shell.startup.test.tsx
# 若有更贴近 layout/composer 的测试，补跑：
npx vitest run src/features/composer --passWithNoTests
npx vitest run src/features/layout --passWithNoTests
```

### S1 验收

- [ ] `composerNode` 在无关根 state 变化时引用保持稳定（可用临时 debug 计数或 React Profiler 对比）  
- [ ] 输入路径无「卡一拍」、无 stale props  
- [ ] Home 进出正常  
- [ ] 无新增 lint/type 错误  

### 风险与回滚

| 风险 | 缓解 |
|------|------|
| deps 漏项 → UI 不刷新 | 先小范围；关键交互清单回归 |
| deps 过宽 → memo 永远失效 | 用 Profiler 看是否仍每 tick rebuild |
| 与 StrictMode 双调用混淆 | 只看 commit 次数 / Profiler actualDuration |

回滚：还原对应 `useMemo` 块即可，独立 commit 方便 `git revert`。

---

## S2 — Bundle 实测与再拆

### 目标

用 **当前 HEAD** 的 build 产物验证 P0-3 是否把 `App-*.js` gzip 压到 budget 内；不够再拆。

### 步骤

```bash
# 1) 生产构建
npm run build

# 2) chunk / budget 检查（advisory/hard 以 scripts 配置为准）
npm run check:bundle-chunking

# 3) 手工看 gzip（示例）
python3 - <<'PY'
import os, gzip, glob
for p in sorted(glob.glob("dist/assets/App-*.js")):
    raw = os.path.getsize(p)
    with open(p, "rb") as f:
        g = len(gzip.compress(f.read(), 9))
    print(f"{os.path.basename(p)} raw={raw/1024:.0f}KiB gzip={g/1024:.0f}KiB")
PY
```

### Budget 参考（`scripts/bundle-budget.config.json`，执行时以文件为准）

| group | 历史 target / hardFail（gzip） | 说明 |
|-------|--------------------------------|------|
| `app-js` | 950_000 / 1_100_000 | 启动 App JS |
| `app-css` | 180_000 / 220_000 | 启动 App CSS |
| `total-js-mjs-css` | 4_800_000 / 5_300_000 | 全量 |

> 2026-08 审计时 dist 曾见 `App-*.js` ≈ **1062 KiB gzip**（超 target、近 hardFail）。必须以本次 `npm run build` 重测。

### 若仍超 target：再拆候选

| 优先级 | 动作 | 注意 |
|--------|------|------|
| 1 | 分析 App chunk top modules（rollup visualizer / source-map-explorer） | 先证据后拆 |
| 2 | 检查是否误把 markdown / project-map / settings 拉进启动图 | 对照 `vite.config.ts` `manualChunks` |
| 3 | 更多 `lazyViews` / route 级 lazy | 已有 Settings/Kanban/SpecHub 模式 |
| 4 | bootstrap 继续 defer 非首屏 CSS（multi-agent 等需评估 FOUC） | 聊天路径依赖的 CSS 勿盲目挪 |
| 5 | 考虑把 `app-js` budget 从 advisory 升 gate（团队共识后） | 需 CI 配合 |

### S2 验收

- [ ] 记录：commit、构建时间、`App-*.js` gzip、是否过 target  
- [ ] evidence 写入 `.artifacts/perf/...`，**不要**伪造 docs 根 baseline  
- [ ] 若超 hardFail：阻塞发版讨论；至少开 follow-up issue  

---

## S3 — 按 `appMode` 条件挂载（中等难度）

### 目标

减少 **非当前模式** 仍在 AppShell 根上运行的 hook / 订阅 / 节点构建。

### 调研步骤（先读后改）

1. `src/app-shell.tsx`：列出所有 `useXxx` 与 `appMode` / `centerMode` 的关系  
2. `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`、`useAppShellSections.ts`  
3. `renderAppShell.tsx`：已有 `showKanban` / `showExtensions` 条件 JSX — **对照 hook 层是否仍无条件执行**  
4. 找出「仅 gitHistory / kanban / extensions 需要，但 chat 模式仍跑」的订阅  

### 安全改造模式

```text
// 伪代码：仅在模式需要时启用重逻辑
const kanbanEnabled = appMode === "kanban";
useKanbanStore({ enabled: kanbanEnabled }); // 若 hook 支持
// 或拆子组件：{kanbanEnabled ? <KanbanRuntimeHost /> : null}
```

### 优先候选（执行时再证据确认）

| 候选 | 为何 |
|------|------|
| Kanban store / 执行 section | 非看板模式常驻成本 |
| Git history 相关重型 controller | 非 gitHistory 模式 |
| Extensions / TokenTracker 数据拉起 | 已 lazy 视图，检查是否仍有根预热 |
| Search radar 高频订阅 | 若仅搜索打开时需要 |

### 红线

- **不要**为省性能关掉 chat 模式必需的 threads / live channel / 安全恢复路径  
- **不要**违反 AGENTS 根链红线：  
  - 高频 setState 禁挂根 hook 链  
  - 数组 append 型 setState 禁入根链  
  - store：事件驱动 + ≥30s 兜底  
  - 流式正文走 `liveAssistantTextChannel`  

### S3 验收

- [ ] chat-only 场景 Profiler：无关 domain 更新次数下降  
- [ ] 切到 kanban/git/extensions 功能完整  
- [ ] 无「进模式才挂载」导致的白屏/丢事件（尤其是后台任务）  

### 建议证据

```bash
# 长跑可选（需 Tauri 已开）
OUTPUT_DIR=.artifacts/perf/jank bash scripts/perf-reproduce-jank.sh
```

---

## S4 — AppShell 分域结构手术（层 4 主战场）

### 目标

把「单次合法根渲染 100–350ms」压到可接受区间（历史目标量级 **&lt;30ms 端到端**；以新采样为准）。

### 现状锚点

- `src/app-shell.tsx` ≈ 2500 行级编排  
- Domain context 体量（执行时以代码为准）：  
  - `workspaceNavigationContext` 约 200+ keys  
  - `composerContext` / `settingsContext` / `layoutContext` 亦百级  
- 已有 `reuseStableAppShellDomainContexts` 浅比较；**单价仍高**  
- 仓库已有规划向任务：`04-22-split-app-shell-orchestration`（planning）

### 推荐拆分策略（多 PR）

| PR | 主题 | 产出 |
|----|------|------|
| PR-A | 只读架构图：根 hook 列表、context 读侧矩阵、更新源矩阵 | design / OpenSpec 初稿 |
| PR-B | 抽出 **纯数据 host**（无 UI）：例如 WorkspaceSessionHost | 可单测；主壳变薄 |
| PR-C | Composer 域下沉：context 只暴露 composer 需要的字段 | 输入路径与根解耦 |
| PR-D | Messages/Conversation 域下沉 | 与 live channel 边界对齐 |
| PR-E | Settings/Git/Kanban 模式 host 条件挂载 | 与 S3 合流 |
| PR-F | 删除/收窄 legacy flat context 与 200+ key bag | 防止回潮 |

### 每 PR 强制门禁

1. OpenSpec change（若行为/contract 变）  
2. 启动相关测试 + 关键手工路径  
3. Profiler 对比：**回合进行中** / **空闲** / **后台 Agent** 三场景  
4. 禁止整文件 `--ours/--theirs` 合并高风险文件（AGENTS Merge Guardrails）

### 测量方法（层 4）

1. Safari Web Inspector / Chromium Performance：录「回合进行中」  
2. 区分：React commit vs style/layout vs passive effects  
3. 可选：临时恢复实验探针（见 `render-jank-knife-experiments` §七），测完删除  
4. **测量前关 react-scan**

### S4 完成定义

- [ ] AppShell 主文件职责收敛到「装配」，不再堆业务 hook 森林  
- [ ] context 按读侧拆分；单域更新不扇出到无关树  
- [ ] 新采样：合法根更新时主线程长帧显著下降（与 S0 证据对比）  
- [ ] 文档：更新 `docs/perf` 导航或 OpenSpec archive 说明  

---

## S5 — 长对话 DOM 成本（可选，产品敏感）

> 仅在 S0–S4 后仍有「长历史 idle 卡顿」主诉时启动。

### 允许的方向

| 方向 | 说明 |
|------|------|
| 重行 deferred hydration（**块级**「显示详情」） | 产品注释曾保留块级详情；与「对话级摘要墙」不同 |
| 流式期更激进的 **行内** lightweight（不裁列表） | 沿 MessageRow / markdown 路径调参 |
| 大 tool output / diff 折叠默认更深 | 需 UX 确认 |
| idle 分档渲染（先摘要后 hydrate） | 必须做 scroll regression |

### 禁止的方向（默认）

| 禁止 | 原因 |
|------|------|
| 恢复 `STREAMING_VISIBLE_WINDOW > 0` | idle 瞬间高度暴涨 vs stick 冲突；测试已锁 `<=0` |
| 恢复时间线 TanStack Virtual | 与 stick-to-bottom 抢 scrollTop |
| 恢复 `content-visibility: auto` 于 message 行 | 占位→真高跳底（jetbrains 事故） |
| 恢复对话级 lightweight 摘要墙 | 统一幕布已下线 |

若产品明确改策略，必须先改 OpenSpec / analysis 文档与契约测试，再动代码。

---

## 建议执行顺序（甘特式）

```text
S0 验收证据 ────────┐
                    ├─► S1 composer/home memo ──► S2 bundle 实测
                    │                              │
                    │                              ├─ 未达标 → 再拆启动依赖
                    │                              └─ 达标 → 记 evidence
                    │
                    └─► S3 appMode 条件挂载 ──► S4 AppShell 分域（多 PR）
                                              │
                                              └─ 仍有长历史主诉 → S5（可选）
```

**推荐默认路径**：`S0 → S1 → S2 → S3 → S4`。  
**不要**跳过 S0 直接上 S4。

---

## 每阶段通用检查单

### 开发前

- [ ] `git status` 干净或已知  
- [ ] 读本文对应阶段 + `AGENTS.md` 相关 Gate  
- [ ] 前端改动：`.trellis/spec/frontend/index.md` 按需  
- [ ] 明确「不做什么」  

### 开发中

- [ ] 小步提交意图清晰（仍需用户授权才 commit）  
- [ ] 不扩大 diff 到无关重构  
- [ ] 新行为有测试或明确手工矩阵  

### 开发后

- [ ] 目标测试绿  
- [ ] 相关 typecheck/lint  
- [ ] 展示变更摘要；等待用户「提交」  
- [ ] 成功 commit 后 Trellis session record（除非用户跳过）  

---

## 命令速查

```bash
# 开发
npm run tauri:dev
npm run tauri:dev:scan          # 仅归因

# 测试
npx vitest run <paths>
npm run test                    # 全量较慢

# 性能脚本（按需）
npm run perf:long-list:baseline
npm run perf:composer:baseline
npm run perf:realtime:extended-baseline
npm run perf:baseline:all
OUTPUT_DIR=.artifacts/perf/jank bash scripts/perf-reproduce-jank.sh

# Bundle
npm run build
npm run check:bundle-chunking
```

---

## 禁止清单（硬）

1. **不**恢复对话时间线虚拟化 / content-visibility / 流式尾窗（除非产品书面改策略 + 契约测试更新）。  
2. **不**把高频事件、数组 append setState 挂回 AppShell 根链。  
3. **不**用秒级轮询刷新挂在根上的 store（事件驱动 + ≥30s 兜底）。  
4. **不**让流式正文 delta 重新打 threads reducer 打根（走 `liveAssistantTextChannel`）。  
5. **不**在未授权时 `git commit` / `git push` / 改写历史。  
6. **不**把一次性采样回填进 historical baseline 文档冒充 current。  
7. **不**对高风险业务文件整文件 `--ours` / `--theirs`。  

---

## 相关文档索引

| 文档 | 用途 |
|------|------|
| `docs/perf/render-jank-knife-experiments-2026-07-08.md` | 四层根因与 A1–A4 / 层 4 |
| `docs/perf/a4-live-text-externalization-plan.md` | live text 旁路 |
| `docs/perf/streaming-render-stall-design-2026-07-30.md` | 流式 stall 机制（已实现部分） |
| `docs/perf/parallel-conversation-jank-handbook.md` | 并行对话 residual 诊断 |
| `docs/analysis/conversation-canvas-structure-2026-07-31.md` | 幕布结构与性能旋钮事实 |
| `docs/plans/2026-08-01-unified-conversation-canvas-architecture.md` | 统一幕布（摘要墙下线） |
| `.agents/skills/vercel-react-best-practices/` | React 性能规则目录 |
| `scripts/bundle-budget.config.json` | bundle 预算 |

---

## 变更日志

| 日期 | 说明 |
|------|------|
| 2026-08-10 | 初版：基于 React best practices 审计 + P0 首批落地后的后续执行计划 |

---

## 给执行者的一页纸 TL;DR

1. **先 S0 验收** `881379a80`，别急着大拆。  
2. **下一刀代码 = S1**：`composerNode` / `homeNode` 稳定 memo。  
3. **S2 用 build 数字说话**，别猜 bundle。  
4. **S3 砍非当前模式根成本**，再上 **S4 AppShell 分域**。  
5. **S5 长列表**只在仍有主诉且不破坏 stick 时做。  
6. 全程遵守 **产品禁止清单** 与 **Git 提交授权**。  
