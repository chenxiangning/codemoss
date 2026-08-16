# notes-dual-run-call-surface-v1 Specification

## Purpose
TBD - created by archiving change notes-dual-run-call-surface. Update Purpose after archive.
## Requirements
### Requirement: Notes facade MUST delegate to Core across all seven commands

`note_cards.rs` MUST 把 7 条命令的 Core 逻辑抽成 `pub(crate)` 内部函数（`note_card_list_core` 等），`NotesCompatAdapter` MUST 提供 7 个 delegate 方法直接调这些内部函数，且 `owner()` 恒为 `NotesCompatOwner::CoreNotes`。delegate MUST NOT 调命令入口（避免递归），MUST NOT 引入第二个实现。

#### Scenario: the facade exposes a single Core owner across seven commands

- **WHEN** 构造 `NotesCompatAdapter`
- **THEN** `owner()` MUST 为 `NotesCompatOwner::CoreNotes`
- **AND** facade MUST 提供 list / get / create / update / archive / restore / delete 七个 delegate 方法，各自调对应 `*_core` 内部函数

### Requirement: note_card commands MUST route through a default-off facade flag

7 条 `note_card_*` 命令入口 MUST 加 `notes_owner()` 分发：flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off 时走与当前完全一致的 Core 路径；on 时经 facade 调到同一 Core 实现。MUST NOT 引入第二个实现。

#### Scenario: default-off keeps product behavior unchanged

- **WHEN** flag 未设置（默认）
- **THEN** `notes_compat_facade_enabled()` MUST 返回 `false`
- **AND** 7 条命令 MUST 走 Core 现有实现，行为与当前一致

#### Scenario: flag routes through the facade to the same Core implementation

- **WHEN** flag 置为 `"1"`
- **THEN** 7 条命令 MUST 经 facade 分发到同一 Core backend
- **AND** 不得 activate / dispatch 插件运行时，不得读 `notes_storage` namespace

### Requirement: the call-surface close MUST NOT wire the plugin runtime

本刀 MUST NOT 接插件运行时（不 activate / 不 dispatch / 不接 `DiskStorage` / 不读 `notes_storage`），MUST NOT 删 `note_cards.rs` / `noteCards.ts` / `src/features/note-cards/**`，MUST NOT 默认开 flag 或开 Marketplace。

#### Scenario: no runtime wiring and no Core deletion

- **WHEN** 检查本刀改动
- **THEN** `note_cards.rs` 与 `src/features/note-cards/**` MUST 仍存在
- **AND** 命令分发 MUST NOT 调用 `plugin_runtime` 的 activate / dispatch / storage

