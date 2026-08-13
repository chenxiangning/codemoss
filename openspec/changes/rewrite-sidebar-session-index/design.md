# Design: rewrite-sidebar-session-index

## Context

### CLI vs GUI（定案）

| | CLI `/resume` | 旧 GUI 侧栏 |
|--|--|--|
| 数据 | 小索引 / 当前目录 | multi-engine catalog + source-fact |
| 范围 | 当前 project | workspace 归属宇宙 |
| 成本 | MB 级 | 可达 GB 级 JSONL |

### 架构

```text
L0  session-index.sqlite3   ← 侧栏 list 唯一快路径
L1  writers (claude/codex/kimi)  ← 原生索引 + 有界 walk
L2  bounded header parse         ← Codex ThreadPreview
L3  transcript loader            ← 点开会话
L4  list_workspace_sessions      ← Session Mgmt / force only
```

### 关键决策

1. **Topology ≠ Inventory**：导航不扫 catalog；侧栏 list 用 Index。
2. **Page size 约束 source work**：Codex 按 `sessions/YYYY/MM/DD` 逆序收集，early stop。
3. **first-paint 完成态 = index 多引擎行可用**，不再自动 full-catalog。
4. Source-fact cache 仍服务 catalog；**不**作为侧栏 list 主路径。

## 数据模型

```sql
session_index(engine, session_id PK, title, native_title, updated_at,
  cwd, workspace_path, physical_path, parent_session_id, size_bytes, ...)
session_index_sources(source_key, fingerprint, last_sync_ms, row_count)
```

Freshness：源 fingerprint（目录/index mtime）+ 30s 窗口 → skip rescan。

## IPC

- `list_session_index_for_workspace(workspaceId, limit?, syncIfNeeded?, forceSync?)`
- `sync_session_index_for_workspace(workspaceId, limit?, force?)`

## 前端 merge

`listThreadsForWorkspace`：与 titles 并行启动 index；在 live Codex page 之后 merge index 行（不覆盖更新的 live 行）。first-paint 跳过 project catalog / native Claude seed。

## 风险

| 风险 | 缓解 |
|--|--|
| Index 缺 cwd 导致 workspace 过滤空 | Claude 用 project dir；Codex preview 带 workspace filter + 扩大 collect budget |
| Kimi home 非默认 | env `KIMI_HOME` + missing soft-empty |
| 用户期望 full catalog 自动补全 | force refresh / Session 管理仍可用；UI 后续可加「同步全部」 |
