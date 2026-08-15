# Design

`fuse_plugin` 对称 `disable_plugin`，调用已有 `fuse_and_revoke`。`open_own_store` 已要求 Ready，fuse 后自然失败。
