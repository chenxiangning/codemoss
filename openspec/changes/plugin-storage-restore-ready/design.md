# Design

`restore_own_store` 先 `ensure_ready`，再 `checkpoint` 若无则测试先打 checkpoint，再 `storage.restore`。测试里 ready 时 migrate 1→2，restore 回到 1；disable 后 restore 失败。
