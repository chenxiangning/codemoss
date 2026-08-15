# Design

`open_own_store` 先看 `host.slot(plugin_id).state`。非 `Ready` 返回 `plugin-unavailable`。不删 `store.sqlite`。reset 后重新 activate 再走同一路径。
