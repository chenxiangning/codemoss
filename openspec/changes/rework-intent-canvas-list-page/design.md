# Design: rework-intent-canvas-list-page

## Context

现状：`IntentCanvasManager.tsx`（1572 行）的列表首页是扁平 grid——每张卡显示 mode、标题、摘要、dl 统计（elements/files/nodes）、更新时间与操作按钮；顶栏含搜索/计数/全选/刷新/Project Map/新建。设计定稿 `docs/previews/intent-canvas-ui-2026-08-13/11-cards-timeline.html` 要求改为「时间纵轨分组 + 缩略图卡片 + 更早组治理」。

约束：
- index entry（`IntentCanvasIndexEntry`）已含 `updatedAt / mode / elementCount / linkedFileCount / linkedProjectMapNodeCount`，**不含** scene 元素与锚点健康度。
- 持久化格式不破坏：新增字段必须可选、向后兼容。
- 大文件治理：`npm run check:large-files:gate`，Manager 已 1572 行，本次必须顺势拆分。
- 样式全部走 design tokens（light = 黑透明度叠加，dark = oklch ramp），禁硬编码色值。

## Goals / Non-Goals

**Goals:**
- 列表按 `updatedAt` 分 era 组渲染：本周 / 各自然月 / 更早（≥60 天未更新），左侧纵轨 + 刻度点 + 组聚合统计。
- 卡片 = SVG 缩略图 + 单行标题/摘要 + footer（mode 徽标、`元素·文件·节点` 统计、相对时间）。
- 「更早」组治理：虚线轨道、卡片降透明度、「⚠ 建议清理」、「全选本组」衔接现有批量删除、卡内 stale 角标。
- 拆分列表视图为独立组件 + 纯函数 utils，可单测。

**Non-Goals:**
- 编辑器（Excalidraw 内部）零改动。
- 不改 Rust 存储命令与既有写入路径语义。
- 不做虚拟滚动（画布数量级为几十，grid 足够）。

## Decisions

### D1. Era 分桶规则（纯函数 `groupCanvasEntriesByEra`）

- **本周**：`updatedAt` 落在当前自然周（周一起算，按本地时区）。
- **月度组**：本周之外且 `updatedAt` 在 60 天阈值内，按自然月分桶，标签 `M 月`；组按月份倒序。
- **更早**：`updatedAt` 早于 `now - 60 天`（阈值常量 `STALE_ERA_THRESHOLD_DAYS = 60`）。
- 设计稿中「7–8 月」合并且组是样本数据只有 3 张的展示效果；生产按自然月独立成组，空组不渲染——确定性优先于排版花哨。
- 组内条目按 `updatedAt` 倒序；聚合统计显示 `N 张 · M 元素`（M = 组内 elementCount 求和）；「更早」组聚合改显 `N 张 · 最早 X 天未动` 语义（取组内最大陈旧天数）。

备选：固定 4 桶（本周/本月/上月/更早）——被否：月份一多就丢失定位精度，与定稿「6 月」「7–8 月」多组形态不符。

### D2. 缩略图：保存时生成 + index 可选缓存 + 占位降级

- 在 `saveIntentCanvasDocument` 的前端调用侧（Manager 保存路径）用 Excalidraw `exportToSvg` 生成静态 SVG 字符串，写入 index entry 新增**可选**字段 `thumbnailSvg`。
- 生成预算：仅取非删除元素、跳过 image 元素的 file 内联（不嵌 base64）、最多取前 80 个元素、SVG 字符数上限 8KB，超限则放弃缓存（回退占位）。
- 存量/无缓存条目渲染占位图形：虚线圆 + 中心点（对应设计稿空图样式），**不在列表加载时回源生成**（避免打开列表触发 N 次 document 读盘）。
- `thumbnailSvg` 不参与相等性以外的任何逻辑；读旧 index 缺字段即 undefined，向后兼容，无迁移。

备选：Rust 侧预生成 PNG——被否：动存储契约 + 需迁移存量，违反非目标。备选：列表加载时按需生成——被否：N 次 IPC 读盘放大冷启动。

### D3. Stale 角标计算（`deriveCanvasStaleSignals`）

角标仅在「更早」组渲染，每条最多显示一个，优先级从高到低：
1. **锚点失效**：懒判定。仅当条目落入「更早」组时，批量并发（上限 4）`loadIntentCanvasDocument` 读取 `semanticGraphs`，存在 `unresolved === true` 或 `stale === true` 的 node/edge 即命中；结果按 canvasId 缓存在组件 ref 中，workspace 切换清空。读取失败的条目静默跳过（不阻塞渲染）。
2. **空图**：`elementCount <= 3`（常量 `EMPTY_GRAPH_ELEMENT_THRESHOLD`，与设计稿样本 3·0·0 对齐）。
3. **N 天未动**：兜底，`floor((now - updatedAt) / 天)`。

备选：锚点健康度写进 index——被否：需要每次保存时做健康扫描，放大写路径成本；「更早」组量级小，懒读足够。

### D4. 组件拆分

