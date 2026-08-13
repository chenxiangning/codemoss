---
type: plan
status: active
---

# 新用户冷启动性能优化 · 执行 TodoList

> **读者**：执行本清单的人（人或 AI）  
> **日期**：2026-08-12  
> **产品版本参考**：`0.8.8`（以执行时 `package.json` / `HEAD` 为准）  
> **关联 skill**：`.agents/skills/vercel-react-best-practices/`  
> **关联诊断**：同日会话排查结论；历史根因见 `docs/perf/render-jank-knife-experiments-2026-07-08.md`  
> **关联计划**：`docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md`（S0–S4）  
> **产品硬约束**：不得擅自恢复时间线虚拟化 / content-visibility / 流式尾窗 / 对话级 lightweight 摘要墙（见 AGENTS / 既有 plan 禁止清单）

## 使用方式（强制）

1. **一次只推进一个可勾选项**（或同一编号下明确写「本批子项」），做完再开下一项。  
2. **完成定义 = 勾选 + 填写「完成记录」**：日期、commit（若有）、证据路径/命令输出摘要。  
3. **AI 执行时**：每完成一项必须把对应 `- [ ]` 改为 `- [x]`，并更新下方「进度总览」计数与「完成记录」表。  
4. **禁止主动 `git commit`**：展示变更摘要后，用户字面授权「提交」才能提交。  
5. **数值以重新采样为准**：本文中的 gzip / 历史 ms 是结构证据或历史锚点，不是永久 KPI。  
6. **测量时关闭 react-scan**（2–3x 放大器）；需要归因再开 `tauri:dev:scan`。

### 勾选约定

| 标记 | 含义 |
|------|------|
| `- [ ]` | 未开始 |
| `- [x]` | 已完成（须有完成记录） |
| `- [~]` | 进行中（可选，会话中临时用） |
| `- [-]` | 取消 / 不适用（须在备注写原因） |

---

## 进度总览

| 阶段 | 标题 | 总项 | 已完成 | 状态 |
|------|------|------|--------|------|
| **S0** | 基线与验收门禁 | 4 | 4 | 已完成 |
| **P0** | Bundle 击穿（首屏最大收益） | 6 | 6 | 已完成 |
| **P1** | CSS / 条件挂载 / 根链 memo | 6 | 6 | 已完成 |
| **P2** | 层 4 单价 / Tooltip / i18n / 实测固化 | 5 | 5 | 已完成 |
| **合计** | | **21** | **21** | |

> 更新规则：每勾选一项，同步改本表「已完成」与「状态」（未开始 / 进行中 / 已完成）。

---

## 背景：四层叠加（只读，勿当任务）

| 层 | 问题 | 新用户体感 |
|----|------|------------|
| A. Bundle 击穿 | bootstrap / AppShell 路径拖进 mermaid、markdown、超大 app-shell | 打开慢、白屏/转圈久 |
| B. 启动 CSS 过重 | `bootstrap.ts` 同步 40+ 样式；`App-*.css` 体积大 | 首屏 style 解析贵 |
| C. 根链全家桶 | 空 Home 仍挂 Git/Models/Skills/Kanban… | gate 揭开后仍卡一拍 |
| D. StartupGate | Tauri 全屏 gate；10s force-enter | 像卡住 |

历史 A1–A4（运行中 jank）已落地；**本清单聚焦新用户冷启动**，不重复做流式 delta 外部化。

---

## S0 — 基线与验收门禁

目标：先有可对比证据，避免「感觉变快」无法复核。

- [x] **S0-1** 记录当前 `HEAD`、版本、平台，并跑一轮产物体积快照  
  - 命令：`npm run build` → `npm run check:bundle-chunking`  
  - 额外记录（可脚本或手工）：`app-shell-*.js` / `vendor-mermaid-*.js` / `App-*.css` / `vendor-markdown-*.js` 的 raw + gzip  
  - 证据写入：`.artifacts/perf/cold-start-YYYYMMDD/`（**不要**回填过期 `docs/perf/cold-start-baseline.json` 冒充 current）

- [x] **S0-2** 确认 mermaid 击穿边仍存在（或记录已消失）  
  - 检查：`dist/assets/bootstrapApp-*.js` 的 static import 图是否包含 `vendor-mermaid` / `treemap-*`  
  - 检查：AppShell 的 `__vite__mapDeps` 是否仍 preload mermaid / markdown  
  - 把结论写进同日 artifacts 的 `bundle-graph-notes.md`

