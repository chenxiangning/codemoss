# Design

`fuse` / `disable` / `reset` 先校验 `plugin_id.trim()` 非空，再 `get_mut` 已有 slot。缺失则 `plugin-unavailable`，不再 `or_insert`。
