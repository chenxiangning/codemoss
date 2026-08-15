# plugin-ipc-handshake-hello-generation-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake hello MUST bind the current generation

`validate_handshake_hello` MUST 核验 `generation`。generation 0、缺失或旧 generation MUST `handshake-rejected`。

#### Scenario: a current-generation hello is accepted

- **WHEN** hello 的 generation 为 1 且期望 generation 为 1
- **THEN** 校验 MUST 成功

#### Scenario: a stale hello generation cannot start handshake

- **WHEN** 期望 generation 2
- **AND** hello 的 generation 为 1
- **THEN** 校验 MUST 失败且错误码为 `handshake-rejected`
