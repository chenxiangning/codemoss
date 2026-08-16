# Claude History Remaining Call Sites（Wave 3AJ）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不接门面、不删代码。

## 已走默认 off 门面

GUI / daemon / catalog / native continuation 的 list、load、hydrate、fork、delete、rewind、attribution list、source facts、catalog delete、resolve。

## 允许残留

| 类 | 落点 | 为什么不是漏接 |
|---|---|---|
| 门面委托 | `claude_compat.rs` / `manager.rs` ClaudeOwner | flag off 必须落到同一实现 |
| catalog 类型 / 常量 | attribution scope、source fact、scan diagnostic | 调度壳需要类型，不是 history 操作 |
| session index helper | `session_index/writers.rs#encode_project_path` | 编路径，不读 JSONL 会话 |
| 实现与测试 | `engine/claude_history*` | disable-not-delete 必须留下 |

## 禁止

从 3AJ 跳到删 `claude_history*`、把类型引用当漏接、迁 `note_cards`、开 Marketplace、默认开 flag。
