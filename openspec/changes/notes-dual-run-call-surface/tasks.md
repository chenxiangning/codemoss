# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「对标 3AN 调用面收口」与「不接插件运行时」边界
- [x] 1.2 `openspec validate notes-dual-run-call-surface --strict --no-interactive`
- [x] 1.3 `note_card_list` 抽 `note_card_list_core` + facade `list_notes` delegate（最小验证片段，证明可实施）
- [x] 1.4 其余 6 条命令（get/create/update/archive/restore/delete）抽 `*_core` + facade delegate
- [x] 1.5 7 条命令入口 `notes_owner()` 分发（flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off）
- [x] 1.6 测试：默认 off 行为不变（`note_cards` 16 passed）、facade 单 owner（`core_facade_exposes_a_single_core_owner`）、不调 plugin_runtime activate/dispatch
- [x] 1.7 `cargo test --lib note`（47 passed）+ `cargo test --lib plugin_runtime`（291 passed）
- [x] 1.8 确认 `note_cards.rs` / `noteCards.ts` / `src/features/note-cards/**` 仍在，产品行为 0% 变化（flag 默认 off）