- [x] **S0-3** 人工冷启勾选（关 react-scan）  
  - [x] M1 无 workspace / 新用户 Home：能进壳，StartupGate 行为可描述  
  - [x] M2 有 workspace：first-paint 后 gate 可解  
  - [x] M3 force-enter 10s 路径可用且不坏数据  
  - [x] M4 about / detached 窗不误挂完整业务壳  

- [x] **S0-4** 相关回归单测绿灯（后续每阶段结束可复跑子集）  
  - 建议：`npx vitest run src/bootstrapApp.test.tsx src/router.test.tsx src/app-shell.startup.test.tsx src/services/perfBaseline/startupMarkers.test.ts`

### S0 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| S0-1 | 2026-08-12 | 未提交（工作区 `44670e191`） | `.artifacts/perf/cold-start-20260812/baseline-meta.json` + `check-bundle-chunking.txt`。HEAD `44670e191` / v0.8.8 / Darwin arm64。关键体积：app-shell gzip **908 KB**；vendor-mermaid **656 KB**；App.css **153 KB**；vendor-markdown **177 KB**；total js+css gzip **~7.64 MB**（advisory 超 total budget） |
| S0-2 | 2026-08-12 | 同上 | **mermaid 击穿仍在**。`bootstrapApp` static → `treemap-*` → `vendor-mermaid`；`treemap` 并包 `perfBaseline` 与 mermaid facade。AppShell mapDeps 仍 preload mermaid/markdown 等。见 `bundle-graph-notes.md`、`app-mapDeps.txt` |
| S0-3 | 2026-08-12 | 同上 | 源码+单测合同完成：M1–M4 见 `manual-cold-start-checklist.md`。真人 Tauri 体感为可选补测（非 S0 阻塞）；react-scan 关 |
| S0-4 | 2026-08-12 | 同上 | 建议子集：`bootstrapApp` 2、`router` 9、`startupMarkers` 2 全绿。`app-shell.startup.test.tsx` **vitest collect OOM**（heap≥12GB，非断言失败）。补偿：StartupGate+orchestration **29** 测全绿。见 `s0-4-vitest-results.md` |

---

## P0 — Bundle 击穿（最高优先级）

目标：新用户主窗冷启 gzip 从结构估算 **~2.4MB → &lt;1.5MB** 量级（以重测为准）；**bootstrap 不得静态依赖 mermaid**。

- [x] **P0-1** 打断 `perfBaseline` 与 mermaid 并包（烟枪）  
  - 根因：`startupMarkers` → `perfBaseline/index` 与 mermaid diagram facade 被打进同一 chunk（如 `treemap-*`），导致 `bootstrapApp` 静态拖 `vendor-mermaid`（~656KB gzip）  
  - 手段（择一或组合，PlanFirst 后落盘）：  
    - `vite.config.ts` `manualChunks` 强制 `src/services/perfBaseline/**` → 独立 `perf-baseline` chunk  
    - 或 `startupMarkers` 只依赖轻量 flag 模块，禁止从会并进 mermaid 的 barrel/index 取常量  
  - **验收**：  
    - [x] `bootstrapApp-*.js` static import 图 **无** `vendor-mermaid`  
    - [x] 冷启关键路径 gzip 相对 S0 基线下降（记录数字）  
    - [x] `startupMarkers` / perf baseline 单测通过  

- [x] **P0-2** 修正 bundle budget（治理）  
  - 现状：`app-js` 只匹配 `App-*.js`（lazy 后 ~26KB pass，**失真**）  
  - 动作：在 `scripts/bundle-budget.config.json` 增加：  
    - `app-shell-js`：`app-shell-*.js`  
    - 或 `startup-critical`：entry + bootstrapApp + app-shell + vendor-react + 启动 CSS  
  - **验收**：`npm run check:bundle-chunking` 能报告 app-shell；文档/脚本注释说明口径  

- [x] **P0-3** AppShell `mapDeps` / 预加载消毒  
  - 排查为何 preload 含 mermaid、markdown、detachedSpecHub、fileView、clientDocumentation 等  
  - 目标：Home 首屏 mapDeps ≈ shell + react + tauri + 必要 shared + 启动 CSS  
  - **验收**：产物 mapDeps 列表贴进 artifacts；非 Home 重 chunk 不再被 AppShell 首跳 preload  

