# Proposal: rewrite-sidebar-session-index

> OpenSpec change id: `rewrite-sidebar-session-index`  
> Evidence: 本机 Codex `sessions/` ~2.6GB / 2274 JSONL；Claude projects ~268MB；CLI `/resume` 读 `history.jsonl` / `session_index.jsonl` 秒出；GUI 侧栏走 multi-engine catalog 慢且「先错后对」。

---

## Why

侧栏历史列表错误地把 **Session Inventory / Catalog Projection**（全引擎、归属、archive、usage）当作默认路径，而 CLI `/resume` 只做 **轻量列表索引**。结果：

- 冷启/刷新要 walk + parse 大量 JSONL（Codex 可达 GB 级）
- 已有 `sidebarSnapshot` 只解决空白，不解决「正确来得太晚」
- OpenCode / full-catalog 与 first-paint 抢资源，列表长时间抖动才「正确」

用户接受 **Index-first 从 0 重写侧栏数据面**（方案 A：列表级正确 + 秒开；全量审计进 Session 管理）。

---

## 目标

1. 侧栏冷路径：**SQLite Session Index 查询**，不跑 exhaustive `list_workspace_sessions`
2. Writer 优先原生轻索引：Claude `history.jsonl` + 当前 project 目录 mtime；Codex `session_index.jsonl` + **date-partition recent-first** 有界 walk；Kimi `session_index.jsonl`
3. first-paint 即多引擎（index 行）；**禁止** first-paint 后自动 full-catalog
4. Codex ThreadPreview **禁止** 全树 collect 再 sort（修复真瓶颈）
5. full-catalog 仅：Session Management / Load older / 用户 force refresh

## 非目标

- 不改对话 transcript 加载语义
- 不在本 change 做 fs watch 实时增量（Phase 3 可续）
- 不把 Settings 全量 catalog 改成 index-only（仍保留 Full 路径）

---

## 交付物（本 PR / 本实现）

| 层 | 内容 |
|----|------|
| Rust | `session_index/*` SQLite + Claude/Codex/Kimi writers + IPC |
| Rust | `local_usage` Codex ThreadPreview recent-first candidate collect |
| FE | first-paint 合并 `list_session_index_for_workspace` |
| FE | 取消 post-first-paint 自动 full-catalog |
| Spec | 本 change proposal/design/tasks + capability delta |

## 验收

- 本机 corpus：侧栏 first-paint 路径 **不** 启动 exhaustive catalog；diagnostic 含 `thread/list session-index`
- Codex preview 不枚举全部 2274 文件
- vitest hydration + sessionIndex helpers 绿；`cargo test session_index` 绿
