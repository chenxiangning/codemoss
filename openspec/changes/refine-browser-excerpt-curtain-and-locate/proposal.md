# refine-browser-excerpt-curtain-and-locate

## Why

网页摘录发送后走蓝边摘要卡，3 段正文就能把幕布撑满；composer 预览也是另一套 chips。点选重复点击会叠行，发给模型的选择块只有视口盒子，模型对不上「指哪」。用户已选定 V3「点行看全文」，需要把幕布、预览、点选与 prompt 收成同一套摘录契约。

## What Changes

- 发送后幕布与 composer 预览统一为记忆注入同款细线折叠：`网页摘录 N` + 页面标题；默认一行标题，点行展开全文
- 展开行展示发给模型的发送细节（文档坐标、视口、列表序号、前后邻居、分组、cssPath、元素 meta）
- 重复点击同一选择器+文案原地替换，展示与 prompt 去重
- 点选吸附内容块（段落/列表行/按钮/标题），浮层保留 programmer debug（tag/role/像素/doc 坐标/页标题）
- 选择 payload 增加 `locate`：documentPosition、inList、previous/next、ancestor、cssPath；`usageHint` 要求模型先打这个 target
- **非 BREAKING**：旧 annotation 无 `locate` 时仍可由 region+viewport 回推文档坐标；不发选区截图

## 目标与边界

- **目标**：用户点哪，幕布能核对、模型能按文案+结构位置回答，且不撑满对话面
- **边界**：只改 Browser Agent 摘录 UI / 选择器脚本 / v2 prompt 选择块；不改会话生命周期、不改截图门禁

## 非目标

- 不发送选区 crop / annotated screenshot（视觉门禁仍 opt-in）
- 不改整页 snapshot attach 的采集语义
- 不纳入 Dock tab 右键关闭等无关 working-tree 变更
- 不做引擎特化 payload

## 技术方案取舍

| 选项 | 说明 | 取舍 |
|---|---|---|
| **A. 细线折叠 + locate 文本块**（采用） | 与记忆注入同一交互；位置用文档坐标/邻居/cssPath | 模型可消费；无隐私升级；实现面可控 |
| B. 选区 crop 进模型 | 框选小图 + 文本 | 否决本期：Phase 3 默认禁 annotated screenshot，需单独视觉门禁 |
| C. 保留蓝卡只加折叠 | composer/幕布继续蓝卡 | 否决：与 V3 原型和「不另起蓝卡」冲突 |

## Capabilities

### New Capabilities

- （无）本期不新增 capability 命名空间，沿用既有 Browser Agent 契约

### Modified Capabilities

- `browser-agent-page-understanding`：composer/幕布摘录展示改为细线点行；选择器吸附内容块；选择块携带 locate 与指哪 hint
- `composer-control-surface`：browser context 预览不再以蓝卡 chips 为唯一形态；expired 等状态仍可辨识

## Impact

- FE：`BrowserExcerptFold`、`BrowserContextSummaryCard`、`BrowserContextPreview`、`MessageRow` 布局、`browserEvidenceViewModel`、`attachment` prompt、选择去重、`messages.part1.css` / `composer.css`、i18n
- Rust：`toolbar.rs` 选择器脚本（内容块吸附、locate 采集、浮层布局）
- Prompt：`<browser_context_v2>` 的 `selectedElements` / `usageHint`
- 测试：browser-agent vitest + toolbar selector rust tests

## 验收标准

1. 发送后幕布只多一行「网页摘录 N + 页标题」；点行才出全文与发送细节
2. composer 上方与幕布同一套细线，刷新/删除仍在
3. 同一段重复点选不增加行数
4. 发给模型的选择块含 `documentPosition`、`inList`、`previous`/`next`、`cssPath` 与指哪 `usageHint`
5. 点选浮层仍显示 tag/role/像素/doc 坐标/页标题
6. 旧摘录无 locate 时展开仍能看到由 region 回推的文档坐标与元素信息
7. focused vitest / toolbar rust tests 绿；不把 Dock tab 菜单等无关 diff 打进本 change
