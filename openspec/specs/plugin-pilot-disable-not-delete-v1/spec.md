# plugin-pilot-disable-not-delete-v1 Specification

## Purpose

产品默认停用 Claude / Notes 的 Core owner，但保留源码作为显式 `0` 的 recovery。本 capability 同时约束产品 registry：允许 Notes + Claude allowlist 的装/卸命令，禁止通用 Host 通电与 Marketplace catalog 安装。

## Requirements

### Requirement: Product default MUST disable Core owners without deleting them

未设置关闭旗时，Claude 与 Notes 的 Core owner MUST 为 `disabled`。`src-tauri/src/engine/claude.rs` 与 `src-tauri/src/note_cards.rs` MUST 仍存在。源码 MUST 仍含 `cmd.spawn()` 与 `note_card_*_core`。显式 `0` MUST 把对应 owner 设为 `fallback`。本刀 MUST NOT Slim，MUST NOT 删除上述文件。产品 registry MUST 允许 Notes + Claude allowlist 的 `install_plugin` / `uninstall_plugin`，MUST NOT 注册 `activate_plugin`，MUST NOT 注册 Marketplace catalog 安装命令。

#### Scenario: default product disables Core owners

- **WHEN** 未设置 Claude / Notes 关闭旗
- **THEN** `claude_core_owner_from(None)` MUST 为 `disabled`
- **AND** `notes_core_owner_from(None)` MUST 为 `disabled`
- **AND** 两个 Core 源文件 MUST 仍存在

#### Scenario: explicit off restores Core fallback

- **WHEN** 对应变量为 `0`
- **THEN** 该插头 `coreOwner` MUST 为 `fallback`
- **AND** later-plugin `coreOwner` MUST 仍为 `active`

#### Scenario: registry allows Notes install commands without Marketplace

- **WHEN** 读取 `command_registry.rs`
- **THEN** 源码 MUST 包含 `install_plugin` 与 `uninstall_plugin`
- **AND** 源码 MUST NOT 包含 `activate_plugin`
