# Design

对标 3AN 的 `ClaudeCompatAdapter`：单 owner、delegate-to-Core、调用路径 flag。

## 门面升级

`NotesBackend` trait 从单一 `list` 扩展为 7 条命令的 delegate 面，`NotesCompatAdapter` 持有 `Arc<dyn NotesBackend>`，其中生产路径注入 `CoreNotesBackend`（包装 `note_cards.rs` 现有 `pub(crate)` 函数），测试/门面自检继续用 `MemoryNotesBackend`。

`owner()` 恒为 `NotesCompatOwner::CoreNotes`——flag 只切调用路径，不产生第二个实现（与 3AN 同构）。

## 命令入口分发

7 条 `note_card_*` 命令入口加 `notes_owner()` 分发：

```text
note_card_list(...)
  → if notes_compat_facade_enabled() { facade.list(...) } else { Core 现有实现 }
```

flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off，所以 7 条命令走与当前完全一致的 Core 路径；on 时经 facade 调到同一个 Core 后端。

## 不做的（本刀边界）

- 不 activate / dispatch / 接 `DiskStorage` / 读 `notes_storage`（运行时接入是 conformance 后 step 6/7）。
- 不删任何 Core 文件（Slim 是 step 8）。
- 不迁用户数据、不开 Marketplace、不默认开 flag。
