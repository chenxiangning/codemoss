# Tasks

- [x] 1.1 落盘 proposal + spec delta，明确「安全片段第 1 步：create + count」与「零数据风险」边界
- [x] 1.2 `openspec validate notes-storage-sqlite-crud --strict --no-interactive`
- [x] 1.3 `notes_storage.rs` 加 `NotesNamespace`：`open` 建表 + `create_note` + `count_notes`
- [x] 1.4 测试：隔离 namespace 上 create → count == 1，路径不含 `note_cards`
- [x] 1.5 `cargo test --lib notes_storage`（3 passed）+ `cargo test --lib plugin_runtime`
- [x] 1.6 确认 `note_cards.rs` / feature 仍在，7 条命令默认路径不变
