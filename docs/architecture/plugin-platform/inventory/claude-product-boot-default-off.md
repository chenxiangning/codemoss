# Claude Product Boot Default-Off（Wave 3AQ）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改启动链、不开 flag、不删代码。

## 产品构造点

| 面 | 落点 |
|---|---|
| GUI | `state.rs` → `EngineManager::new()` |
| daemon | `daemon_state.rs` → `EngineManager::new()` |

`new()` 读 `MOSSX_CLAUDE_COMPAT_FACADE`，未设即为 off。

## 不是产品默认

`new_with_claude_compat(true)` 只属于测试。boot Host 不激活 Claude，不装过渡仓。

## 禁止

从 3AQ 跳到默认开 flag、在启动链注入 true、删 `engine/claude*`、开 Marketplace。
