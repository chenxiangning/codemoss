# notes-dual-run-call-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes backend MUST delegate to Core across all seven commands

`NotesBackend` trait MUST 覆盖 7 条 `note_card_*` 命令的 delegate 面（list / get / create / update / archive / restore / delete），`NotesCompatAdapter` MUST 持有 `Arc<dyn NotesBackend>` 且 `owner()` 恒为 `NotesCompatOwner::CoreNotes`。生产路径 MUST 注入 Core backend（包装 `note_cards.rs` 现有函数），测试路径可用内存 backend。

#### Scenario: the facade exposes a single Core owner across seven commands

- **WHEN** 构造 `NotesCompatAdapter`
- **THEN** `owner()` MUST 为 `NotesCompatOwner::CoreNotes`
- **AND** `NotesBackend` trait MUST 声明 list / get / create / update / archive / restore / delete 七个方法

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
