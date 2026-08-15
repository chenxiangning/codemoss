# Design

`drain_unexpected` 先用 handshake deadline accept 第一条；之后用 0ms poll 抽干 backlog。每条写 `host-disabled`。一条都没有则 `handshake-timeout`。`reject_unexpected` 仍只拒一条。
