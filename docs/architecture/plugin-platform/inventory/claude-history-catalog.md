# Claude History Catalog Inventory（Wave 3AE）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不接门面、不删代码。

## 它和 GUI list 的差别

catalog 不是 `list_claude_history_sessions`。它用 attribution scopes（workspace + git root）和 source facts。native continuation 只 resolve 磁盘文件路径。

## 产品调用面

| 面 | 落点 |
|---|---|
| catalog list | `session_management.rs` `list_claude_sessions_for_attribution_scopes_with_config` |
| source facts | `session_management_catalog_projection.rs` related / workspace-only |
| catalog delete | `session_management.rs` `delete_claude_session_with_config` |
| native resolve | `native_continuation/commands.rs` `resolve_claude_session_file_with_config` |

## 禁止

从 3AE 跳到删 `claude_history*`、把 catalog 硬接到 GUI list、迁 `note_cards`、开 Marketplace、默认开 flag。
