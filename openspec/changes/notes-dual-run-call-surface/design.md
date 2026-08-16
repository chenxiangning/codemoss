# Design

对标 3AN 的 `ClaudeCompatAdapter`：单 owner、delegate-to-Core、调用路径 flag。3AN 无 trait 抽象——`ClaudeCompatAdapter` 直接持有 `Arc<ClaudeSessionManager>` 并 delegate 到其方法。

## 门面 delegate（无 trait 扩展）

`note_cards.rs` 的 7 条命令把 Core 逻辑抽成 `pub(crate)` 内部函数（`note_card_list_core` 等），`NotesCompatAdapter` 增加 7 个 delegate 方法直接调这些内部函数：

```text
NotesCompatAdapter::list(...) → crate::note_cards::note_card_list_core(...)
```

`owner()` 恒为 `NotesCompatOwner::CoreNotes`——flag 只切调用路径，不产生第二个实现（与 3AN 同构）。`NotesBackend` trait / `MemoryNotesBackend` 保持 4E 原样（门面自检 fixture），不扩展到 7 条命令、不承担生产 delegate。

## 命令入口分发

7 条 `note_card_*` 命令入口加 `notes_owner()` 分发：

```text
note_card_list(...)
  → if notes_compat_facade_enabled() { facade.core().list(...) } else { note_card_list_core(...) }
```

flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off，所以 7 条命令走与当前完全一致的 Core 路径；on 时经 facade 调到同一个 Core 内部函数（无递归：facade 调 `*_core`，不调命令入口）。

## 不做的（本刀边界）

- 不 activate / dispatch / 接 `DiskStorage` / 读 `notes_storage`（运行时接入是 conformance 后 step 6/7）。
- 不删任何 Core 文件（Slim 是 step 8）。
- 不迁用户数据、不开 Marketplace、不默认开 flag。
