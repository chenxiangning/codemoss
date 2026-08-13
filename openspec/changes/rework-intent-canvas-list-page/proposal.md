# Proposal: rework-intent-canvas-list-page

## Why

意图画布列表首页当前是扁平卡片平铺：无时间维度、无视觉预览、无治理信号。画布数量增长后，用户无法快速区分「最近在用的图」和「早已过期的草稿」，陈旧画布（空图、锚点失效、长期未动）混在正常内容里，只能逐张人工辨认。设计定稿（`docs/previews/intent-canvas-ui-2026-08-13/11-cards-timeline.html`）已给出答案：时间分组纵轨 + 缩略图卡片 + 「更早」组治理，本次将其落成生产实现。

## What Changes

- **时间分组纵轨**：列表按 `updatedAt` 分为「本周 / 近月分组（如 7–8 月、6 月）/ 更早」era 分组；左侧纵轨显示组名与聚合统计（N 张 · M 元素），最新一组刻度点使用 accent 填充，「更早」组轨道变虚线。
- **卡片重构**：每张卡 = SVG 缩略图（从 Excalidraw scene 生成的静态预览）+ 单行 body（标题、摘要，溢出省略）+ 单行 footer（mode 徽标 Architect/Spotlight/File + `元素·文件·节点` 行内统计 + 相对时间）。替代当前 dl 统计块与多行布局。
- **「更早」组治理**：超过陈旧阈值（默认 60 天未更新）的画布落入「更早」组，卡片降透明度（hover 恢复）；组内提供「⚠ 建议清理」提示与「全选本组」按钮，衔接现有批量删除流程。
- **卡内 stale 角标**：陈旧卡标题旁显示治理角标——「N 天未动」（按 `updatedAt` 计算）、「空图」（`elementCount` 低于阈值）、「锚点失效」（画布 semantic graph 存在未解析锚点时）。
- **顶栏收敛**：副标题改为「N 个画布 · 按更新时间」，保留搜索、新建、刷新、Project Map 入口；全选逻辑由「全部过滤结果」细化为支持按 era 组全选。
- 全部样式基于 design tokens（`--surface-card`、`--border-subtle`、`--status-warning` 等），不自造色值；light/dark 双主题继承现有 token 体系。

## 目标与边界

- 只重构 Canvas Manager 的**列表首页**（manager grid 视图）；编辑器（Excalidraw 画布内交互）不在本次范围。
- 数据层（`intentCanvasStorage`、index schema、Rust 存储命令）尽量不动；缩略图与陈旧的判定在前端基于现有 index entry + 按需读取的 document 派生。
- 批量删除沿用现有 `deleteIntentCanvasDocuments` + `ThreadDeleteConfirmBubble` 确认链，不新增删除语义。
- i18n 新增文案须同时落到现有 locale registry 覆盖的语言。

## 非目标

- 不改动画布文档 schema（`IntentCanvasDocument` / `IntentCanvasIndexEntry`）的持久化格式；若缩略图需要缓存，仅作为 index entry 的可选派生字段，缺失时按需生成，不构成 **BREAKING**。
- 不做画布内编辑器的任何交互/渲染改动。
- 不做跨 workspace 聚合视图、不做云端同步。
- 不引入新的依赖（缩略图优先复用 Excalidraw 自带 `exportToSvg` 能力）。

## Capabilities

### New Capabilities

（无新增独立 capability——列表展示是既有 Canvas Manager 能力的呈现层重构。）

### Modified Capabilities

- `intent-canvas-workspace-files`：Canvas Manager 列表呈现需求变更——从扁平卡片网格改为时间分组纵轨 + 缩略图卡片；新增「更早」组的治理展示与按组批量选择需求；既有搜索、打开、重命名、复制、删除、批量删除语义保持不变。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| **A. 纯 index 派生（推荐）** | 分组、统计、相对时间全部从 `IntentCanvasIndexEntry` 派生；缩略图用 Excalidraw `exportToSvg` 在打开过的 document 上懒生成并缓存到 index 可选字段 | 无存储格式破坏；首次渲染缺缩略图时降级为占位图形；锚点失效判定需轻量读取 document（只对「更早」组候选做，量小） |
| B. 存储层预计算 | Rust 侧在 save/delete 时预生成缩略图 PNG/SVG 与 stale 标志写入 index | 列表零计算，但动存储 schema 与 Rust 命令，违反本次「数据层不动」边界，且存量数据需要迁移 |
| C. 不做缩略图 | 只上时间分组与治理角标 | 丢掉定稿的核心识别收益（一眼分辨图的内容），与设计稿不符 |

选 A：满足定稿视觉，且不触碰持久化契约，回滚只需还原前端组件。

## 验收标准

1. 列表按 `updatedAt` 渲染 era 分组纵轨：本周组刻度点为 accent 填充，「更早」组（≥60 天未更新）轨道为虚线、卡片 opacity 0.72、hover 恢复 1。
2. 每张卡片显示 SVG 缩略图（无 scene 时显示占位虚线图形）、单行标题/摘要（溢出省略）、footer 含 mode 徽标 + `element·file·node` 统计 + 相对时间。
3. 「更早」组显示「⚠ 建议清理」与「全选本组」；点击后选中该组全部卡片并出现现有批量删除工具条，确认后删除语义与现网一致（移入回收站、index 单次写入）。
4. 陈旧角标正确：N 天未动（基于 `updatedAt`）、空图（`elementCount` 为 0 或低于阈值）、锚点失效（含未解析锚点的画布）。
5. 搜索过滤在分组视图下仍然生效（命中卡片保留，空组隐藏）；「N 个画布 · 按更新时间」副标题随过滤结果更新。
6. light/dark 主题下所有颜色来自 design tokens，无硬编码色值。
7. `openspec validate --all --strict`、`npm run typecheck`、相关 Vitest 套件（`IntentCanvasManager.test.tsx` 更新后）通过。

## Impact

- **代码**：`src/features/intent-canvas/components/IntentCanvasManager.tsx`（列表区重构，可能拆出 era 分组/卡片子组件以满足文件规模治理）、`src/styles/` 下 intent-canvas 样式、locale 文案文件、`IntentCanvasManager.test.tsx`。
- **派生逻辑**：新增 era 分桶与 stale 判定的纯函数（可单测）；缩略图生成复用 `@excalidraw/excalidraw` 的 `exportToSvg`。
- **存储**：index entry 可能新增可选 `thumbnailSvg` 派生字段（向后兼容，缺失即懒生成）。
- **规范**：`openspec/specs/intent-canvas-workspace-files/spec.md` 增加 delta。
- **设计来源**：`docs/previews/intent-canvas-ui-2026-08-13/11-cards-timeline.html`（定稿）。
