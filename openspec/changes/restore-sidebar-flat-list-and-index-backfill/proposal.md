# Proposal: restore-sidebar-flat-list-and-index-backfill

> OpenSpec change id: `restore-sidebar-flat-list-and-index-backfill`
> Supersedes UI 部分：`redesign-sidebar-engine-rail`（engine rail 分轨外观）
> 数据面延续：`rewrite-sidebar-session-index` + `add-session-index-import-daemon`（侧栏只读 SQLite 不变）

---

## Why

`d82b82f81` 上线两个改动后暴露出两个回归：

1. **外观回归**：按 CLI 分轨的 engine rail（图标 tab + 单轨过滤）视觉与交互均不被接受，用户要求完全恢复原来的「workspace → 按时间混排扁平会话列表」。
2. **历史会话丢失**：侧栏只读 `session-index.sqlite3`，但所有 writers 都是 recent-first 有界窗口（默认 50/引擎，硬上限 500），后台 import daemon 复用同一批有界 writer，**老会话永远进不了库**；且 first-paint 不再跑 full-catalog，`threadListCursor` 恒为 null，侧栏连「加载更早」入口都没有。历史会话实际不可见。

用户明确要求：**不恢复原来的深层目录扫描**（Codex corpus GB 级，全树 walk 太慢），改用**游标式增量回填**让 SQLite 在后台最终收敛到全量历史。

## 目标

1. **外观还原**：完全删除 engine rail UI（图标列、分轨过滤、相关 localStorage），恢复扁平混排会话列表；数据层（Session Index）不动。
2. **历史回填到底**：每个 CLI engine 增加 cursor-based backfill，挂在现有 import daemon tick 尾部，单批有界（~100 行 / 1~2 个日期分区），游标持久化，直到该 `(engine, workspace)` 回填完成并标记 `complete`。
3. **侧栏可见性闭环**：`list_session_index_for_workspace` 返回 `totalCount`；侧栏恢复「加载更早」入口，数据源是 SQLite 加大 limit 重查（纯 SELECT，不扫盘），cursor source 新增 `session-index`。

## 非目标

- 不恢复 exhaustive `list_workspace_sessions` / 全树 JSONL walk 作为侧栏任何路径的数据源
- 不改 first-paint 路径（仍只读 SQLite 最近窗口，秒开语义不变）
- 不改 transcript 加载语义
- 不为 OpenCode 做 backfill（无持久磁盘索引，soft-empty 语义不变）
- 不改 Session Management 页的 full-catalog 路径

## 交付物

| 层 | 内容 |
|----|------|
| FE | 删除 `SidebarEngineRail` / `sidebarEngineRail.ts` / `sidebar.engine-rail.css` 及 `Sidebar.tsx` 内全部 rail 状态、过滤与渲染 |
| Rust | `session_index_backfill` 游标表（store） |
| Rust | Claude（mtime offset）/ Codex（date-partition 倒序）/ Kimi（行 offset）/ Gemini / Grok / PI（分页 limit 递增）backfill batch writers |
| Rust | importer tick 尾部串行执行各 engine 一个 backfill 批，有写入发 `session-index-imported` |
| Rust | `SessionIndexListPage` 增加 `totalCount`；`list` 支持更大 limit 复用（clamp 500/引擎） |
| FE | load-older 支持 `session-index::` cursor：无 catalog cursor 时从 SQLite 以递增 limit 拉取更老会话并 merge |
| Spec | 本 change proposal/design/tasks + capability deltas |

## 验收

1. 侧栏不再渲染 engine rail；会话按 updatedAt 混排，多引擎同列表可见
2. 本机 Codex corpus（~2274 JSONL）：importer 每 tick 只处理有界一批（≤2 个日期分区），无全树 walk；若干 tick 后 Index 行数收敛到全量，backfill 标记 complete 后不再扫盘
3. tombstone 行不被 backfill 复活；重复 tick 不产生重复行（主键幂等）
4. 侧栏「加载更早」在 catalog cursor 缺失时出现，点击后只触发 SQLite SELECT（diagnostic 无 `list_*_sessions` 磁盘调用），更老会话出现
5. `cargo test session_index` 绿；vitest sidebar / hydration / loadOlder 相关测试绿