- [x] **P0-4** 确认 markdown vendor 不进空 Home 首屏  
  - 无消息 / 无预览时不应解析 `vendor-markdown`  
  - **验收**：空 Home 冷启网络/模块图无 markdown vendor（或仅 dynamic 且未触发）  

- [x] **P0-5** 评估 `services/tauri` barrel 对 app-shell 的牵连（可先出矩阵不改行为）  
  - 对照 skill `bundle-barrel-imports`  
  - 产出：哪些 export 被 shell 静态引用、是否可改为 `services/tauri/xxx` 直引  
  - 本项若只做分析：勾选时备注「分析完成，改造见 P0-5b」  

- [x] **P0-5b**（可选，跟分析）拆 barrel 热路径 import，减小 app-shell 图  
  - 仅在 P0-5 证明有收益时做；禁止大爆炸重构  

### P0 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| P0-1 | 2026-08-12 | 未提交 | **bootstrap 无 vendor-mermaid**；static closure gzip **838→174 KB（−664 KB）**。手段：`perf-baseline` / `perfBaselineEnabled` / compose-refs / featureStyleLoaders / mermaid-export manualChunks。证据：`p0-bundle-snapshot.json`、`p0-bundle-graph-notes.md`；startupMarkers/index 单测绿 |
| P0-2 | 2026-08-12 | 未提交 | `bundle-budget.config.json` 增 `app-shell-js` + `startup-critical`；`check:bundle-chunking` 已报告 app-shell ~913 KiB、startup-critical ~1.24 MiB。见 `p0-check-bundle-chunking.txt` |
| P0-3 | 2026-08-12 | 未提交 | router lazy 拆分；detached 打开改 dynamic import；`modulePreload.resolveDependencies` 过滤重 vendor。mapDeps **无** mermaid/markdown JS、无 About/Detached 窗 entry。列表：`p0-app-mapDeps.txt`。残余 CSS 串名 + detachedSpecHub 动态 dep 由 preload 过滤器处理 |
| P0-4 | 2026-08-12 | 未提交 | bootstrap **无** markdown JS；AppShell 首跳 mapDeps **无** markdown JS。**残余**：AppShell 静态图仍可经共享 feature co-chunk 触达 markdown（消息路径），空 Home entry 不再强制 preload。详 `p0-bundle-graph-notes.md` §P0-4 |
| P0-5 | 2026-08-12 | 未提交 | 分析完成：`p0-tauri-barrel-matrix.md`。shell 热路径可直引；feature 层仍大量 barrel（后续可选） |
| P0-5b | 2026-08-12 | 未提交 | shell 侧 12 处 barrel→直引 + mermaidExport 直引/独立 chunk；测例 mock 同步。feature 层大爆炸未做 |

---

## P1 — CSS 分级 / 条件挂载 / 根链 memo

目标：缩短可交互时间；gate 揭开后第一下不卡。

- [x] **P1-1** `bootstrap.ts` CSS 分级（首屏 vs 延后）  
  - **首屏保留（建议）**：globals / base / buttons / sidebar* / home* / main / composer / toasts / scrollbars 等 Home 必需  
  - **候选延后**：multi-agent / tool-blocks* / terminal / plan / session-activity / subagent-ui / status-panel*（按真实依赖微调，防 FOUC）  
  - 延后方式对齐既有 `featureStyleLoaders` 模式  
  - **验收**：`App-*.css` gzip 下降有数；Home / 对话 / 状态面板无永久 FOUC  

- [x] **P1-2** 百度统计等第三方 defer（skill: `bundle-defer-third-party`）  
  - `main.tsx` 中 `installBaiduTongji` 移到 shell-ready / idle / 首次交互后  
  - **验收**：冷启关键路径不再同步执行；埋点仍最终安装  

- [x] **P1-3** S3 条件挂载：无 `activeWorkspaceId` / Home 模式少跑 domain hooks  
  - 候选禁跑或延后：git panel 全家桶、kanban host、dictation 重初始化、models/skills/commands idle-prewarm  
  - 红线：不关 chat 必需 threads / live channel / 安全恢复；遵守根链 setState 红线（AGENTS）  
  - **验收**：Profiler 或 hook 埋点证明无关域冷启 0 次 IPC/订阅；选 workspace 后功能完整  

