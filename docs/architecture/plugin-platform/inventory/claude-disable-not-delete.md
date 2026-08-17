# Claude Disable-Not-Delete（P4.7-29）

> pluginId：`com.mossx.engine.claude`  
> 状态：**产品默认 disable Core owner**。源码保留。不是 Slim。

## 现在

| 面 | 现状 |
|---|---|
| 产品路径 | Process Entry（未设旗） |
| Core owner | `disabled` |
| 显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0` | `fallback`，`cmd.spawn()` |
| 源码 | `src-tauri/src/engine/claude.rs` 仍在 |
| boot | 仍不 activate / 不 Slim |

## 禁止

删 `engine/claude*`、开 Marketplace、把 Host slot 改成 ready。
