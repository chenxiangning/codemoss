# Tasks: page-sidebar-session-list

## 1. Backend keyset paging

- [x] 1.1 store：`list_page_for_workspace_before`（keyset：updated_at DESC, session_id ASC）
- [x] 1.2 command：`list_session_index_for_workspace` 加 `before_updated_at/before_session_id`，命中时跳过 sync 纯分页
- [x] 1.3 cargo 单测：两页 disjoint + 有序 + tombstone 排除

## 2. FE cursor 与查询

- [x] 2.1 `session-index::` payload 改 keyset `{updatedAt}:{sessionId}`（updatedAt 数值无冒号，split 首个冒号）
- [x] 2.2 first-paint 合成 cursor 用 page 最后一行；first-paint limit floor 50→20
- [x] 2.3 loadOlder session-index 分支：请求 limit=21 探针，merge 前 20，hasMore=21
- [x] 2.4 sessionIndex.ts client 加 before 参数

## 3. 显示分页

- [x] 3.1 Sidebar：`visibleCountByWorkspaceId` state（默认 20）+ showMore/collapse handler
- [x] 3.2 ThreadList：「更多」统一控制（reveal+fetch）+ 显示 >50 时「收起」link；isExpanded 旧路径保留给 worktree
- [x] 3.3 threadListProps / folder 树接线同步

## 4. 验证

- [x] 4.1 vitest cursor 编解码 + 合成用例更新
- [x] 4.2 Sidebar / ThreadList 相关测试绿