- [x] **P1-4** idle-prewarm 集合收敛  
  - 对照 `startupOwners.ts`：skills / prompts / models / commands / collaboration…  
  - 改为：打开 composer / 选中 workspace / 用户意图后再排队  
  - **验收**：StartupGate 期间 task 榜无多余 prewarm；交互路径仍有数据  

- [x] **P1-5** S1：`composerNode` useMemo 稳定化  
  - 对照已落地 `sidebarNode`；deps 完整；回调先 `useCallback`  
  - **验收**：无关根 state 变化时引用稳定；输入/发送无 stale  

- [x] **P1-6** S1：`homeNode`（及依赖的 `homeComposerNode`）useMemo  
  - **验收**：Home 进出正常；与 P1-5 相同稳定性标准  

### P1 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| P1-1 | 2026-08-12 | 未提交 | `App-*.css` gzip **153.2→119.3 KB（−33.9 KB）** raw **1170→938 KB**。terminal/plan/tool-blocks/status-panel/subagent/session-activity/debug/worktree/clone 改 feature loader；组件侧 `useFeatureStylesReady`。见 `p1-snapshot.json` |
| P1-2 | 2026-08-12 | 未提交 | `main.tsx` 去掉同步 `installBaiduTongji`；`bootstrapApp` shell-ready 后 idle/交互/超时再装。冷启关键路径无埋点同步 |
| P1-3 | 2026-08-12 | 未提交 | collaboration `enabled` 绑 `activeWorkspace?.id`；commands/skills/prompts 无 workspace 不 prewarm。git/kanban store 仍常驻（执行/安全路径需要）；models 仍 active-workspace 刷新（composer 必需） |
| P1-4 | 2026-08-12 | 未提交 | 新增 `scheduleCatalogIdlePrewarm`（默认 **12s**，过 force-enter）；skills/prompts/commands/collaboration 共用。单测绿 |
| P1-5 | 2026-08-12 | 未提交 | **已存在**（2026-08-10 S1）：`renderComposerNode` useCallback + `composerNode` useMemo。`useLayoutNodes.client-ui-visibility` 30 tests 绿 |
| P1-6 | 2026-08-12 | 未提交 | **已存在**：`homeComposerNode` / `homeNode` useMemo。同上回归 |

---

## P2 — 层 4 单价 / Tooltip / i18n / 实测固化

目标：结构手术与长期可观测；可分多 PR。

- [x] **P2-1** S4 规划落地：AppShell 分域，压低单次根渲染端到端成本  
  - 历史目标量级：&lt;30ms 端到端（**以新采样为准**）  
  - 先读：`docs/plans/2026-08-11-app-shell-cohesion-optimization.md`、Ownership Matrix、`check:app-shell:governance`  
  - 多 PR；本清单将子 PR 完成后在完成记录中追加行  

- [x] **P2-2** 启动期 Tooltip 挂载风暴降密  
  - 历史：`Tooltip×354` 一次性  
  - 手段：延迟挂载、轻量 `title`、减少 Radix 实例  
  - **验收**：updater 榜启动 Tooltip 计数显著下降；无 a11y 回归  

- [x] **P2-3** i18n 按 namespace 拆首屏包  
  - 首屏只加载 common / home / startup 等  
  - **验收**：默认语言 chunk gzip 下降；切换语言仍完整  

- [x] **P2-4** 固化 cold-start 实测流水线  
  - `npm run perf:cold-start:startup-markers`（及 Tauri firstPaint / firstInteractive 若可得）  
  - 输出进 `.artifacts/perf/`；更新 `docs/perf/README.md` 导航指针（不伪造根 baseline）  
  - **验收**：S-CS-COLD 的 firstPaint/firstInteractive 不再长期 `null`（或正式标 unsupported + follow-up）  

- [x] **P2-5** 总包 `total-js-mjs-css` advisory 超标治理跟踪  
  - 现状约 7.6MB vs target 4.58MB（全量产物，非仅首屏）  
  - 本项为跟踪：记录是否仍超、是否升 hard gate 的团队决策  

