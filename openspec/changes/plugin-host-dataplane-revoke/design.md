# Design

`StreamState` 增加 `plugin_id` / `generation`。`open(plugin_id, generation, stream_id, codec)`。`revoke` 按 owner 过滤删除。`fuse_and_revoke` 是组合函数，不改 `Host::fuse` 签名。
