# plugin-ipc-handshake-v1 Spec Delta

## ADDED Requirements

### Requirement: Control handshake MUST echo nonce and pin protocolVersion 1

Host MUST 发送 `mossx.handshake.hello`，params 含 `protocolVersion=1`、`coreContract`、32-byte hex `nonce`、`generation`。对端 MUST 在逻辑上回复同一 `protocolVersion` 并回显 nonce。major 不匹配、缺 nonce、不回显 MUST 拒绝激活（本 change 只做纯函数校验，不建连）。

#### Scenario: matching hello and ack are accepted

- **WHEN** hello 与 ack 的 nonce 相同且 `protocolVersion` 为 1
- **THEN** validator MUST 接受

#### Scenario: mismatched major or nonce is rejected

- **WHEN** ack 的 `protocolVersion` 不是 1，或不回显 nonce
- **THEN** validator MUST 返回 `handshake-rejected`
