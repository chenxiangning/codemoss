# plugin-host-loopback-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST be able to activate via in-memory MXPC handshake

`LoopbackDriver` MUST 在 `start` 时发送 `mossx.handshake.hello` MXPC 帧，并校验对端 ack 回显 nonce。handshake 失败 MUST 导致该 Entry start 失败，由 Host 反向回滚。本路径 MUST NOT 打开 socket 或 spawn 进程。

#### Scenario: loopback handshake becomes ready

- **WHEN** 假对端回显正确 nonce
- **THEN** Host slot MUST 为 `ready`

#### Scenario: loopback nonce mismatch rolls back

- **WHEN** 假对端 ack 的 nonce 与 hello 不同
- **THEN** start MUST 失败
- **AND** 已启动 Entry MUST 被 stop
