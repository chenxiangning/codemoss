# Design

`query_read` / `open_stream` 已走 `Host::dispatch`。本刀补组合面回归：旧 generation 返回 `stale-generation`。
