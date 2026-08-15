# Design

`query_read` / `open_stream` 都走 `Host::dispatch`。未 activate 时 slot 不存在。本刀补组合面回归。
