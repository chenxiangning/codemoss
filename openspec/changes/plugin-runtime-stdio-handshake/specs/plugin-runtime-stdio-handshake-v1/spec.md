# plugin-runtime-stdio-handshake-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process start MUST complete framed stdio handshake

handshake 模式下，`start` MUST 经 piped stdio 发送 `mossx.handshake.hello`，并校验 ack 回显 `MOSSX_HANDSHAKE_NONCE`。坏 nonce 或读失败 MUST 杀掉 child，且 live map 不得保留该进程。

#### Scenario: a ready unit completes stdio handshake

- **WHEN** Notes 用 handshake driver 激活成功
- **THEN** 每个 required entry MUST 完成 MXPC hello/ack
- **AND** driver MUST 记录对应 live child

#### Scenario: a bad handshake nonce kills the child

- **WHEN** peer 回显错误 nonce
- **THEN** `activate` MUST 失败
- **AND** driver MUST 不持有 live child

#### Scenario: a later handshake failure kills the earlier child

- **WHEN** 第二个 required entry handshake 失败
- **THEN** 第一个已握手 child MUST 被 stop
- **AND** slot state MUST 为 Failed
