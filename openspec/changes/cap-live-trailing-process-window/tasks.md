# cap-live-trailing-process-window — Tasks

## 1. View model：trailing 滚动窗口

- [x] 1.1 `resolveCollapsedTimelineItems` 新增 trailing 段处理：边界回溯（最后一条 user/assistant 正文）→ `groupToolItems` 卡片序列 → 超阈值折叠、末尾保留 3 张卡
- [x] 1.2 常量 `TRAILING_PROCESS_COLLAPSE_THRESHOLD = 5` / `TRAILING_PROCESS_VISIBLE_TAIL_COUNT = 3`，注释注明设计边界（不扩散、不做设置项、不按 engine 分化）
- [x] 1.3 `ProcessPhaseCollapse` 新增 `collapsedAnchorItemId?`；trailing chip 稳定 phaseKey（`trailing:<边界 id>`）

## 2. 投影与渲染透传

- [x] 2.1 `TimelineProcessPhaseChip` / `TimelineSnapshotModel.processPhaseChips` 类型透传 `collapsedAnchorItemId`
- [x] 2.2 `buildTimelineProjectionRows` fallback：无正文锚点的折叠 chip 插到第一张可见尾卡之前，不再甩到 rows 末尾
- [x] 2.3 `MessagesCore` chip 映射透传

## 3. 测试

- [x] 3.1 阈值边界：5 张卡不折叠
- [x] 3.2 批量卡计数：6 个连续 fileRead = 1 张批量卡，不触发折叠
- [x] 3.3 超阈值：6 张卡折前 3 留 3，chip 落位锚点为第一张可见尾卡
- [x] 3.4 批量卡整体折叠，不从中间截断
- [x] 3.5 展开态全量 remount
- [x] 3.6 终稿落地移交：trailing chip 消失，全量并入回合级 phase
- [x] 3.7 投影层：折叠态 trailing chip 落位在可见尾卡之前

## 4. 验证

- [x] 4.1 `vitest run` 相关测试文件全绿（31 passed）
- [x] 4.2 `npm run typecheck` 绿
- [x] 4.3 变更文件 `eslint` 绿
- [x] 4.4 回归闸门：`src/features/messages` 全量测试失败集与基线一致（29 failed，既有环境性失败，未扩大）
