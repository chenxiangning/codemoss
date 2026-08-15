# Design

`handshake_at` 在 `bind_uds` 成功后挂 `UnlinkOnDrop`。超时 / connect / write 失败走 `?` 也会 unlink。测试用沉默 accept 对端触发 `handshake-timeout`，断言 path 不存在。Worker 同样挂 guard。
