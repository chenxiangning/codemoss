# Proposal: notes-product-default-isolated

> OpenSpec change id: `notes-product-default-isolated`  
> Wave：P4.7 批次 26（第二根插头 · 产品默认隔离 sqlite）  
> 依赖：`notes-legacy-import-once`  
> 架构：`15` §3 Dual-run。存量导入已过，默认路径才能切。

## Why

存量 json 已能一次性导入。Notes 旗仍默认关，用户日常仍走 `note_cards` 文件。这不是真插头。

本刀把未设 `MOSSX_NOTES_COMPAT_FACADE` 视为 on。显式 `0/false` 回文件。首次打开仍跑 `import_legacy_once`。不删源文件，不 Slim。

## 目标与边界

1. `notes_compat_facade_enabled_from(None)` MUST 为 true。
2. 显式关闭 MUST 仍走 `note_card_*_core`。
3. 默认路径 MUST 写隔离 sqlite，MUST NOT 双写。
4. **MUST NOT** Slim，**MUST NOT** 删 `note_cards.rs`。

## Capabilities

- `notes-product-default-isolated-v1`
