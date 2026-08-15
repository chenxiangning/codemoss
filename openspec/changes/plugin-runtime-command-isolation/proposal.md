# Proposal: plugin-runtime-command-isolation

> Wave：1K（插座闸门 · command 面隔离）  
> 依赖：1H 默认 off boot、4E Notes 门面默认 off

## Why

`lib.rs` 已不构造 runtime。若 `command_registry` 把 `plugin_runtime::*` 挂成 Tauri command，前端就能绕过产品路径。1K 用源码闸门锁住：registry 仍注册 7 条 `note_card_*`，不得出现 `plugin_runtime`。

## 边界

1. `command_registry.rs` MUST 含 7 条 `note_card_*`。
2. MUST NOT 含 `plugin_runtime` / `PluginRuntime`。
3. 不改产品 command 行为。

## Capabilities

- `plugin-runtime-command-isolation-v1`
