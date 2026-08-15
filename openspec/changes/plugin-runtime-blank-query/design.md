# Design

`Host::dispatch` 在 generation 检查之后、查 slot 之前，拒绝 `plugin_id.trim()` 为空。
