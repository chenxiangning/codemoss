# plugin-ipc-handshake-nonce-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake nonce MUST be unique per activation

Host 发出的 `mossx.handshake.hello` MUST 使用 `issue_handshake_nonce()` 的当次值。连续两次签发 MUST 不相等，且 MUST 为 64 位 hex。

#### Scenario: two issued nonces are distinct

- **WHEN** 连续调用 `issue_handshake_nonce` 两次
- **THEN** 两个值 MUST 都通过 hello nonce 校验
- **AND** 两个值 MUST 不相等