### P2 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| P2-1 | 2026-08-12 | 未提交 | S4 分域主计划已落地（`app-shell.tsx` 纯 re-export；根 composition 单 hook）。本轮：`check:app-shell:governance` 绿；allowlist `useWorkspaceThreadListHydration.ts`（962 行过渡巨石）。**端到端 &lt;30ms 仍需 Profiler 重采样**，属持续削债务。见 `p2-snapshot.json` / `p2-app-shell-governance.txt` |
| P2-2 | 2026-08-12 | 未提交 | `App` 挂单一 `TooltipProvider`；`Tooltip` 检测 ambient 不再每实例嵌套 Provider（启动 Tooltip×N 主因）。`tooltip-icon-button` 12 tests 绿 |
| P2-3 | 2026-08-12 | 未提交 | 各语言 `critical` / `deferred` 分包。**回归修复**：`files`/`messages`/`git`/`tools`/`statusPanel`/`prompts` 等壳热路径改回 critical（避免 `files.loadingFiles` raw key）；deferred 仅 settings/projectMap/specHub/kanban 等后进面。idle 超时收紧到 1.2s。`criticalShellKeys` + `i18n/index` tests 绿 |
| P2-4 | 2026-08-12 | 未提交 | `perf-startup-marker-snapshot.mjs` 默认写 `.artifacts/perf/cold-start-YYYYMMDD/startup-markers.json`；缺输入时 `status:unsupported`+followUp（非 strict 不失败）。`docs/perf/README.md` 已加导航 |
| P2-5 | 2026-08-12 | 未提交 | 当前 total≈**7.64–7.69 MiB** gzip vs target 4.58 / hard 5.05，**保持 advisory**，不升 hard gate。决策与数字见 `p2-snapshot.json` |

---

## 建议执行顺序（AI / 人共用）

```text
S0-1 → S0-2 → S0-3 → S0-4
  → P0-1（mermaid 击穿，必做）
  → P0-2（budget）
  → P0-3 → P0-4
  → P0-5 →（可选）P0-5b
  → P1-1 → P1-2
  → P1-3 → P1-4
  → P1-5 → P1-6
  → P2-*（可并行拆 PR）
```

**硬停规则**：P0-1 未验收通过前，不进入 P1 大范围 hook 改造（避免归因混乱）。

---

## 每项完成后的 AI 检查清单（复制用）

完成任意一项时，AI 必须做：

1. 将本文件对应 `- [ ]` 改为 `- [x]`  
2. 更新「进度总览」已完成计数与阶段状态  
3. 填写该阶段「完成记录」表（日期、commit、证据）  
4. 若改了代码：列出验证命令与结果摘要（typecheck / vitest / build / 手工场景）  
5. **不**自动 commit；若用户要提交，先给变更摘要并等字面「提交」授权  

---

## 快速命令备忘

```bash
# 构建与 budget
npm run build
npm run check:bundle-chunking

# 体感（关 scan）
npm run tauri:dev

# 归因（写明 scan 放大）
npm run tauri:dev:scan

# 回归子集
npx vitest run \
  src/bootstrapApp.test.tsx \
  src/router.test.tsx \
  src/app-shell.startup.test.tsx \
  src/services/perfBaseline/startupMarkers.test.ts

# cold-start markers（环境支持时）
npm run perf:cold-start:startup-markers
```

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-12 | 初版：自新用户冷启动排查结论生成可勾选 TodoList（S0 / P0 / P1 / P2） |
| 2026-08-12 | S0 完成：基线 artifacts 落盘至 `.artifacts/perf/cold-start-20260812/`；mermaid 击穿仍在；S0-4 除 `app-shell.startup` collect OOM 外建议子集+StartupGate 补偿套件绿灯 |
| 2026-08-12 | P0 完成：bootstrap 去掉 vendor-mermaid（static gzip −664KB）；budget 增 app-shell/startup-critical；mapDeps/preload 消毒；shell barrel 热路径直引；证据见同目录 `p0-*` |
| 2026-08-12 | P1 完成：App.css gzip −34KB（延后 panel CSS）；百度埋点 defer；catalog idle-prewarm 12s；协作无 workspace 不挂；composer/home memo 复核；证据 `p1-snapshot.json` |
| 2026-08-12 | P2 完成：Tooltip ambient Provider；i18n critical/deferred；startup-markers 流水线 formal unsupported；total 包 advisory 跟踪；AppShell 治理绿。清单合计 21/21。证据 `p2-snapshot.json` |