- 新增 `components/manager-home/IntentCanvasHome.tsx`：顶栏 + era 分组渲染 + 批量工具条，接收 Manager 传入的 entries/状态/回调（props 下传，不新建 store）。
- 新增 `components/manager-home/IntentCanvasCard.tsx`：单卡（缩略图/body/footer/角标/选择框/操作按钮/确认气泡）。
- 新增 `utils/eraGrouping.ts`、`utils/staleSignals.ts`、`utils/relativeTime.ts` 纯函数 + 各自单测。
- `IntentCanvasManager.tsx` 保留状态编排与编辑器分支，删除列表 JSX；目标降到 800 行以下（配合 large-files gate）。

### D5. 交互与文案

- 顶栏副标题改为「N 个画布 · 按更新时间」（N 随搜索过滤实时变化）；保留搜索、全选（全部过滤结果）、刷新、Project Map、新建。
- 「全选本组」：将「更早」组全部 entry id 并入 `selectedCanvasIds`，复用现有 bulk toolbar 与 `ThreadDeleteConfirmBubble`，删除语义零改动。
- 相对时间格式化 `formatRelativeCanvasTime`：今天 HH:mm / 昨天 / N 天前（<30）/ M月D日。复用 i18n，新增 key 落到 locale registry 覆盖的全部语言。
- 卡片整卡点击 = 打开（保留确认气泡链）；checkbox、操作按钮阻止冒泡，与现网一致。

### D6. 样式

- 新增样式集中在 intent-canvas 样式文件，命名沿用 `intent-canvas-` 前缀：`era`、`era-rail`、`era-deck`、`canvas-thumb`、`stale-tag` 等。
- 全部引用 tokens：`--surface-card`、`--surface-card-muted`、`--border-subtle/strong/muted`、`--text-accent`、`--status-warning`；「更早」组 `opacity: 0.72` + hover 恢复、轨道 `border-left-style: dashed`。
- dark 主题零额外代码（token ramp 自动覆盖）。

## Risks / Trade-offs

- [保存路径新增 `exportToSvg` 开销] → 异步 fire-and-forget 不阻塞保存返回；元素/字符双上限兜底；失败仅丢缩略图，不写错误状态。
- [「更早」组懒读 document 带来 IPC 尖峰] → 并发上限 4 + 仅该组触发 + 组件级缓存；条目读取失败静默降级为「N 天未动」。
- [index.json 体积增长（thumbnailSvg 每条约数 KB）] → 8KB/条硬上限；画布量级几十条，总增量 < 500KB，可接受；超上限条目自动放弃缓存。
- [era 分桶依赖本地时区/周起点，跨地区显示差异] → 可接受：相对时间本就是本地语义；单测注入固定 `now` 保证确定性。
- [拆分触动 Manager 既有测试] → `IntentCanvasManager.test.tsx` 同步更新选择器；先跑基线确认既有失败集，完工后证明失败集不扩大。

## Migration Plan

1. 纯函数 utils + 单测先行（era 分桶、stale 判定、相对时间）。
2. 存储层：`IntentCanvasIndexEntry` 加可选 `thumbnailSvg`；保存路径生成缓存。
3. 组件拆分 + 新列表渲染；更新 Manager 测试与 i18n。
4. 门禁：`openspec validate --all --strict`、`npm run typecheck`、`IntentCanvasManager` 相关 Vitest、`check:large-files:gate`。
5. 回滚：全部变更限于前端 feature 目录与 index 可选字段，还原提交即回滚；旧 index 无 `thumbnailSvg` 读法不变。

## Open Questions

- 「本周」周起点固定周一（中文语境惯例），不随系统区域设置——实现时确认 `Intl` 行为与单测时区稳定性。

## 实现偏差记录（2026-08-13 用户评审后迭代）

对照定稿 HTML 截图评审后做了三处视觉收敛，不改变任何 D1–D6 决策：

1. **顶栏标题精简**：各 locale 的 `manager.title` 从「意图画布 Canvas Manager / Intent Canvas Manager / …」统一精简为产品名（如「意图画布」/ "Intent Canvas"）；hero 网格改为 `auto minmax(180px, 1fr) auto`，副标题去掉 280px 截断上限。
2. **顶栏按钮层级**：「新建 Canvas」改为深色实心 pill（`var(--text-primary)` / `var(--bg-primary)`，dark 自动反色）；全选 / 刷新 / 项目知识地图改为 30×30 纯图标幽灵按钮（`ListChecks` / `RefreshCw` / `GitBranch`），文案收进 tooltip + aria-label。
3. **页面背景去装饰**：`.intent-canvas-manager` 背景从双色 radial 光晕 + linear 渐变降为纯色 `var(--surface-messages)`（仅列表页；编辑器页保持原样）。
4. **卡片悬浮控件**：选择 checkbox 去掉文字 chip（死 key `selectCanvasShort` 从 10 个 locale 清除），与三个操作按钮合并为右上角一行，默认 `opacity: 0`，hover / focus-within / 已选中 / 确认气泡打开时显现；确认气泡 `top` 78px → 40px。
