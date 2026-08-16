# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「对标 3AN 调用面收口」与「不接插件运行时」边界
- [x] 1.2 `openspec validate notes-dual-run-call-surface --strict --no-interactive`
- [ ] 1.3 `NotesBackend` trait 扩展到 7 条命令 + `CoreNotesBackend`（包装 `note_cards.rs` 现有函数）
- [ ] 1.4 7 条 `note_card_*` 命令入口加 `notes_owner()` 分发（flag 默认 off → Core）
- [ ] 1.5 测试：默认 off 行为不变、flag on 经 facade 到同一 Core、不调 plugin_runtime
- [ ] 1.6 `cargo test`（note_cards + notes_compat）+ `npx tsc --noEmit`
- [ ] 1.7 确认 `note_cards.rs` / `noteCards.ts` / `src/features/note-cards/**` 仍在，产品行为 0% 变化
