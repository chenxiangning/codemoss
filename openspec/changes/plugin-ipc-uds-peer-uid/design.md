# Design

`uds_peer_ok` 比当前 `getuid()`。Unix `accept_uds` / `connect_uds` 用 `getpeereid`（macOS/BSD）或 `SO_PEERCRED`（Linux）取对端 uid。失败或外用户不得返回 stream。
