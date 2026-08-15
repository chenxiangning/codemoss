# Design

凡身份字符串，`value != value.trim()` 一律 `schema`。activate 在占槽前检查；dispatch / ensure_ready / access_store / Broker::query 同样检查。
