# Tasks: rework-intent-canvas-list-page

## 1. 纯函数 utils（TDD 先行）

- [x] 1.1 `utils/eraGrouping.ts`：`groupCanvasEntriesByEra(entries, now)` —— 本周（周一起算）/ 自然月 / 更早（≥60 天）分桶，组内 updatedAt 倒序，空组不产出；附聚合（N 张 · M 元素 / 最大陈旧天数）
- [x] 1.2 `utils/eraGrouping.test.ts`：边界（周一 00:00、60 天整、跨月、空数组、单条目）注入固定 `now` 单测
- [x] 1.3 `utils/relativeTime.ts`：`formatRelativeCanvasTime(updatedAt, now, t)` —— 今天 HH:mm / 昨天 / N 天前（<30）/ M月D日
- [x] 1.4 `utils/relativeTime.test.ts`：各分支 + 跨年边界
- [x] 1.5 `utils/staleSignals.ts`：`deriveCanvasStaleBadge({entry, anchorHealth, now})` —— 锚点失效 > 空图（elementCount ≤ 3）> N 天未动；常量 `STALE_ERA_THRESHOLD_DAYS = 60`、`EMPTY_GRAPH_ELEMENT_THRESHOLD = 3`
- [x] 1.6 `utils/staleSignals.test.ts`：优先级与 fallback 分支

## 2. 缩略图缓存（index 可选字段）

- [x] 2.1 `types.ts`：`IntentCanvasIndexEntry` 增加可选 `thumbnailSvg?: string`
- [x] 2.2 保存路径：Manager `saveDocument` 成功后用 `exportToSvg` 生成缩略图（排除已删除元素、不内联 image files、≤80 元素、≤8KB，超限放弃），异步不阻塞保存返回
- [x] 2.3 `intentCanvasStorage`：index 写入携带 `thumbnailSvg`；读取旧 index 缺字段兼容
- [x] 2.4 缩略图生成单测：预算超限放弃、正常场景产出 SVG 字符串

## 3. 组件拆分与新列表渲染

- [x] 3.1 新增 `components/manager-home/IntentCanvasHome.tsx`：顶栏（标题/副标题「N 个画布 · 按更新时间」/搜索/全选/刷新/Project Map/新建）+ era 分组渲染 + 批量工具条
- [x] 3.2 新增 `components/manager-home/IntentCanvasCard.tsx`：缩略图（缓存 SVG 或虚线占位）+ 单行 body + footer（mode 徽标、`N·N·N`、相对时间）+ stale 角标 + 选择框/操作按钮/确认气泡
- [x] 3.3 「更早」组：虚线轨道、卡片 opacity 0.72 hover 恢复、「⚠ 建议清理」、「全选本组」并入现有 selection
- [x] 3.4 锚点健康懒检测：仅「更早」组，并发上限 4 读 document 查 `semanticGraphs` 的 `unresolved/stale`，ref 缓存，workspace 切换清空，失败静默降级
- [x] 3.5 `IntentCanvasManager.tsx` 删除列表 JSX，改为渲染 `IntentCanvasHome`；保留状态编排与编辑器分支，文件降至 800 行以下

## 4. 样式与 i18n

- [x] 4.1 intent-canvas 样式新增 era/rail/deck/thumb/stale-tag 等类，全部引用 design tokens，无硬编码色值；dark 主题靠 token ramp 自动覆盖
- [x] 4.2 新增 i18n key（副标题、era 标签、清理提示、全选本组、stale 角标、相对时间）落到 locale registry 全部语言

## 5. 验证与门禁

- [x] 5.1 基线确认：改动前记录 `IntentCanvasManager.test.tsx`、`npm run typecheck` 既有状态
- [x] 5.2 更新 `IntentCanvasManager.test.tsx` 适配新 DOM 结构；新增 Home/Card 组件测试（分组渲染、全选本组、占位缩略图、角标优先级）
- [x] 5.3 `npm run typecheck`、`npm run lint` 通过
- [x] 5.4 相关 Vitest 套件全绿，失败集不扩大（8 文件 / 46 用例）
- [x] 5.5 `npm run check:large-files:gate` 失败集与基线一致（101 个既有文件，intent-canvas 无新增超线文件；stash 对比验证）
- [x] 5.6 `openspec validate --all --strict --no-interactive`：本 change 通过；其余 5 个失败为其他 change 的既有状态，未扩大
- [x] 5.7 手动 QA：对照 `docs/previews/intent-canvas-ui-2026-08-13/11-cards-timeline.html` 截图核对 light/dark 双主题（用户确认前不提交）——用户截图评审通过，并完成三轮视觉收敛迭代（详见 design.md「实现偏差记录」）
