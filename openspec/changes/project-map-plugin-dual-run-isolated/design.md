# Design

## Context

5D 把门面接到 24 条产品命令，但 flag on/off 都 `delegate` 到 `*_core`。5E2 隔离 `ProjectMapNamespace` 已能在注入根读写 map/relations blob 与 memory/settings/embed-index，产品命令仍写 `~/.ccgui/project-map*` / `project-memory`。

Notes 模板：`NotesCompatOwner::{CoreNotes, IsolatedNotes}`；flag on 走 `isolated_product()`。本刀对标，flag 默认仍关。

## Goals / Non-Goals

**Goals:**

- Adapter 增加 `IsolatedProjectMap` + `isolated(root)` / `isolated_product()`
- flag on persist 走 namespace，MUST NOT 写产品目录
- compute-only embed 仍走 Core；`relationship_scan` 复用 `scan_workspace` 写 temp 再导入 blob
- flag 默认仍关；`0` 仍走 `*_core`

**Non-Goals:**

- 产品默认开 flag（下一刀）
- 存量导入、Disable、D-052、Slim、可视化插排
- 把 24 条命令写成第二套实现

## Decisions

| 选项 | 做法 | 取舍 |
| --- | --- | --- |
| A. 镜像 24 条到第二套实现 | 隔离库重写 scan / embed | 违反 Dual-run |
| B. persist 换库 + compute 复用（选用） | Isolated persist 用 namespace；scan 写 temp 再 import；embed health/text/download/remove 仍 Core | 同一调用面，不是第二套实现 |
| C. 本刀同时默认开 flag | 产品立刻搬家 | 未验收前不可逆 |

选 B。`isolated_product()` 本刀不 `import_legacy_once`。

```text
flag off
  project_map_* / project_memory_* → *_core → ~/.ccgui/project-map* / project-memory

flag on
  persist → IsolatedProjectMap → ProjectMapNamespace(app_home)
           → ~/.ccgui/plugin-runtime/data/com.mossx.project-map/store.sqlite
  embed health/text/download/remove → 仍 Core
  relationship_scan → scan_workspace(temp) → import relation_files → remove_path
```

persist 类型字段改 `pub(crate)`，或补 `from_isolated_files`。`validate_relative_project_map_path` / `scan_workspace` / `workspace_entry` 升 `pub(crate)`。

同一 workspace 不双写。测试用注入 temp 根。

## Risks / Trade-offs

- [Risk] Isolated scan 若仍调 `*_core` 会写产品目录 → Mitigation：只调 `scan_workspace` 到 temp
- [Risk] 默认开 flag 会让用户数据搬家 → Mitigation：本刀默认仍关
- [Risk] 测试 `facade_delegates_to_core_not_runtime` 会因 Isolated persist 提到 DiskStorage 失败 → Mitigation：只禁 `activate_plugin` / `dispatch_command`

## Migration Plan

1. 加 Isolated owner 与 persist 分支
2. 产品命令 flag-on 改 `isolated_product()?`
3. 注入根测试闭环
4. 回滚：不设 flag 即回到 `*_core`

## Open Questions

无。产品默认隔离、Disable、D-052 是后续独立 change。
