# Design

`Host::activate` / `reset` 已检查 `Activating`。`dispatch` / `ensure_ready` 只认 Ready。本刀加 `test_force_state` 把槽位钉在 Activating，补组合面回归。
