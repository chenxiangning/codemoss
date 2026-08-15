# Design

`Host::activate` 在占槽前检查 `plugin_id` / `unit_id` / 每个 required entry 的 `trim()` 非空。
