# Design

`migrate_own_store(plugin_id, plan)` 先 `ensure_ready`，再 `storage.migrate`。测试：ready + checkpoint 后 1→2 成功；disable 后失败。
