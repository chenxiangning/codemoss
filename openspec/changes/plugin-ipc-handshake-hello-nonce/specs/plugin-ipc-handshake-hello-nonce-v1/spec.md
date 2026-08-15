# plugin-ipc-handshake-hello-nonce-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake hello MUST bind the issued nonce

`validate_handshake_hello` MUST 要求 `params.nonce` 等于本次签发 nonce。外来 nonce MUST `handshake-rejected`。

#### Scenario: the issued nonce hello is accepted

- **WHEN** hello nonce 等于本次签发值
- **THEN** 校验 MUST 成功

#### Scenario: a foreign hello nonce cannot start handshake

- **WHEN** hello nonce 与本次签发值不同
- **THEN** 校验 MUST `handshake-rejected`
