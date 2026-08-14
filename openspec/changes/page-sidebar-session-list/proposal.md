# Proposal: page-sidebar-session-list

> OpenSpec change id: `page-sidebar-session-list`
> 依赖：`restore-sidebar-flat-list-and-index-backfill`（session-index cursor / totalCount）

---

## Why

侧栏「加载更早」第一版是递增 limit 重查（+100、上限 500），不是真分页：每次重拉全量前缀再 merge，粒度粗。用户明确要求：

1. **真实分页查询**：一页 20 条，点「更多」拉下一页 20 条（keyset paging，纯 SQLite）
2. **不加翻页器**：只有「更多」控制
3. 页面里**超过 50 条**时提供「收起」link，点击回到 20 条
4. 其他外观不动（行样式、固定高度、虚拟滚动、worktree 区块、folder 树结构）

## 目标

1. `list_session_index_for_workspace` 支持 keyset 参数 `beforeUpdatedAt/beforeSessionId`：`WHERE (updated_at, session_id) < cursor ORDER BY updated_at DESC, session_id ASC`，跨引擎时间序单查询，不做 per-engine budget
2. `session-index::` cursor payload 从 limit 改为 keyset `{updatedAt}:{sessionId}`
3. 侧栏列表显示分页：初始 20 root；「更多」= 显示 +20（本地不足时触发真实下一页查询）；显示 >50 出现「收起」
4. first-paint index limit floor 50 → 20，减少前置加载

## 非目标

- 不改 worktree 区块展开语义（保留 isExpanded 旧路径）
- 不改 folder 树结构 / 行样式 / 固定高度 / 虚拟滚动
- 不改 first-paint 数据源（仍 SQLite 最近窗口）
- `visibleThreadRootCount` 设置不再作用于侧栏会话列表（固定 20 一页）；设置项本身保留

## 验收

1. 「更多」每次点击 diagnostic 出现 keyset 分页查询（本地数据不足时），列表 +20
2. 显示 60 条时出现「收起」，点击回到 20 条，再点「更多」直接从本地展开（不重复查询）
3. 翻页不重不漏：两页 keyset 查询结果 disjoint 且有序（cargo 单测）
4. worktree 区块展开/收起行为不变
